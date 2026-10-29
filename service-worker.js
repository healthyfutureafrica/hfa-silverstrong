const CACHE_NAME='hfa-public-v40';
const ROOT=new URL('./',self.location.href);
// The page is stored under the directory URL: some hosts (Cloudflare) redirect /index.html to /.
const SHELL=['./','offline.js','offline-uploads.js','offline-session.js','pharmacist.js','hfa-numbering.js','i18n.js','hfa-ui.js','country-data.js','patient-registration.js','portal-access.js','security.js','hfa-fhir.js','privacy-centre.js','session-guard.js','clinical-sync.js','mobile-money.js','calls.js','real-world.js','governance-ui.js','hfa-triage.js','triage-assistant.js','ambulance.js','hfa-surveillance.js','hfa-ai-eval.js','ai-assist.js','ai-centre.js','nurse-workforce.js','earnings.js','validation.js','assets/hfa-logo.svg'].map(path=>new URL(path,ROOT).href);
const INDEX=new URL('index.html',ROOT).href;

// Browsers released before 2022 have no AbortSignal.timeout.
function timeoutSignal(ms) {
  if (AbortSignal.timeout) return AbortSignal.timeout(ms);
  const controller=new AbortController();
  setTimeout(()=>controller.abort(),ms);
  return controller.signal;
}

// Browsers refuse a redirected response for a page load (ERR_FAILED), so drop the redirect marker.
async function clean(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(),{status:response.status,statusText:response.statusText,headers:response.headers});
}

async function refreshPublicShell() {
  const cache=await caches.open(CACHE_NAME);
  const responses=await Promise.all(SHELL.map(async url=>{
    const response=await clean(await fetch(url,{cache:'no-store',credentials:'omit',signal:timeoutSignal(8000)}));
    if (!response.ok) throw new Error('Public content unavailable');
    return {url,response};
  }));
  let changed=false;
  for (const {url,response} of responses) {
    const previous=await cache.match(url);
    if (previous && await previous.text()!==await response.clone().text()) changed=true;
  }
  for (const {url,response} of responses) await cache.put(url,response);
  return changed;
}

// Caching is best-effort: a browser whose storage is blocked or corrupted must still be able to
// install this worker, so a fixed version always replaces an older one.
self.addEventListener('install',event=>{
  event.waitUntil(refreshPublicShell().catch(()=>{}).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const name of await caches.keys()) {
      if (name.startsWith('hfa-public-') && name!==CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// How long a page load waits for the network before showing the saved copy instead.
let NETWORK_GRACE=3000;

// Network first: online visitors always get the current files, so a bad saved copy can never block
// the site. The saved copy is used only offline, when the server fails, or when the network is slow.
async function respond(publicUrl) {
  let cache=null;
  try { cache=await caches.open(CACHE_NAME); } catch (error) {} // storage unavailable: network only
  const saved=cache?cache.match(publicUrl).catch(()=>undefined):Promise.resolve(undefined);
  // Fetch by URL: re-sending a navigation Request with options throws a TypeError in browsers.
  const network=fetch(publicUrl,{cache:'no-store',credentials:'same-origin',signal:timeoutSignal(15000)}).then(clean).then(response=>{
    if (response.ok && cache) cache.put(publicUrl,response.clone()).catch(()=>{});
    return response;
  });
  network.catch(()=>{});
  const slow=new Promise(resolve=>setTimeout(resolve,NETWORK_GRACE));
  const first=await Promise.race([network.then(response=>({response}),error=>({error})),slow.then(()=>({slow:true}))]);
  if (first.response?.ok) return first.response;
  const copy=await saved;
  if (copy) return copy;
  if (first.response) return first.response;
  return network; // nothing saved: wait for the network (or its error)
}

self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if (request.method!=='GET' || url.origin!==ROOT.origin || url.search) return;
  const publicUrl=url.href===INDEX?ROOT.href:url.href;
  if (!SHELL.includes(publicUrl)) return;
  // Safety net: if anything above fails, load the page exactly as if there were no service worker.
  event.respondWith(respond(publicUrl).catch(()=>fetch(request)));
});

self.addEventListener('message',event=>{
  if (event.data?.type!=='REFRESH_PUBLIC') return;
  event.waitUntil((async()=>{
    try {
      const changed=await refreshPublicShell();
      event.source?.postMessage({type:'PUBLIC_REFRESHED',changed});
    } catch (error) {
      event.source?.postMessage({type:'PUBLIC_REFRESH_FAILED'});
    }
  })());
});