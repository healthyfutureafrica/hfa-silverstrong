const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('pharmacists require credentials and administrator validation before login',async()=>{
  const store=new Store(),config={origin:'http://localhost:8080',ready:false};
  const server=createApp(config,store,{}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,body,cookie,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json','X-HFA-Request':'1',Origin:config.origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const input={name:'Synthetic Pharmacist',email:'pharmacist@example.invalid',password:'Synthetic-password-123',role:'pharmacist',pharmacyName:'Synthetic Pharmacy',pharmacyAddress:'1 Test Street',pharmacyLocation:'Douala, Cameroon',pharmacyLicense:'TEST-LICENSE',businessRegistration:'TEST-RCCM',minsanteAuthorization:'TEST-MINSANTE'};
  try {
    assert.equal((await request('/api/auth/register',{...input,minsanteAuthorization:undefined})).status,400);
    const registered=await request('/api/auth/register',input);
    assert.equal(registered.status,201);
    const {user}=await registered.json();
    assert.equal(user.status,'pending_approval');assert.equal(registered.headers.get('set-cookie'),null);
    assert.equal((await request('/api/auth/login',{email:input.email,password:input.password})).status,403);
    const admin=store.createUser({name:'Synthetic Admin',email:'admin-pharmacy@example.invalid',role:'admin'},'unused','active');
    const cookie=`hfa_session=${store.createSession(admin.id)}`;
    assert.equal((await request('/api/admin/users/'+user.id,{status:'active'},cookie,'PATCH')).status,409);
    assert.equal((await request('/api/admin/users/'+user.id,{status:'active',pharmacyCredentialReview:true},cookie,'PATCH')).status,200);
    assert.equal(store.user(user.id).pharmacyValidatedBy,admin.id);
    assert.equal((await request('/api/auth/login',{email:input.email,password:input.password})).status,200);
  } finally {await new Promise(resolve=>server.close(resolve));store.close();}
});

test('encrypted file uploads are owner-scoped, idempotent and require reauthentication after days',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'hfa-file-test-'));
  const database=join(directory,'test.sqlite');
  let store=new Store(database);
  const config={origin:'http://localhost:8080',ready:false,fileEncryptionKey:'12'.repeat(32)};
  const user=store.createUser({name:'Synthetic Owner',email:'owner@example.invalid',role:'patient'},'unused','active');
  const other=store.createUser({name:'Synthetic Other',email:'other@example.invalid',role:'patient'},'unused','active');
  const server=createApp(config,store,{}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,id=randomUUID();
  const cookie=`hfa_session=${store.createSession(user.id)}`,otherCookie=`hfa_session=${store.createSession(other.id)}`;
  const bytes=Buffer.from('%PDF-1.4\nSynthetic document');
  const metadata={fileName:'synthetic.pdf',category:'Report',notes:'Synthetic note',relatedApptId:''};
  const upload=(body=bytes,session=cookie,origin=config.origin)=>fetch(`${base}/api/files/${id}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-HFA-Request':'1','X-HFA-File-Owner':user.id,'X-HFA-File-Metadata':encodeURIComponent(JSON.stringify(metadata)),Origin:origin,Cookie:session},body});
  try {
    assert.equal((await upload(bytes,'')).status,401);
    assert.equal((await upload(bytes,otherCookie)).status,403);
    assert.equal((await upload(bytes,cookie,'https://attacker.invalid')).status,403);
    assert.equal((await upload(Buffer.from('<html>not a file</html>'))).status,400);
    assert.equal((await upload()).status,201);
    assert.equal((await upload()).status,200);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM uploaded_files').get().total,1);
    assert.equal((await upload(Buffer.from('%PDF-1.4\nDifferent'))).status,409);
    const row=store.db.prepare('SELECT * FROM uploaded_files').get();
    assert.equal(Buffer.from(row.encrypted).includes(bytes),false);
    assert.equal(Buffer.from(row.encrypted).includes(Buffer.from(metadata.fileName)),false);
    assert.equal((await fetch(`${base}/api/files/${id}`,{headers:{Cookie:otherCookie}})).status,404);
    const downloaded=await fetch(`${base}/api/files/${id}`,{headers:{Cookie:cookie}});
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
    store.db.prepare('UPDATE sessions SET expires_at=?').run(Date.now()-7*86400000);
    assert.equal((await upload()).status,401);
    const renewed=`hfa_session=${store.createSession(user.id)}`;
    assert.equal((await upload(bytes,renewed)).status,200);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM uploaded_files').get().total,1);
    await new Promise(resolve=>server.close(resolve));
    store.close();store=new Store(database);
    const reopened=createApp(config,store,{}).listen(0,'127.0.0.1');
    await new Promise(resolve=>reopened.once('listening',resolve));
    try {
      const restored=await fetch(`http://127.0.0.1:${reopened.address().port}/api/files/${id}`,{headers:{Cookie:renewed}});
      assert.equal(restored.status,200);
      assert.deepEqual(Buffer.from(await restored.arrayBuffer()),bytes);
    } finally { await new Promise(resolve=>reopened.close(resolve)); }
  } finally { if(server.listening) await new Promise(resolve=>server.close(resolve));store.close();rmSync(directory,{recursive:true,force:true}); }
});

test('authenticated API blocks forged recipients, roles, origins and unconfigured verification', async () => {
  const store = new Store();
  const config = { origin: 'http://localhost:8080', ready: false, verifyToken: 'synthetic-verification-token', appSecret: 'synthetic-secret' };
  const provider = { webhook() {}, verification() { throw new Error('Must not run without configuration'); } };
  const app = createApp(config, store, provider);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, origin = config.origin) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
  });
  try {
    const registered = await request('/api/auth/register', { name: 'Synthetic Patient', email: 'patient@example.invalid', password: 'Synthetic-password-123', role: 'patient', whatsappNumber: '+237600000000', whatsappNotificationsConsent: true });
    assert.equal(registered.status, 201);
    const { user } = await registered.json();
    const cookie = registered.headers.get('set-cookie').split(';')[0];
    assert.match(registered.headers.get('set-cookie'), /HttpOnly/);
    assert.match(registered.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal(user.password, undefined);
    const event = { eventId: 'synthetic-event-one', patientId: user.id, resource: 'Appointments' };
    assert.equal((await request('/api/activities', event)).status, 401);
    const accepted = await request('/api/activities', event, cookie);
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).status, 'blocked_verification');
    assert.equal((await request('/api/activities', { ...event, patientId: 'forged-recipient' }, cookie)).status, 403);
    assert.equal((await request('/api/activities', { ...event, phone: '+237699999999' }, cookie)).status, 400);
    assert.equal((await request('/api/activities', event, cookie, 'https://attacker.invalid')).status, 403);
    assert.equal((await request('/api/whatsapp/verification', {}, cookie)).status, 503);
    assert.equal((await request('/api/auth/register', { name: 'Forged Admin', email: 'admin@example.invalid', password: 'Synthetic-password-123', role: 'admin' })).status, 400);
    assert.equal((await fetch(base + '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123')).status, 403);
    assert.equal((await fetch(base + '/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const doctor = store.createUser({ name: 'Synthetic Doctor', email: 'doctor@example.invalid', role: 'doctor' }, await hashPassword('Synthetic-password-123'), 'active');
    const doctorCookie = `hfa_session=${store.createSession(doctor.id)}`;
    assert.equal((await request('/api/activities', { ...event, eventId: 'doctor-event-unassigned' }, doctorCookie)).status, 403);
    store.updateUser(user.id, { assignedDoctor: doctor.id });
    assert.equal((await request('/api/activities', { ...event, eventId: 'doctor-event-assigned' }, doctorCookie)).status, 202);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

test('pharmacy orders reserve stock once and enforce ownership, expiry and prescription review',async()=>{
  const store=new Store(),config={origin:'http://localhost:8080',ready:false};
  const pharmacy=store.createUser({name:'Synthetic Pharmacy',email:'orders-pharmacy@example.invalid',role:'pharmacist',profile:{pharmacyValidatedAt:'test',pharmacyName:'Test Pharmacy'}},'unused','active');
  const patient=store.createUser({name:'Synthetic Buyer',email:'buyer@example.invalid',role:'patient'},'unused','active');
  const server=createApp(config,store,{}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,pc=`hfa_session=${store.createSession(pharmacy.id)}`,uc=`hfa_session=${store.createSession(patient.id)}`;
  const request=(path,body,cookie,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json','X-HFA-Request':'1',Origin:config.origin,Cookie:cookie},body:JSON.stringify(body)});
  try {
    const item={name:'Synthetic medicine',strength:'10 mg',unit:'Box',batch:'TEST-01',expiresOn:'2099-12-31',stock:5,price:2,requiresPrescription:true};
    assert.equal((await request('/api/pharmacy/items',item,uc)).status,403);
    assert.equal((await request('/api/pharmacy/items',{...item,expiresOn:'2020-01-01'},pc)).status,400);
    assert.equal((await request('/api/pharmacy/items',{...item,expiresOn:'2099-02-31'},pc)).status,400);
    const created=await request('/api/pharmacy/items',item,pc);assert.equal(created.status,201);const {id}=await created.json();
    const purchase={requestId:randomUUID(),itemId:id,quantity:2,method:'pickup',address:'Test pickup'};
    const ordered=await request('/api/pharmacy/orders',purchase,uc);assert.equal(ordered.status,201);const order=await ordered.json();
    assert.equal((await request('/api/pharmacy/orders',purchase,uc)).status,200);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(id).stock,3);
    assert.equal((await request('/api/pharmacy/orders',{...purchase,requestId:randomUUID(),quantity:4},uc)).status,409);
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'ready'},uc,'PATCH')).status,403);
    const unrelated=store.createUser({name:'Unrelated Pharmacy',email:'unrelated-pharmacy@example.invalid',role:'pharmacist',profile:{pharmacyValidatedAt:'test'}},'unused','active');
    const otherCookie=`hfa_session=${store.createSession(unrelated.id)}`;
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'ready',prescriptionReviewed:true},otherCookie,'PATCH')).status,404);
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'ready'},pc,'PATCH')).status,409);
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'ready',prescriptionReviewed:true},pc,'PATCH')).status,200);
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'cancelled'},pc,'PATCH')).status,200);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(id).stock,5);
    assert.equal((await request('/api/pharmacy/orders/'+order.id,{status:'cancelled'},pc,'PATCH')).status,409);
    store.db.prepare('UPDATE pharmacy_items SET expires_on=? WHERE id=?').run('2020-01-01',id);
    assert.equal((await request('/api/pharmacy/orders',{...purchase,requestId:randomUUID()},uc)).status,409);
    store.updateUser(pharmacy.id,{status:'suspended'});
    assert.equal((await request('/api/pharmacy/orders',{...purchase,requestId:randomUUID()},uc)).status,409);
  } finally {await new Promise(resolve=>server.close(resolve));store.close();}
});