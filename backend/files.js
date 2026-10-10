const express = require('express');
const { z } = require('zod');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { digest } = require('./store');

const metadataSchema=z.object({
  fileName:z.string().min(1).max(180).regex(/^[^<>\u0000-\u001f/\\]+$/),
  category:z.string().max(100),notes:z.string().max(1000),relatedApptId:z.string().max(100)
}).strict();
const MAX_FILE=5*1024*1024;
const MAX_ACCOUNT=50*1024*1024;

function fileMime(bytes) {
  if (bytes.subarray(0,5).toString()==='%PDF-') return 'application/pdf';
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if (bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP') return 'image/webp';
  return null;
}

function filesConfigured(config) { return /^[a-f0-9]{64}$/i.test(config.fileEncryptionKey||''); }

function installFileRoutes(app,config,store,authenticated) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS uploaded_files (
    owner_id TEXT NOT NULL REFERENCES users(id), upload_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL, nonce BLOB NOT NULL, encrypted BLOB NOT NULL,
    tag BLOB NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(owner_id,upload_id)
  )`);
  const configured=(request,response,next)=>filesConfigured(config)?next():response.status(503).json({error:'Encrypted file storage is not configured'});
  const key=()=>Buffer.from(config.fileEncryptionKey,'hex');
  const decode=row=>{
    const decipher=createDecipheriv('aes-256-gcm',key(),row.nonce);
    decipher.setAAD(Buffer.from(`${row.owner_id}:${row.upload_id}`));
    decipher.setAuthTag(row.tag);
    return JSON.parse(Buffer.concat([decipher.update(row.encrypted),decipher.final()]).toString());
  };
  app.post('/api/files/:id',authenticated,configured,express.raw({type:'application/octet-stream',limit:'5mb'}),(request,response)=>{
    if (request.headers['x-hfa-file-owner']!==request.user.id) return response.status(403).json({error:'Sign in to the original upload account'});
    const uploadId=z.string().uuid().parse(request.params.id);
    let metadata;
    try { metadata=metadataSchema.parse(JSON.parse(decodeURIComponent(request.headers['x-hfa-file-metadata']||''))); }
    catch (error) { return response.status(400).json({error:'Invalid file metadata'}); }
    const bytes=request.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length>MAX_FILE) return response.status(400).json({error:'File must be between 1 byte and 5 MB'});
    const mime=fileMime(bytes);
    if (!mime) return response.status(400).json({error:'Only PDF, PNG, JPEG and WebP files are accepted'});
    const ownerId=request.user.id;
    const fingerprint=digest(JSON.stringify([metadata,digest(bytes)]));
    const prior=store.db.prepare('SELECT fingerprint,created_at FROM uploaded_files WHERE owner_id=? AND upload_id=?').get(ownerId,uploadId);
    if (prior) {
      if (prior.fingerprint!==fingerprint) return response.status(409).json({error:'Upload ID already belongs to different content'});
      return response.json({id:uploadId,ownerId,status:'stored',createdAt:prior.created_at});
    }
    const used=store.db.prepare('SELECT COALESCE(SUM(size),0) AS total FROM uploaded_files WHERE owner_id=?').get(ownerId).total;
    if (used+bytes.length>MAX_ACCOUNT) return response.status(413).json({error:'Account file storage limit reached'});
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),nonce);
    cipher.setAAD(Buffer.from(`${ownerId}:${uploadId}`));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify({metadata,content:bytes.toString('base64')})),cipher.final()]);
    const createdAt=new Date().toISOString();
    store.db.prepare('INSERT INTO uploaded_files VALUES (?,?,?,?,?,?,?,?,?)').run(ownerId,uploadId,fingerprint,nonce,encrypted,cipher.getAuthTag(),bytes.length,mime,createdAt);
    response.status(201).json({id:uploadId,ownerId,status:'stored',createdAt});
  });
  app.get('/api/files',authenticated,configured,(request,response)=>{
    const rows=store.db.prepare('SELECT * FROM uploaded_files WHERE owner_id=? ORDER BY created_at DESC').all(request.user.id);
    response.json({files:rows.map(row=>({id:row.upload_id,...decode(row).metadata,mime:row.mime,size:row.size,createdAt:row.created_at}))});
  });
  app.get('/api/files/:id',authenticated,configured,(request,response)=>{
    const row=store.db.prepare('SELECT * FROM uploaded_files WHERE owner_id=? AND upload_id=?').get(request.user.id,request.params.id);
    if (!row) return response.sendStatus(404);
    const file=decode(row);
    response.set('Content-Disposition',`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.metadata.fileName)}`);
    response.type(row.mime).send(Buffer.from(file.content,'base64'));
  });
}

module.exports={installFileRoutes,filesConfigured,fileMime};