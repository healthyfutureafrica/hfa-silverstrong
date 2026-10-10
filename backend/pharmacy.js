const { z } = require('zod');
const { randomUUID } = require('node:crypto');
const { digest } = require('./store');

const text=z.string().trim().min(1).max(200).regex(/^[^<>&"\u0000-\u001f]+$/);
const itemSchema=z.object({name:text,strength:text,unit:text,batch:text,expiresOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),stock:z.number().int().min(0).max(100000),price:z.number().min(0.01).max(10000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.000001),requiresPrescription:z.boolean()}).strict();
const orderSchema=z.object({requestId:z.string().uuid(),itemId:z.string().uuid(),quantity:z.number().int().min(1).max(20),method:z.enum(['pickup','delivery']),address:text}).strict();

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
  )`);
  const pharmacist=(request,response,next)=>request.user.role==='pharmacist'&&request.user.pharmacyValidatedAt?next():response.status(403).json({error:'An administrator-validated pharmacist is required'});
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
    response.json({items,orders});
  });
  app.post('/api/pharmacy/items',authenticated,pharmacist,(request,response)=>{
    const input=itemSchema.parse(request.body);
    const parsed=new Date(input.expiresOn+'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==input.expiresOn||input.expiresOn<=new Date().toISOString().slice(0,10)) return response.status(400).json({error:'A valid future expiry date is required'});
    const id=randomUUID();
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