// Offline accounts. After one online sign-in, a device can sign in and keep working without a
// connection for OFFLINE_DAYS since it last reached the server. Work is kept in an encrypted
// snapshot; changes and registrations made offline are queued and sent when the server is reachable.
const OFFLINE_DAYS=7,OFFLINE_LIMIT=OFFLINE_DAYS*86400000;

class OfflineSession {
  constructor({storage=new UploadQueueStorage('hfa-offline-session',[['profiles','userId'],['outbox','id'],['registrations','id']]),cryptography=crypto,now=()=>Date.now()}={}) {
    this.storage=storage;this.crypto=cryptography;this.now=now;this.active=null;
  }
  async verifier(password,salt) {
    const material=await this.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    return new Uint8Array(await this.crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,256));
  }
  newKey() { return this.crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
  async seal(key,value,context) {
    const iv=this.crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await this.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,new TextEncoder().encode(JSON.stringify(value)));
    return {iv,encrypted};
  }
  async open(key,record,context) {
    return JSON.parse(new TextDecoder().decode(await this.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(context)},key,record.encrypted)));
  }
  // Online password sign-in: (re)create the offline verifier and keep the account's device key.
  async remember(user,password) {
    const existing=await this.storage.read('profiles',user.id),salt=this.crypto.getRandomValues(new Uint8Array(16));
    const profile={userId:user.id,email:user.email.toLowerCase(),salt,verifier:await this.verifier(password,salt),key:existing?.key||await this.newKey(),snapshot:existing?.snapshot||null,lastOnlineAt:this.now()};
    await this.storage.write('profiles',[profile]);
    return this.active=profile;
  }
  // Server session restored without a password: only accounts already set up on this device resume.
  async resume(userId) {
    const profile=await this.storage.read('profiles',userId);
    if (!profile) return this.active=null;
    profile.lastOnlineAt=this.now();
    await this.storage.write('profiles',[profile]);
    return this.active=profile;
  }
  async signIn(email,password) {
    const profile=(await this.storage.read('profiles')).find(entry=>entry.email===email.trim().toLowerCase());
    if (!profile) throw new Error('offline_no_account');
    const candidate=await this.verifier(password,profile.salt);
    let difference=candidate.length^profile.verifier.length;
    for (let index=0;index<candidate.length;index++) difference|=candidate[index]^profile.verifier[index];
    if (difference) throw new Error('invalid_creds');
    if (this.now()-profile.lastOnlineAt>OFFLINE_LIMIT) throw new Error('offline_expired');
    return this.active=profile;
  }
  expired() { return !!this.active && this.now()-this.active.lastOnlineAt>OFFLINE_LIMIT; }
  forget() { this.active=null; }
  async saveSnapshot(data) {
    const profile=this.active;
    if (!profile) return;
    const snapshot=await this.seal(profile.key,data,`${profile.userId}:snapshot`);
    const stored=await this.storage.read('profiles',profile.userId);
    if (this.active!==profile || !stored) return;
    stored.snapshot=profile.snapshot=snapshot;
    await this.storage.write('profiles',[stored]);
  }
  async loadSnapshot() {
    const profile=this.active;
    return profile?.snapshot?this.open(profile.key,profile.snapshot,`${profile.userId}:snapshot`):null;
  }
  async enqueue(request) {
    const profile=this.active;
    if (!profile) throw new Error('offline_no_account');
    const id=this.crypto.randomUUID();
    await this.storage.write('outbox',[{id,ownerId:profile.userId,queuedAt:this.now(),payload:await this.seal(profile.key,request,`${profile.userId}:${id}:request`)}]);
  }
  async outbox(ownerId=this.active?.userId) {
    return (await this.storage.read('outbox')).filter(record=>record.ownerId===ownerId).sort((first,second)=>first.queuedAt-second.queuedAt);
  }
  // Replays queued requests in order. Stops at the first network, session or server failure so
  // later changes never overtake earlier ones; requests the server refuses are dropped and reported.
  async flush(send) {
    const profile=this.active,result={sent:0,failures:[],stopped:false};
    if (!profile) return result;
    for (const record of await this.outbox(profile.userId)) {
      if (this.active!==profile) {result.stopped=true;break;}
      const request=await this.open(profile.key,record.payload,`${profile.userId}:${record.id}:request`);
      try { await send(request); result.sent++; }
      catch (error) {
        if (!error.status||error.status===401||error.status===429||error.status>=500) {result.stopped=true;break;}
        result.failures.push(error.message);
      }
      await this.storage.write('outbox',[record],true);
    }
    return result;
  }
  async queueRegistration(path,payload) {
    const key=await this.newKey(),id=this.crypto.randomUUID();
    await this.storage.write('registrations',[{id,path,email:payload.email.toLowerCase(),queuedAt:this.now(),key,payload:await this.seal(key,payload,`${id}:registration`)}]);
    return id;
  }
  async submitRegistrations(send) {
    const results=[];
    const queued=(await this.storage.read('registrations')).sort((first,second)=>first.queuedAt-second.queuedAt);
    for (const record of queued) {
      const payload=await this.open(record.key,record.payload,`${record.id}:registration`);
      let outcome;
      try { outcome={ok:true,data:await send(record.path,payload)}; }
      catch (error) {
        if (!error.status||error.status===429||error.status>=500) break;
        outcome={ok:false,message:error.message};
      }
      await this.storage.write('registrations',[record],true); // the password and documents leave the device once answered
      results.push({email:record.email,...outcome});
    }
    return results;
  }
}

globalThis.OfflineSession=OfflineSession;

(() => {
  Object.assign(T.en,{offline_no_account:'This account has not signed in on this device yet. Connect to the internet for the first sign-in.',offline_expired:'You have been offline for more than 7 days. Connect to the internet and sign in again.',offline_registration_queued:'You are offline. Your registration and documents are saved securely on this device and will be submitted automatically when you reconnect.',offline_registration_submitted:'Saved registration for {email} was submitted.',offline_registration_failed:'Saved registration for {email} was refused: {reason}',offline_signin_to_sync:'Connection restored. Sign in again to synchronize your offline work.',offline_synced:'Connection restored. Your offline work has been synchronized.',offline_sync_failed:'Some offline changes were refused by the server: ',offline_storage_failed:'This browser could not save data for offline use.'});
  Object.assign(T.fr,{offline_no_account:'Ce compte ne s’est jamais connecté sur cet appareil. Connectez-vous à internet pour la première connexion.',offline_expired:'Vous êtes hors ligne depuis plus de 7 jours. Connectez-vous à internet et reconnectez-vous.',offline_registration_queued:'Vous êtes hors ligne. Votre inscription et vos documents sont enregistrés de façon sécurisée sur cet appareil et seront envoyés automatiquement à la reconnexion.',offline_registration_submitted:'L’inscription enregistrée pour {email} a été envoyée.',offline_registration_failed:'L’inscription enregistrée pour {email} a été refusée : {reason}',offline_signin_to_sync:'Connexion rétablie. Reconnectez-vous pour synchroniser votre travail hors ligne.',offline_synced:'Connexion rétablie. Votre travail hors ligne a été synchronisé.',offline_sync_failed:'Certaines modifications hors ligne ont été refusées par le serveur : ',offline_storage_failed:'Ce navigateur n’a pas pu enregistrer les données hors ligne.'});

  const session=new OfflineSession(),extras=new Map();
  const notice=text=>window.dispatchEvent(new CustomEvent('hfa-offline-notice',{detail:text}));
  const networkError=error=>!error?.status;
  const collections=()=>Object.keys(DB).filter(key=>key!=='users'&&Array.isArray(DB[key]));
  let reconnecting=false;

  function snapshot() {
    return {user:CU,users:DB.users,db:Object.fromEntries(collections().map(key=>[key,DB[key]])),extras:Object.fromEntries([...extras].map(([name,hook])=>[name,hook.save()]))};
  }
  function restore(data,includeUsers) {
    if (!data) return;
    for (const [key,value] of Object.entries(data.db||{})) if (Array.isArray(DB[key])&&Array.isArray(value)) DB[key]=value;
    for (const [name,value] of Object.entries(data.extras||{})) extras.get(name)?.load(value);
    if (includeUsers) {DB.users=data.users;CU=DB.users.find(user=>user.id===data.user.id)||data.user;}
  }
  async function save() {
    if (ApiState.enabled&&ApiState.authenticated&&CU&&session.active?.userId===CU.id) await session.saveSnapshot(snapshot());
  }
  async function activate(profile) {
    if (profile&&typeof OfflineUploads!=='undefined') await OfflineUploads.attach(profile.userId,profile.key);
  }

  async function flush() {
    if (ApiState.offline||!session.active) return;
    const result=await session.flush(request=>apiRequest(request.path,request.method,request.body,60000));
    if (result.failures.length) notice(t('offline_sync_failed')+result.failures.join('; '));
    if (result.sent&&CU&&['pharmacy','dashboard'].includes(CP)) navigate(CP);
  }

  async function afterOnlineLogin(user,password) {
    try {
      const profile=await session.remember(user,password);
      restore(await session.loadSnapshot(),false);
      await activate(profile);await flush();await save();
    } catch (error) { notice(t('offline_storage_failed')); }
  }
  async function afterSessionRestore(user) {
    try {
      const profile=await session.resume(user.id);
      if (!profile) return;
      restore(await session.loadSnapshot(),false);
      await activate(profile);await flush();await save();
    } catch (error) { notice(t('offline_storage_failed')); }
  }
  async function offlineLogin(email,password) {
    let profile,data;
    try { profile=await session.signIn(email,password);data=await session.loadSnapshot(); }
    catch (error) { throw new Error(t(error.message)===error.message?t('offline_storage_failed'):t(error.message)); }
    if (!data) {session.forget();throw new Error(t('offline_no_account'));}
    restore(data,true);
    ApiState.authenticated=true;ApiState.offline=true;
    await activate(profile);
    window.dispatchEvent(new Event('hfa-session'));
  }

  async function submitRegistration(path,payload) {
    if (!ApiState.offline) {
      try { return {data:await apiRequest(path,'POST',payload,120000)}; }
      catch (error) { if (!networkError(error)) throw error; }
    }
    await session.queueRegistration(path,payload);
    return {queued:true};
  }
  async function submitRegistrations() {
    // Patient registrations start a server session, so only submit while nobody is signed in here.
    if (!ApiState.enabled||ApiState.offline||CU) return;
    const results=await session.submitRegistrations(async(path,payload)=>{
      const data=await apiRequest(path,'POST',payload,120000);
      if (data.user?.status==='active') await apiRequest('/api/auth/logout','POST',{}).catch(()=>{});
      return data;
    });
    for (const result of results) notice((result.ok?t('offline_registration_submitted'):t('offline_registration_failed')).replace('{email}',result.email).replace('{reason}',result.message||''));
  }

  function endOfflineSession(message) {
    if (typeof OfflineUploads!=='undefined') OfflineUploads.lock();
    const email=CU?.email||'';
    session.forget();ApiState.authenticated=false;CU=null;SC=null;clear();
    goAuth('login');$('le').value=email;amsg(message,'i');
  }

  async function reconnect() {
    if (reconnecting||!ApiState.enabled) return;
    reconnecting=true;
    try {
      if (ApiState.offline) {
        const config=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(8000)}).catch(()=>null);
        if (!config?.ok) return;
        ApiState.providerConfigured=!!(await config.json().catch(()=>({}))).providerConfigured;
        ApiState.offline=false;
        if (CU) {
          await save();
          const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)}).catch(()=>null);
          if (!response) {ApiState.offline=true;return;}
          const data=response.ok?await response.json():null;
          if (!data||data.user.id!==CU.id) {endOfflineSession(t('offline_signin_to_sync'));return;}
          installBackendSession(data);
          await afterSessionRestore(data.user);
          notice(t('offline_synced'));navigate(CP);
        }
      } else if (CU) await flush();
      await submitRegistrations();
    } finally { reconnecting=false; }
  }

  function clear() {
    for (const key of collections()) DB[key]=[];
    for (const hook of extras.values()) hook.clear?.();
  }

  let saveTimer=null;
  const saveSoon=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(()=>{}),300);};

  globalThis.HFAOffline={
    afterOnlineLogin,afterSessionRestore,offlineLogin,submitRegistration,reconnect,save,saveSoon,clear,
    register:(name,hook)=>extras.set(name,hook),
    enqueue:request=>session.enqueue(request),
    signOut:async()=>{try {await save();} finally {session.forget();}}
  };

  window.addEventListener('online',()=>reconnect().catch(()=>{}));
  window.addEventListener('offline',()=>{if(ApiState.enabled)ApiState.offline=true;});
  window.addEventListener('pagehide',()=>{save().catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save().catch(()=>{});});
  ApiState.ready?.then(()=>submitRegistrations().catch(()=>{}));
  setInterval(()=>{
    if (ApiState.offline&&CU&&session.expired()) {save().finally(()=>endOfflineSession(t('offline_expired')));return;}
    save().catch(()=>{});
    if (ApiState.offline||!CU) reconnect().catch(()=>{});
  },20000);
})();
