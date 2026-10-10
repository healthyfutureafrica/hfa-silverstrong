const CACHE_NAME='hfa-public-v4';
const ROOT=new URL('./',self.location.href);
const SHELL=['index.html','offline.js','offline-uploads.js','pharmacist.js','assets/hfa-logo.svg'].map(path=>new URL(path,ROOT).href);

async function refreshPublicShell() {
  const cache=await caches.open(CACHE_NAME);
  const responses=await Promise.all(SHELL.map(async url=>{
    const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
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

self.addEventListener('install',event=>{
  event.waitUntil(refreshPublicShell().then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const name of await caches.keys()) {
      if (name.startsWith('hfa-public-') && name!==CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if (request.method!=='GET' || url.origin!==ROOT.origin || url.search) return;
  const publicUrl=url.href===ROOT.href?SHELL[0]:url.href;
  if (!SHELL.includes(publicUrl)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const saved=await cache.match(publicUrl);
    if (saved) return saved;
    try {
      const response=await fetch(request,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if (response.ok) { await cache.put(publicUrl,response.clone()); return response; }
      return response;
    } catch (error) {
      throw error;
    }
  })());
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