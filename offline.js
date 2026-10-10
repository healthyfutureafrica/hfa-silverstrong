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
  banner.append(text,action); document.body.prepend(banner);

  function render() {
    const labels=copy[typeof LANG!=='undefined'?LANG:'en']||copy.en;
    const offline=navigator.onLine===false;
    text.textContent=labels[offline?'offline':updateAvailable?'update':status];
    banner.dataset.offline=String(offline);
    action.hidden=offline||(!updateAvailable&&status!=='failed');
    action.textContent=labels[updateAvailable?'reload':'retry'];
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
      await navigator.serviceWorker.ready;
      status='ready'; render();
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