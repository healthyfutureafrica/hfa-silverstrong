(() => {
  const copy={
    en:{offline:'Offline - Free Health Hub and SLY remain available. Account changes, consultations and payments need a connection.',ready:'Offline Health Hub ready',preparing:'Preparing offline Health Hub...',unsupported:'Offline reopening needs HTTPS and a supported browser.',failed:'Offline content could not be saved. Reconnect and try again.',refreshing:'Connected - checking for updated health content...',update:'Updated health content is ready. Reload when you have finished your current work.',reload:'Reload',retry:'Retry'},
    fr:{offline:'Hors ligne - Espace Sant\u00e9 et SLY restent disponibles. Comptes, consultations et paiements n\u00e9cessitent une connexion.',ready:'Espace Sant\u00e9 disponible hors ligne',preparing:'Pr\u00e9paration de l\u0027Espace Sant\u00e9 hors ligne...',unsupported:'La r\u00e9ouverture hors ligne n\u00e9cessite HTTPS et un navigateur compatible.',failed:'Impossible de sauvegarder le contenu hors ligne. Reconnectez-vous et r\u00e9essayez.',refreshing:'Connexion r\u00e9tablie - recherche de contenu de sant\u00e9 actualis\u00e9...',update:'Du contenu actualis\u00e9 est disponible. Rechargez apr\u00e8s avoir termin\u00e9 votre travail.',reload:'Recharger',retry:'R\u00e9essayer'}
  };
  let registration=null, status='preparing', updateAvailable=false, attempts=0;
  const banner=document.createElement('div');
  banner.className='offline-status';
  banner.setAttribute('role','status');
  const text=document.createElement('span'), action=document.createElement('button');
  action.type='button'; action.className='btn bs bsm';
  const actions=document.createElement('div'),files=document.createElement('button');
  actions.className='offline-actions';files.type='button';files.className='btn bs bsm';
  files.addEventListener('click',()=>OfflineUploads.open());
  const country=document.createElement('select');
  country.id='price-country';country.className='price-country';
  const countries=[['OTHER','Outside CEMAC / Hors CEMAC'],['CM','Cameroon / Cameroun'],['CF','Central African Republic / Centrafrique'],['TD','Chad / Tchad'],['CG','Republic of the Congo / Congo'],['GQ','Equatorial Guinea / Guinée équatoriale'],['GA','Gabon']];
  for (const [code,name] of countries) {
    const option=document.createElement('option');option.value=code;option.textContent=name;country.append(option);
  }
  country.value=priceCountry();
  const modal=document.getElementById('movr');
  new MutationObserver(()=>{country.disabled=!modal.classList.contains('hid');}).observe(modal,{attributes:true,attributeFilter:['class']});
  country.addEventListener('change',()=>{
    try {localStorage.setItem('hfa-price-country',country.value);} catch(error) {alert('Country preference could not be saved');return;}
    updateStaticHTML();
    if (typeof CU!=='undefined'&&CU&&!document.getElementById('app-wrap').classList.contains('hid')) navigate(CP);
    render();
  });
  actions.append(country,files,action);banner.append(text,actions); document.body.prepend(banner);

  function render() {
    const labels=copy[typeof LANG!=='undefined'?LANG:'en']||copy.en;
    const offline=navigator.onLine===false;
    text.textContent=labels[offline?'offline':updateAvailable?'update':status];
    banner.dataset.offline=String(offline);
    action.hidden=offline||(!updateAvailable&&status!=='failed');
    action.textContent=labels[updateAvailable?'reload':'retry'];
    files.textContent=typeof LANG!=='undefined'&&LANG==='fr'?'Fichiers hors ligne':'Offline files';
    country.setAttribute('aria-label',typeof LANG!=='undefined'&&LANG==='fr'?'Pays actuel pour les prix':'Current country for prices');
    country.title=priceCurrency()==='XAF'?'USD 1 = XAF 600':'Prices in USD';
  }

  async function reconnect() {
    if (navigator.onLine===false) { render(); return; }
    if (!registration) { await setup(); return; }
    attempts++;
    status='refreshing'; render();
    const worker=registration.active;
    if (worker) worker.postMessage({type:'REFRESH_PUBLIC'});
    else { status='failed'; render(); }
    registration.update().catch(()=>{});
    if (typeof ApiState!=='undefined') {
      if (ApiState.failed && !ApiState.enabled) {
        ApiState.failed=false;
        ApiState.ready=initializeBackend();
        await ApiState.ready;
      } else await refreshBackendNotifications();
    }
  }

  async function setup() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol==='file:') {
      status='unsupported'; render(); return;
    }
    try {
      registration=await navigator.serviceWorker.register(new URL('service-worker.js',document.baseURI),{updateViaCache:'none'});
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Offline preparation timed out')),12000);
        navigator.serviceWorker.ready.then(value=>{clearTimeout(timeout);resolve(value);},error=>{clearTimeout(timeout);reject(error);});
      });
      status='ready'; render();
      if (navigator.onLine!==false) registration.active?.postMessage({type:'REFRESH_PUBLIC'});
    } catch (error) { status='failed'; render(); }
  }

  action.addEventListener('click',()=>{
    if (updateAvailable) location.reload();
    else { attempts=0; reconnect(); }
  });
  window.addEventListener('online',()=>{attempts=0;reconnect();});
  window.addEventListener('offline',render);
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',event=>{
    if (event.data?.type==='PUBLIC_REFRESHED') {
      updateAvailable=updateAvailable||event.data.changed;
      status='ready'; render();
    } else if (event.data?.type==='PUBLIC_REFRESH_FAILED') {
      status='failed'; render();
      if (navigator.onLine!==false && attempts<3) setTimeout(reconnect,1500*attempts);
    }
  });
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});
  render(); setup();
})();