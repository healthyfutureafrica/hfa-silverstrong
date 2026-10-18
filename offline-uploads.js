// Messages shown to the person, in their language when the site's translations are loaded (English otherwise).
const vaultText = message => (typeof tv === 'function' ? tv(message) : message);

class UploadQueueStorage {
  constructor(name='hfa-encrypted-uploads',stores=[['accounts','ownerId'],['files','id']]) { this.name=name;this.stores=stores;this.connection=null; }
  async open() {
    if (this.connection) return this.connection;
    this.connection=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(this.name,1);
      request.onupgradeneeded=()=>{
        for (const [store,keyPath] of this.stores) request.result.createObjectStore(store,{keyPath});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error(vaultText('Close other app tabs and try again')));
    });
    this.connection.onversionchange=()=>{this.connection.close();this.connection=null;};
    return this.connection;
  }
  async read(store,key) {
    const database=await this.open();
    return new Promise((resolve,reject)=>{
      const request=key===undefined?database.transaction(store).objectStore(store).getAll():database.transaction(store).objectStore(store).get(key);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async write(store,records,remove=false) {
    const database=await this.open();
    const keyPath=this.stores.find(([name])=>name===store)[1];
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction(store,'readwrite');
      for (const record of records) {
        if (remove) transaction.objectStore(store).delete(record[keyPath]);
        else transaction.objectStore(store).put(record);
      }
      transaction.oncomplete=()=>resolve();
      transaction.onabort=()=>reject(transaction.error||new Error(vaultText('Storage operation failed')));
      transaction.onerror=()=>reject(transaction.error);
    });
  }
}

// Encrypted on-device queue of files waiting for the server. The key is the signed-in
// account's device key (see offline-session.js), so files queue offline and upload by themselves.
class OfflineFileVault {
  constructor({storage=new UploadQueueStorage(),cryptography=crypto,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}) {
    this.storage=storage;this.crypto=cryptography;this.fetcher=fetcher;this.now=now;
    this.key=null;this.ownerId=null;this.syncing=false;
  }
  async encrypt(key,bytes,context) {
    const iv=this.crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await this.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,bytes);
    return {iv,encrypted};
  }
  async decrypt(key,record,context) {
    return this.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(context)},key,record.encrypted);
  }
  attach(ownerId,key) {
    if (this.syncing && ownerId!==this.ownerId) throw new Error(vaultText('Wait for synchronization to finish'));
    this.key=key;this.ownerId=ownerId;
  }
  lock() { this.key=null;this.ownerId=null; }
  async entries(ownerId=this.ownerId) {
    return (await this.storage.read('files')).filter(record=>record.ownerId===ownerId&&record.device).sort((first,second)=>first.queuedAt-second.queuedAt);
  }
  async stage(files,metadata={category:'Other',notes:'',relatedApptId:''}) {
    const ownerId=this.ownerId,key=this.key;
    if (!key || !ownerId) throw new Error(vaultText('Sign in to save files on this device'));
    if (!files.length || files.length>20) throw new Error(vaultText('Select between 1 and 20 files'));
    const existing=await this.storage.read('files');
    if (existing.length+files.length>100 || existing.reduce((total,file)=>total+file.size,0)+files.reduce((total,file)=>total+file.size,0)>50*1024*1024) throw new Error(vaultText('Offline storage limit reached (50 MB or 100 pending files)'));
    const staged=[];
    for (const file of files) {
      if (!file.size || file.size>5*1024*1024) throw new Error(vaultText('Each file must be between 1 byte and 5 MB'));
      const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const prefix=new TextDecoder().decode(header);
      const accepted=prefix.startsWith('%PDF-') || header.slice(0,8).join(',')==='137,80,78,71,13,10,26,10' || (header[0]===255&&header[1]===216&&header[2]===255) || (prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP');
      if (!accepted) throw new Error(vaultText('Only PDF, PNG, JPEG and WebP files are accepted'));
      const details={category:String(metadata.category||'Other').slice(0,100),notes:String(metadata.notes||'').slice(0,1000),relatedApptId:String(metadata.relatedApptId||'').slice(0,100),fileName:file.name};
      if (!file.name || file.name.length>180 || /[<>\u0000-\u001f/\\]/.test(file.name)) throw new Error(vaultText('File name is too long or invalid'));
      const id=this.crypto.randomUUID();
      staged.push({id,ownerId,device:true,size:file.size,queuedAt:this.now(),nextAttempt:0,attempts:0,status:'pending',
        metadata:await this.encrypt(key,new TextEncoder().encode(JSON.stringify(details)),`${ownerId}:${id}:metadata`),
        file:await this.encrypt(key,await file.arrayBuffer(),`${ownerId}:${id}:file`)});
    }
    if (this.ownerId!==ownerId || this.key!==key) throw new Error(vaultText('Signed out before files could be saved'));
    await this.storage.write('files',staged);
    return staged.length;
  }
  async details(record) {
    if (!this.key || record.ownerId!==this.ownerId) throw new Error(vaultText('Sign in to the account that saved this file'));
    return JSON.parse(new TextDecoder().decode(await this.decrypt(this.key,record.metadata,`${record.ownerId}:${record.id}:metadata`)));
  }
  async remove(id) {
    if (this.syncing) throw new Error(vaultText('Wait for synchronization to finish'));
    const record=await this.storage.read('files',id);
    if (!this.key || record?.ownerId!==this.ownerId) throw new Error(vaultText('Sign in to the account that saved this file'));
    await this.storage.write('files',[record],true);
  }
  async sync() {
    if (this.syncing || !this.key || !this.ownerId) return 'locked';
    this.syncing=true;
    const ownerId=this.ownerId,key=this.key;
    try {
      const session=await this.fetcher('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!session.ok) return 'signin';
      if ((await session.json()).user.id!==ownerId) return 'wrong-account';
      for (const record of await this.entries(ownerId)) {
        if (this.ownerId!==ownerId || this.key!==key) return 'locked';
        if (record.status==='conflict' || record.status==='rejected' || record.nextAttempt>this.now()) continue;
        try {
          const metadata=await this.details(record);
          const bytes=await this.decrypt(key,record.file,`${ownerId}:${record.id}:file`);
          if (this.ownerId!==ownerId || this.key!==key) return 'locked';
          const response=await this.fetcher(`/api/files/${record.id}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-HFA-Request':'1','X-HFA-File-Owner':ownerId,'X-HFA-File-Metadata':encodeURIComponent(JSON.stringify(metadata))},body:bytes,signal:AbortSignal.timeout(60000)});
          if (response.status===401) return 'signin';
          if (response.status===503) return 'unconfigured';
          if (response.ok) {
            const receipt=await response.json();
            if (receipt.id!==record.id || receipt.ownerId!==ownerId || receipt.status!=='stored') throw new Error(vaultText('Invalid upload receipt'));
            await this.storage.write('files',[record],true);
            continue;
          }
          record.status=response.status===409?'conflict':[400,403,413,415].includes(response.status)?'rejected':'pending';
        } catch (error) { record.status='pending'; }
        record.attempts++;
        record.nextAttempt=this.now()+Math.min(3600000,15000*2**Math.min(record.attempts,8));
        await this.storage.write('files',[record]);
      }
      return (await this.entries(ownerId)).length?'pending':'synced';
    } catch (error) { return 'offline'; }
    finally { this.syncing=false; }
  }
}

globalThis.OfflineFileVault=OfflineFileVault;

(() => {
  const vault=new OfflineFileVault();
  const labels={
    en:{title:'Offline files',files:'Files (PDF, PNG, JPEG, WebP; up to 5 MB each)',category:'Category',notes:'Notes',save:'Save on device',sync:'Sync now',remove:'Remove pending file',close:'Close',pending:'Waiting to upload from this device',stored:'Server-confirmed files',signedOut:'Sign in to save files on this device.',saved:'Files saved securely on this device.',warning:'Files you upload are encrypted on this device and sent to the server automatically when you are connected. You can keep working offline for up to 7 days. Clearing browser data deletes files that have not been uploaded yet.',persisted:'Browser persistent storage granted.',bestEffort:'Browser storage is best-effort. Do not delete your original files.',signin:'Sign in again to resume uploading.',wrong:'A different account is signed in. Files were not sent.',unconfigured:'Server file encryption is not configured. Files remain pending.',offline:'Offline or server unavailable. Files will upload when you reconnect.',synced:'All files are confirmed by the server.',retry:'Some files are still waiting. Network failures retry automatically; rejected files need review.',locked:'Sign in to save files on this device.'},
    fr:{title:'Fichiers hors ligne',files:'Fichiers (PDF, PNG, JPEG, WebP ; 5 Mo maximum)',category:'Catégorie',notes:'Notes',save:'Enregistrer sur cet appareil',sync:'Synchroniser',remove:'Supprimer le fichier en attente',close:'Fermer',pending:"En attente d'envoi depuis cet appareil",stored:'Fichiers confirmés par le serveur',signedOut:'Connectez-vous pour enregistrer des fichiers sur cet appareil.',saved:'Fichiers enregistrés et chiffrés sur cet appareil.',warning:"Les fichiers téléversés sont chiffrés sur cet appareil et envoyés automatiquement au serveur dès que vous êtes connecté. Vous pouvez travailler hors ligne jusqu'à 7 jours. Effacer les données du navigateur supprime les fichiers non encore envoyés.",persisted:'Stockage persistant accordé par le navigateur.',bestEffort:'Stockage non garanti par le navigateur. Conservez les fichiers originaux.',signin:"Reconnectez-vous pour reprendre l'envoi.",wrong:'Un autre compte est connecté. Aucun fichier envoyé.',unconfigured:'Chiffrement des fichiers serveur non configuré. Fichiers conservés en attente.',offline:'Hors ligne ou serveur indisponible. Envoi automatique à la reconnexion.',synced:'Tous les fichiers sont confirmés par le serveur.',retry:'Certains fichiers restent en attente. Les erreurs réseau seront réessayées ; les rejets nécessitent une vérification.',locked:'Connectez-vous pour enregistrer des fichiers sur cet appareil.'}
  };
  const words=()=>labels[typeof LANG!=='undefined'?LANG:'en']||labels.en;
  const field=id=>document.getElementById(id);
  let message='offline',storageMessage='',renderVersion=0;
  const notify=text=>{const status=field('vault-status');if(status)status.textContent=text;};

  async function renderFiles() {
    const version=++renderVersion,ownerId=vault.ownerId,key=vault.key;
    const list=field('vault-list'),cloud=field('vault-cloud');
    if (!list || !cloud) return;
    list.replaceChildren();cloud.replaceChildren();
    if (!vault.key) { notify(words().signedOut); return; }
    for (const record of await vault.entries()) {
      if (version!==renderVersion || vault.key!==key || vault.ownerId!==ownerId || !field('vault-list')) return;
      const metadata=await vault.details(record);
      if (version!==renderVersion || vault.key!==key || vault.ownerId!==ownerId) return;
      const row=document.createElement('div'),name=document.createElement('span'),remove=document.createElement('button');
      row.className='vault-row';
      name.textContent=`${metadata.fileName} - ${new Date(record.queuedAt).toLocaleDateString()} - ${record.status}`;
      remove.type='button';remove.className='btn bs bsm';remove.textContent=words().remove;remove.disabled=vault.syncing;
      remove.addEventListener('click',async()=>{try {await vault.remove(record.id);await renderFiles();}catch(error){notify(error.message);}});
      row.append(name,remove);list.append(row);
    }
    notify(`${words()[message]||message} ${storageMessage}`);
    if (navigator.onLine===false) return;
    try {
      const session=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!session.ok || (await session.json()).user.id!==ownerId) return;
      const response=await fetch('/api/files',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!response.ok) return;
      const files=(await response.json()).files;
      if (version!==renderVersion || vault.key!==key || vault.ownerId!==ownerId || !field('vault-cloud')) return;
      for (const file of files) {
        const link=document.createElement('a');link.className='vault-download';link.href=`/api/files/${encodeURIComponent(file.id)}`;link.textContent=file.fileName;cloud.append(link);
      }
    } catch (error) { return; }
  }

  async function synchronize() {
    if (!vault.key || vault.syncing || navigator.onLine===false || (typeof ApiState!=='undefined'&&ApiState.offline)) return;
    const status=await vault.sync();
    message=({'wrong-account':'wrong',pending:'retry'})[status]||status;
    await renderFiles();
  }

  async function queue(files,metadata) {
    await vault.stage(files,metadata);
    message='saved';
    synchronize().catch(()=>{});
  }

  async function open() {
    if (!window.isSecureContext || !('indexedDB' in window) || !crypto.subtle) throw new Error(vaultText('Encrypted offline files need HTTPS or localhost and a supported browser'));
    const text=words();
    openMo(`<div class="mh"><h3 class="mt2">${text.title}</h3></div>
      <p class="mu sm mb18">${text.warning}</p>
      <div class="fg mt18"><label class="fl" for="vault-files">${text.files}</label><input class="fc" id="vault-files" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple></div>
      <div class="fg"><label class="fl" for="vault-category">${text.category}</label><input class="fc" id="vault-category" maxlength="100" value="Other"></div>
      <div class="fg"><label class="fl" for="vault-notes">${text.notes}</label><textarea class="fc" id="vault-notes" maxlength="1000"></textarea></div>
      <div class="vault-actions"><button type="button" class="btn bp" id="vault-save">${text.save}</button><button type="button" class="btn bs" id="vault-sync">${text.sync}</button></div>
      <div id="vault-status" class="mu sm mt8" role="status"></div>
      <h4 class="sm mt18">${text.pending}</h4><div id="vault-list"></div>
      <h4 class="sm mt18">${text.stored}</h4><div id="vault-cloud"></div>
      <div class="mf"><button type="button" class="btn bs" id="vault-close">${text.close}</button></div>`);
    field('vault-close').addEventListener('click',closeMo);
    field('vault-save').addEventListener('click',async()=>{
      const button=field('vault-save');button.disabled=true;
      try {
        await queue(Array.from(field('vault-files').files),{category:field('vault-category').value,notes:field('vault-notes').value,relatedApptId:''});
        field('vault-files').value='';await renderFiles();
      } catch(error) {notify(error.message);}
      finally {button.disabled=false;}
    });
    field('vault-sync').addEventListener('click',()=>synchronize().catch(error=>notify(error.message)));
    await renderFiles();
  }

  async function attach(ownerId,key) {
    vault.attach(ownerId,key);
    const persistent=await navigator.storage?.persist?.().catch(()=>false);
    storageMessage=words()[persistent?'persisted':'bestEffort'];
    synchronize().catch(()=>{});
  }

  globalThis.OfflineUploads={
    open:()=>open().catch(error=>alert(error.message)),
    attach,queue,
    sync:()=>synchronize(),
    pending:async()=>vault.key?(await vault.entries()).length:0,
    lock:()=>{vault.lock();renderFiles().catch(()=>{});}
  };
  window.addEventListener('online',()=>synchronize().catch(()=>{}));
  window.addEventListener('hfa-session',()=>{
    if (vault.ownerId && (typeof CU==='undefined' || CU?.id!==vault.ownerId)) {vault.lock();renderFiles().catch(()=>{});}
    else synchronize().catch(()=>{});
  });
  setInterval(()=>synchronize().catch(()=>{}),30000);
})();
