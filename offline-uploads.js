class UploadQueueStorage {
  constructor() { this.connection=null; }
  async open() {
    if (this.connection) return this.connection;
    this.connection=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('hfa-encrypted-uploads',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('accounts',{keyPath:'ownerId'});
        request.result.createObjectStore('files',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Close other app tabs and try again'));
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
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction(store,'readwrite');
      for (const record of records) {
        if (remove) transaction.objectStore(store).delete(record.id);
        else transaction.objectStore(store).put(record);
      }
      transaction.oncomplete=()=>resolve();
      transaction.onabort=()=>reject(transaction.error||new Error('Storage operation failed'));
      transaction.onerror=()=>reject(transaction.error);
    });
  }
}

class OfflineFileVault {
  constructor({storage=new UploadQueueStorage(),cryptography=crypto,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}) {
    this.storage=storage;this.crypto=cryptography;this.fetcher=fetcher;this.now=now;
    this.key=null;this.ownerId=null;this.syncing=false;
  }
  async derive(passphrase,salt) {
    const material=await this.crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
    return this.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async encrypt(key,bytes,context) {
    const iv=this.crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await this.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,bytes);
    return {iv,encrypted};
  }
  async decrypt(key,record,context) {
    return this.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(context)},key,record.encrypted);
  }
  async unlock(ownerId,passphrase,create=false) {
    if (this.syncing) throw new Error('Wait for synchronization to finish');
    if (!passphrase || passphrase.length<12) throw new Error('Use a device passphrase of at least 12 characters');
    let account=await this.storage.read('accounts',ownerId);
    if (!account && !create) throw new Error('No offline vault exists for that account');
    const salt=account?account.salt:this.crypto.getRandomValues(new Uint8Array(16));
    const key=await this.derive(passphrase,salt);
    if (account) {
      try { await this.decrypt(key,account.check,`${ownerId}:vault`); }
      catch (error) { throw new Error('Incorrect device passphrase'); }
    } else {
      account={ownerId,salt,check:await this.encrypt(key,new TextEncoder().encode('HFA offline vault'),`${ownerId}:vault`)};
      await this.storage.write('accounts',[account]);
    }
    this.key=key;this.ownerId=ownerId;
  }
  lock() { this.key=null;this.ownerId=null; }
  async entries(ownerId=this.ownerId) {
    return (await this.storage.read('files')).filter(record=>record.ownerId===ownerId).sort((first,second)=>first.queuedAt-second.queuedAt);
  }
  async stage(files,metadata={category:'Other',notes:'',relatedApptId:''}) {
    const ownerId=this.ownerId,key=this.key;
    if (!key || !ownerId) throw new Error('Unlock your offline file vault first');
    if (!files.length || files.length>20) throw new Error('Select between 1 and 20 files');
    const existing=await this.storage.read('files');
    if (existing.length+files.length>100 || existing.reduce((total,file)=>total+file.size,0)+files.reduce((total,file)=>total+file.size,0)>50*1024*1024) throw new Error('Offline storage limit reached (50 MB or 100 pending files)');
    const staged=[];
    for (const file of files) {
      if (!file.size || file.size>5*1024*1024) throw new Error('Each file must be between 1 byte and 5 MB');
      const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const prefix=new TextDecoder().decode(header);
      const accepted=prefix.startsWith('%PDF-') || header.slice(0,8).join(',')==='137,80,78,71,13,10,26,10' || (header[0]===255&&header[1]===216&&header[2]===255) || (prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP');
      if (!accepted) throw new Error('Only PDF, PNG, JPEG and WebP files are accepted');
      const details={...metadata,fileName:file.name};
      if (!file.name || file.name.length>180 || /[<>\u0000-\u001f/\\]/.test(file.name) || details.category.length>100 || details.notes.length>1000 || details.relatedApptId.length>100) throw new Error('File name or notes are too long or invalid');
      const id=this.crypto.randomUUID();
      staged.push({id,ownerId,size:file.size,queuedAt:this.now(),nextAttempt:0,attempts:0,status:'pending',
        metadata:await this.encrypt(key,new TextEncoder().encode(JSON.stringify(details)),`${ownerId}:${id}:metadata`),
        file:await this.encrypt(key,await file.arrayBuffer(),`${ownerId}:${id}:file`)});
    }
    if (this.ownerId!==ownerId || this.key!==key) throw new Error('Vault was locked before files could be saved');
    await this.storage.write('files',staged);
    return staged.length;
  }
  async details(record) {
    if (!this.key || record.ownerId!==this.ownerId) throw new Error('Unlock the correct account vault');
    return JSON.parse(new TextDecoder().decode(await this.decrypt(this.key,record.metadata,`${record.ownerId}:${record.id}:metadata`)));
  }
  async remove(id) {
    if (this.syncing) throw new Error('Wait for synchronization to finish');
    const record=await this.storage.read('files',id);
    if (!this.key || record?.ownerId!==this.ownerId) throw new Error('Unlock the correct account vault');
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
            if (receipt.id!==record.id || receipt.ownerId!==ownerId || receipt.status!=='stored') throw new Error('Invalid upload receipt');
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
    en:{title:'Offline files',account:'Account vault',passphrase:'Device passphrase (12+ characters)',consent:'Store encrypted file copies on this device',unlock:'Unlock / Set up',lock:'Lock vault',files:'Files (PDF, PNG, JPEG, WebP; up to 5 MB each)',category:'Category',notes:'Notes',save:'Save on device',sync:'Sync now',remove:'Remove pending file',close:'Close',pending:'Pending on this device',stored:'Server-confirmed files',locked:'Vault locked. Pending files are retained.',saved:'Files saved securely on this device.',warning:'Keep your device passphrase. It cannot be recovered. Pending files remain until confirmed by the server, but clearing browser data can delete them. Reopen this app and unlock to resume after days offline.',persisted:'Browser persistent storage granted.',bestEffort:'Browser storage is best-effort. Do not delete your original files.',signin:'Sign in to the original account to resume synchronization.',wrong:'A different account is signed in. Files were not sent.',unconfigured:'Server file encryption is not configured. Files remain pending.',offline:'Offline or server unavailable. Files remain pending.',synced:'All pending files are confirmed by the server.',retry:'Some files remain pending. Network failures retry automatically; rejected files need review.',newVault:'Sign in online before setting up a new account vault.',consentRequired:'Confirm encrypted storage on this device before setting up a vault.'},
    fr:{title:'Fichiers hors ligne',account:'Compte du coffre',passphrase:'Phrase secr\u00e8te du dispositif (12+ caract\u00e8res)',consent:'Conserver des copies chiffr\u00e9es sur cet appareil',unlock:'D\u00e9verrouiller / Configurer',lock:'Verrouiller',files:'Fichiers (PDF, PNG, JPEG, WebP ; 5 Mo maximum)',category:'Cat\u00e9gorie',notes:'Notes',save:'Enregistrer sur cet appareil',sync:'Synchroniser',remove:'Supprimer le fichier en attente',close:'Fermer',pending:'En attente sur cet appareil',stored:'Fichiers confirm\u00e9s par le serveur',locked:'Coffre verrouill\u00e9. Fichiers en attente conserv\u00e9s.',saved:'Fichiers enregistr\u00e9s et chiffr\u00e9s sur cet appareil.',warning:'Conservez la phrase secr\u00e8te : elle ne peut pas \u00eatre r\u00e9cup\u00e9r\u00e9e. Les fichiers restent en attente jusqu\u0027\u00e0 confirmation du serveur. Effacer les donn\u00e9es du navigateur peut les supprimer. Rouvrez et d\u00e9verrouillez pour reprendre apr\u00e8s plusieurs jours.',persisted:'Stockage persistant accord\u00e9 par le navigateur.',bestEffort:'Stockage non garanti par le navigateur. Conservez les fichiers originaux.',signin:'Connectez-vous au compte d\u0027origine pour reprendre.',wrong:'Un autre compte est connect\u00e9. Aucun fichier envoy\u00e9.',unconfigured:'Chiffrement des fichiers serveur non configur\u00e9. Fichiers conserv\u00e9s en attente.',offline:'Hors ligne ou serveur indisponible. Fichiers conserv\u00e9s.',synced:'Tous les fichiers sont confirm\u00e9s par le serveur.',retry:'Certains fichiers restent en attente. Les erreurs r\u00e9seau seront r\u00e9essay\u00e9es ; les rejets n\u00e9cessitent une v\u00e9rification.',newVault:'Connectez-vous en ligne avant de configurer un coffre.',consentRequired:'Confirmez le stockage chiffr\u00e9 sur cet appareil.'}
  };
  const words=()=>labels[typeof LANG!=='undefined'?LANG:'en']||labels.en;
  const field=id=>document.getElementById(id);
  let lastActivity=Date.now(),message='locked',storageMessage='',renderVersion=0;
  const notify=text=>{const status=field('vault-status');if(status)status.textContent=text;};

  async function renderFiles() {
    const version=++renderVersion,ownerId=vault.ownerId,key=vault.key;
    const list=field('vault-list'),cloud=field('vault-cloud');
    if (!list || !cloud) return;
    list.replaceChildren();cloud.replaceChildren();
    if (!vault.key) { notify(words().locked); return; }
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
    if (!vault.key || vault.syncing || navigator.onLine===false) return;
    const status=await vault.sync();
    message=({'wrong-account':'wrong',pending:'retry',locked:'locked'})[status]||status;
    await renderFiles();
  }

  async function open() {
    if (!window.isSecureContext || !('indexedDB' in window) || !crypto.subtle) throw new Error('Encrypted offline files need HTTPS or localhost and a supported browser');
    const text=words(),accounts=await vault.storage.read('accounts');
    openMo(`<div class="mh"><h3 class="mt2">${text.title}</h3></div>
      <p class="mu sm mb18">${text.warning}</p>
      <div class="fg"><label class="fl" for="vault-owner">${text.account}</label><select class="fc" id="vault-owner"></select></div>
      <div class="fg"><label class="fl" for="vault-passphrase">${text.passphrase}</label><input class="fc" type="password" id="vault-passphrase" minlength="12" autocomplete="off"></div>
      <label class="sm"><input type="checkbox" id="vault-consent"> ${text.consent}</label>
      <div class="vault-actions mt8"><button type="button" class="btn bp" id="vault-unlock">${text.unlock}</button><button type="button" class="btn bs" id="vault-lock">${text.lock}</button></div>
      <div class="fg mt18"><label class="fl" for="vault-files">${text.files}</label><input class="fc" id="vault-files" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple></div>
      <div class="fg"><label class="fl" for="vault-category">${text.category}</label><input class="fc" id="vault-category" maxlength="100" value="Other"></div>
      <div class="fg"><label class="fl" for="vault-notes">${text.notes}</label><textarea class="fc" id="vault-notes" maxlength="1000"></textarea></div>
      <div class="vault-actions"><button type="button" class="btn bp" id="vault-save">${text.save}</button><button type="button" class="btn bs" id="vault-sync">${text.sync}</button></div>
      <div id="vault-status" class="mu sm mt8" role="status"></div>
      <h4 class="sm mt18">${text.pending}</h4><div id="vault-list"></div>
      <h4 class="sm mt18">${text.stored}</h4><div id="vault-cloud"></div>
      <div class="mf"><button type="button" class="btn bs" id="vault-close">${text.close}</button></div>`);
    const accountSelect=field('vault-owner');
    const owners=new Set(accounts.map(account=>account.ownerId));
    if (typeof CU!=='undefined' && CU && ApiState.enabled && ApiState.authenticated) owners.add(CU.id);
    for (const ownerId of owners) {const option=document.createElement('option');option.value=ownerId;option.textContent=ownerId;accountSelect.append(option);}
    if (vault.ownerId) accountSelect.value=vault.ownerId;
    else if (typeof CU!=='undefined' && CU) accountSelect.value=CU.id;
    field('vault-close').addEventListener('click',closeMo);
    field('vault-lock').addEventListener('click',()=>{vault.lock();renderFiles().catch(error=>notify(error.message));});
    field('vault-unlock').addEventListener('click',async()=>{
      const button=field('vault-unlock'),ownerId=accountSelect.value,passphrase=field('vault-passphrase').value;
      field('vault-passphrase').value='';button.disabled=true;
      try {
        if (!ownerId) throw new Error(text.newVault);
        const account=await vault.storage.read('accounts',ownerId);
        if (!account) {
          if (!field('vault-consent').checked) throw new Error(text.consentRequired);
          const session=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
          if (!session.ok || (await session.json()).user.id!==ownerId) throw new Error(text.newVault);
        }
        await vault.unlock(ownerId,passphrase,!account);lastActivity=Date.now();
        const persistent=await navigator.storage?.persist?.().catch(()=>false);
        storageMessage=text[persistent?'persisted':'bestEffort'];
        message='saved';await renderFiles();await synchronize();
      } catch(error) {notify(error.message);}
      finally {button.disabled=false;}
    });
    field('vault-save').addEventListener('click',async()=>{
      const button=field('vault-save');button.disabled=true;
      try {
        await vault.stage(Array.from(field('vault-files').files),{category:field('vault-category').value,notes:field('vault-notes').value,relatedApptId:''});
        field('vault-files').value='';message='saved';await renderFiles();await synchronize();
      } catch(error) {notify(error.message);}
      finally {button.disabled=false;}
    });
    field('vault-sync').addEventListener('click',()=>synchronize().catch(error=>notify(error.message)));
    await renderFiles();
  }

  globalThis.OfflineUploads={open:()=>open().catch(error=>alert(error.message)),lock:()=>{vault.lock();renderFiles().catch(()=>{});}};
  window.addEventListener('online',()=>synchronize().catch(()=>{}));
  window.addEventListener('hfa-session',()=>{
    if (vault.ownerId && (typeof CU==='undefined' || CU?.id!==vault.ownerId)) {vault.lock();renderFiles().catch(()=>{});}
    else synchronize().catch(()=>{});
  });
  window.addEventListener('pointerdown',()=>{lastActivity=Date.now();});
  window.addEventListener('keydown',()=>{lastActivity=Date.now();});
  setInterval(()=>{
    if (Date.now()-lastActivity>15*60000) {vault.lock();renderFiles().catch(()=>{});return;}
    synchronize().catch(()=>{});
  },30000);
})();