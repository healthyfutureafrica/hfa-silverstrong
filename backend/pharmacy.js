const { z } = require('zod');
const QRCode = require('qrcode');
const { randomUUID } = require('node:crypto');
const { digest } = require('./store');

const text=z.string().trim().min(1).max(200).regex(/^[^<>&"\u0000-\u001f]+$/);
const itemSchema=z.object({id:z.string().uuid().optional(),name:text,strength:text,unit:text,batch:text,expiresOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),stock:z.number().int().min(0).max(100000),price:z.number().min(0.01).max(10000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.000001),requiresPrescription:z.boolean()}).strict();
const orderSchema=z.object({requestId:z.string().uuid(),itemId:z.string().uuid(),quantity:z.number().int().min(1).max(20),method:z.enum(['pickup','delivery']),address:text}).strict();
const patientCodeSchema=z.object({}).strict();
const posSaleSchema=z.object({
  requestId:z.string().uuid(),
  patientCode:z.string().regex(/^HFA-PATIENT:[0-9a-f-]{36}$/i),
  items:z.array(z.object({itemId:z.string().uuid(),quantity:z.number().int().min(1).max(1000)}).strict()).min(1).max(50),
  prescriptionReviewed:z.boolean()
}).strict().superRefine((input,context)=>{
  if(new Set(input.items.map(item=>item.itemId)).size!==input.items.length)
    context.addIssue({code:'custom',path:['items'],message:'Each inventory item must appear only once'});
});

function installPharmacyRoutes(app,store,authenticated) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS pharmacy_items (
    id TEXT PRIMARY KEY, pharmacist_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
    strength TEXT NOT NULL, unit TEXT NOT NULL, batch TEXT NOT NULL, expires_on TEXT NOT NULL,
    stock INTEGER NOT NULL, price_cents INTEGER NOT NULL, prescription INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES users(id), pharmacist_id TEXT NOT NULL REFERENCES users(id),
    item_id TEXT NOT NULL REFERENCES pharmacy_items(id), request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
    quantity INTEGER NOT NULL, total_cents INTEGER NOT NULL, method TEXT NOT NULL, address TEXT NOT NULL,
    status TEXT NOT NULL, prescription_reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pharmacy_patient_codes (
    token_digest TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL, used_at TEXT
  );
  CREATE INDEX IF NOT EXISTS pharmacy_patient_codes_patient ON pharmacy_patient_codes(patient_id,expires_at);
  CREATE TABLE IF NOT EXISTS pharmacy_pos_sales (
    id TEXT PRIMARY KEY, pharmacist_id TEXT NOT NULL REFERENCES users(id), patient_id TEXT NOT NULL REFERENCES users(id),
    request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, patient_code_digest TEXT NOT NULL,
    total_cents INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pharmacy_pos_sale_items (
    sale_id TEXT NOT NULL REFERENCES pharmacy_pos_sales(id), item_id TEXT NOT NULL REFERENCES pharmacy_items(id),
    name TEXT NOT NULL, strength TEXT NOT NULL, unit TEXT NOT NULL, batch TEXT NOT NULL, expires_on TEXT NOT NULL,
    quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, line_total_cents INTEGER NOT NULL,
    prescription INTEGER NOT NULL, prescription_reviewed INTEGER NOT NULL,
    PRIMARY KEY (sale_id,item_id)
  )`);
  const saleColumns=new Set(store.db.prepare('PRAGMA table_info(pharmacy_pos_sales)').all().map(column=>column.name));
  if(!saleColumns.has('patient_code_digest')) store.db.exec("ALTER TABLE pharmacy_pos_sales ADD COLUMN patient_code_digest TEXT NOT NULL DEFAULT ''");
  const pharmacist=(request,response,next)=>request.user.role==='pharmacist'&&request.user.pharmacyValidatedAt?next():response.status(403).json({error:'An administrator-validated pharmacist is required'});
  const patient=(request,response,next)=>request.user.role==='patient'&&request.user.status==='active'?next():response.status(403).json({error:'An active patient account is required'});
  const mapItem=row=>({id:row.id,pharmacistId:row.pharmacist_id,name:row.name,strength:row.strength,unit:row.unit,batch:row.batch,expiresOn:row.expires_on,stock:row.stock,price:row.price_cents/100,currency:'USD',requiresPrescription:!!row.prescription});
  app.get('/api/pharmacy',authenticated,(request,response)=>{
    const user=request.user;
    if (!['patient','pharmacist','admin'].includes(user.role)) return response.sendStatus(403);
    if (user.role==='pharmacist'&&!user.pharmacyValidatedAt) return response.sendStatus(403);
    const items=store.db.prepare('SELECT * FROM pharmacy_items').all().filter(row=>{
      const owner=store.user(row.pharmacist_id);
      return user.role==='admin'||(user.role==='pharmacist'?row.pharmacist_id===user.id:owner?.status==='active'&&owner.pharmacyValidatedAt&&row.stock>0&&row.expires_on>new Date().toISOString().slice(0,10));
    }).map(row=>{const owner=store.user(row.pharmacist_id);return {...mapItem(row),pharmacyName:owner?.pharmacyName,pharmacyAddress:owner?.pharmacyAddress,pharmacyLocation:owner?.pharmacyLocation};});
    const orders=store.db.prepare('SELECT * FROM pharmacy_orders ORDER BY created_at DESC').all().filter(row=>user.role==='admin'||row.patient_id===user.id||row.pharmacist_id===user.id).map(row=>({id:row.id,itemId:row.item_id,name:store.db.prepare('SELECT name FROM pharmacy_items WHERE id=?').get(row.item_id)?.name,patientId:row.patient_id,pharmacistId:row.pharmacist_id,quantity:row.quantity,total:row.total_cents/100,currency:'USD',method:row.method,address:row.address,status:row.status,prescriptionReviewed:!!row.prescription_reviewed,createdAt:row.created_at}));
    const saleRows=store.db.prepare(`SELECT s.*,p.name AS patient_name,u.profile AS pharmacist_profile
      FROM pharmacy_pos_sales s JOIN users p ON p.id=s.patient_id JOIN users u ON u.id=s.pharmacist_id
      ORDER BY s.created_at DESC`).all().filter(row=>user.role==='admin'||row.patient_id===user.id||row.pharmacist_id===user.id);
    const sales=saleRows.map(row=>({
      id:row.id,patientId:row.patient_id,pharmacistId:row.pharmacist_id,
      ...(user.role!=='patient'?{patientName:row.patient_name}:{}),
      pharmacyName:JSON.parse(row.pharmacist_profile).pharmacyName||'',
      total:row.total_cents/100,currency:'USD',status:'recorded',createdAt:row.created_at,
      items:store.db.prepare('SELECT item_id AS itemId,name,strength,unit,batch,expires_on AS expiresOn,quantity,unit_price_cents*1.0/100 AS unitPrice,line_total_cents*1.0/100 AS lineTotal,prescription AS requiresPrescription,prescription_reviewed AS prescriptionReviewed FROM pharmacy_pos_sale_items WHERE sale_id=?').all(row.id)
        .map(item=>({...item,requiresPrescription:!!item.requiresPrescription,prescriptionReviewed:!!item.prescriptionReviewed}))
    }));
    response.json({items,orders,sales});
  });
  app.post('/api/pharmacy/patient-code',authenticated,patient,async(request,response)=>{
    patientCodeSchema.parse(request.body);
    const token=`HFA-PATIENT:${randomUUID()}`,expiresAt=new Date(Date.now()+5*60*1000).toISOString();
    store.db.prepare('DELETE FROM pharmacy_patient_codes WHERE expires_at<?').run(new Date(Date.now()-24*60*60*1000).toISOString());
    store.db.prepare('UPDATE pharmacy_patient_codes SET expires_at=? WHERE patient_id=? AND used_at IS NULL').run(new Date().toISOString(),request.user.id);
    store.db.prepare('INSERT INTO pharmacy_patient_codes (token_digest,patient_id,expires_at) VALUES (?,?,?)').run(digest(token),request.user.id,expiresAt);
    const qr=await QRCode.toDataURL(token,{errorCorrectionLevel:'M',margin:1,width:240});
    response.status(201).json({qr,expiresAt});
  });
  app.post('/api/pharmacy/pos',authenticated,pharmacist,(request,response)=>{
    const input=posSaleSchema.parse(request.body);
    const requestKey=`${request.user.id}:${input.requestId}`;
    const normalizedItems=[...input.items].sort((a,b)=>a.itemId.localeCompare(b.itemId));
    const codeDigest=digest(input.patientCode);
    store.db.exec('BEGIN IMMEDIATE');
    try {
      const prior=store.db.prepare('SELECT id,patient_id,fingerprint,patient_code_digest FROM pharmacy_pos_sales WHERE request_key=?').get(requestKey);
      if(prior) {
        const fingerprint=digest(JSON.stringify([prior.patient_id,normalizedItems,input.prescriptionReviewed]));
        store.db.exec('ROLLBACK');
        return prior.patient_code_digest===codeDigest&&prior.fingerprint===fingerprint
          ?response.json({id:prior.id,status:'recorded'})
          :response.status(409).json({error:'Sale request ID conflicts with different content'});
      }
      const code=store.db.prepare('SELECT * FROM pharmacy_patient_codes WHERE token_digest=?').get(codeDigest);
      const patientUser=code&&store.user(code.patient_id);
      if(!code||patientUser?.role!=='patient'||patientUser.status!=='active') {
        store.db.exec('ROLLBACK');
        return response.status(409).json({error:'Patient QR code is expired, used or invalid. Ask the patient to display a new code.'});
      }
      const fingerprint=digest(JSON.stringify([patientUser.id,normalizedItems,input.prescriptionReviewed]));
      if(code.used_at||code.expires_at<=new Date().toISOString()) {
        store.db.exec('ROLLBACK');
        return response.status(409).json({error:'Patient QR code is expired or used. Ask the patient to display a new code.'});
      }
      const selected=[];
      for(const line of normalizedItems) {
        const item=store.db.prepare('SELECT * FROM pharmacy_items WHERE id=? AND pharmacist_id=?').get(line.itemId,request.user.id);
        if(!item||item.expires_on<=new Date().toISOString().slice(0,10)||item.stock<line.quantity) {
          store.db.exec('ROLLBACK');
          return response.status(409).json({error:'A selected product is expired, unavailable or has insufficient stock'});
        }
        if(item.prescription&&!input.prescriptionReviewed) {
          store.db.exec('ROLLBACK');
          return response.status(409).json({error:'Review the original prescription before recording prescription medicine'});
        }
        selected.push({item,quantity:line.quantity});
      }
      const now=new Date().toISOString(),saleId=randomUUID();
      const consumed=store.db.prepare('UPDATE pharmacy_patient_codes SET used_at=? WHERE token_digest=? AND used_at IS NULL AND expires_at>?').run(now,digest(input.patientCode),now);
      if(!consumed.changes) {
        store.db.exec('ROLLBACK');
        return response.status(409).json({error:'Patient QR code has already been used or expired. Ask the patient to display a new code.'});
      }
      const total=selected.reduce((sum,line)=>sum+line.item.price_cents*line.quantity,0);
      store.db.prepare('INSERT INTO pharmacy_pos_sales (id,pharmacist_id,patient_id,request_key,fingerprint,patient_code_digest,total_cents,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(saleId,request.user.id,patientUser.id,requestKey,fingerprint,codeDigest,total,now);
      const insertLine=store.db.prepare('INSERT INTO pharmacy_pos_sale_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      const decrement=store.db.prepare('UPDATE pharmacy_items SET stock=stock-? WHERE id=? AND pharmacist_id=? AND stock>=?');
      for(const {item,quantity} of selected) {
        if(!decrement.run(quantity,item.id,request.user.id,quantity).changes) {
          store.db.exec('ROLLBACK');
          return response.status(409).json({error:'Stock changed during checkout. Refresh inventory and retry.'});
        }
        insertLine.run(saleId,item.id,item.name,item.strength,item.unit,item.batch,item.expires_on,quantity,item.price_cents,item.price_cents*quantity,item.prescription,input.prescriptionReviewed?1:0);
      }
      store.audit(request.user.id,'PHARMACY_POS_SALE',{targetId:patientUser.id,details:{saleId,itemCount:selected.length}});
      store.db.exec('COMMIT');
      store.db.prepare('DELETE FROM pharmacy_patient_codes WHERE expires_at<?').run(new Date(Date.now()-24*60*60*1000).toISOString());
      response.status(201).json({id:saleId,status:'recorded'});
    } catch(error) {
      store.db.exec('ROLLBACK');
      throw error;
    }
  });
  app.post('/api/pharmacy/items',authenticated,pharmacist,(request,response)=>{
    const input=itemSchema.parse(request.body);
    const parsed=new Date(input.expiresOn+'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==input.expiresOn||input.expiresOn<=new Date().toISOString().slice(0,10)) return response.status(400).json({error:'A valid future expiry date is required'});
    // Offline devices send their own item ID so a replayed request does not create a duplicate batch.
    const id=input.id||randomUUID(),prior=input.id&&store.db.prepare('SELECT pharmacist_id FROM pharmacy_items WHERE id=?').get(id);
    if (prior) return prior.pharmacist_id===request.user.id?response.json({id}):response.status(409).json({error:'Item ID already exists'});
    store.db.prepare('INSERT INTO pharmacy_items VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,request.user.id,input.name,input.strength,input.unit,input.batch,input.expiresOn,input.stock,Math.round(input.price*100),input.requiresPrescription?1:0);
    response.status(201).json({id});
  });
  app.patch('/api/pharmacy/items/:id',authenticated,pharmacist,(request,response)=>{
    const input=z.object({stock:z.number().int().min(0).max(100000)}).strict().parse(request.body);
    const result=store.db.prepare('UPDATE pharmacy_items SET stock=? WHERE id=? AND pharmacist_id=?').run(input.stock,request.params.id,request.user.id);
    if (!result.changes) return response.sendStatus(404);
    response.json({status:'updated'});
  });
  app.post('/api/pharmacy/orders',authenticated,(request,response)=>{
    if (request.user.role!=='patient') return response.sendStatus(403);
    const input=orderSchema.parse(request.body),key=`${request.user.id}:${input.requestId}`,fingerprint=digest(JSON.stringify([input.itemId,input.quantity,input.method,input.address]));
    const prior=store.db.prepare('SELECT id,fingerprint FROM pharmacy_orders WHERE request_key=?').get(key);
    if (prior) return prior.fingerprint===fingerprint?response.json({id:prior.id,status:'requested'}):response.status(409).json({error:'Purchase request ID conflicts with different content'});
    const item=store.db.prepare('SELECT * FROM pharmacy_items WHERE id=?').get(input.itemId),owner=item&&store.user(item.pharmacist_id);
    if (!item||owner?.status!=='active'||!owner.pharmacyValidatedAt||item.expires_on<=new Date().toISOString().slice(0,10)) return response.status(409).json({error:'Medication is unavailable'});
    const id=randomUUID();
    store.db.exec('BEGIN IMMEDIATE');
    try {
      const reserved=store.db.prepare('UPDATE pharmacy_items SET stock=stock-? WHERE id=? AND stock>=?').run(input.quantity,item.id,input.quantity);
      if (!reserved.changes) {store.db.exec('ROLLBACK');return response.status(409).json({error:'Not enough available stock'});}
      store.db.prepare('INSERT INTO pharmacy_orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,request.user.id,owner.id,item.id,key,fingerprint,input.quantity,item.price_cents*input.quantity,input.method,input.address,'requested',0,new Date().toISOString());
      store.db.exec('COMMIT');
    } catch(error) {store.db.exec('ROLLBACK');throw error;}
    response.status(201).json({id,status:'requested'});
  });
  app.patch('/api/pharmacy/orders/:id',authenticated,pharmacist,(request,response)=>{
    const input=z.object({status:z.enum(['ready','dispatched','completed','cancelled']),prescriptionReviewed:z.boolean().optional()}).strict().parse(request.body);
    const order=store.db.prepare('SELECT * FROM pharmacy_orders WHERE id=? AND pharmacist_id=?').get(request.params.id,request.user.id);
    if (!order) return response.sendStatus(404);
    if (order.status===input.status) return response.json({status:input.status}); // replayed offline update
    const transitions={requested:['ready','cancelled'],ready:order.method==='delivery'?['dispatched','cancelled']:['completed','cancelled'],dispatched:['completed']};
    if (!transitions[order.status]?.includes(input.status)) return response.status(409).json({error:'Invalid fulfillment transition'});
    const item=store.db.prepare('SELECT * FROM pharmacy_items WHERE id=?').get(order.item_id);
    const reviewed=order.prescription_reviewed||input.prescriptionReviewed;
    if (input.status!=='cancelled'&&item.expires_on<=new Date().toISOString().slice(0,10)) return response.status(409).json({error:'Expired stock cannot be fulfilled'});
    if (input.status!=='cancelled'&&item.prescription&&!reviewed) return response.status(409).json({error:'Verify the original prescription before fulfillment'});
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('UPDATE pharmacy_orders SET status=?,prescription_reviewed=? WHERE id=?').run(input.status,reviewed?1:0,order.id);
      if (input.status==='cancelled') store.db.prepare('UPDATE pharmacy_items SET stock=stock+? WHERE id=?').run(order.quantity,order.item_id);
      store.db.exec('COMMIT');
    } catch(error) {store.db.exec('ROLLBACK');throw error;}
    response.json({status:input.status});
  });
}

module.exports={installPharmacyRoutes};