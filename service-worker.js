const CACHE_NAME='hfa-public-v9';
const ROOT=new URL('./',self.location.href);
// The page is stored under the directory URL: some hosts (Cloudflare) redirect /index.html to /.
const SHELL=['./','offline.js','offline-uploads.js','offline-session.js','pharmacist.js','assets/hfa-logo.svg'].map(path=>new URL(path,ROOT).href);
const INDEX=new URL('index.html',ROOT).href;

// Browsers refuse a redirected response for a page load (ERR_FAILED), so drop the redirect marker.
async function clean(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(),{status:response.status,statusText:response.statusText,headers:response.headers});
}

async function refreshPublicShell() {
  const cache=await caches.open(CACHE_NAME);
  const responses=await Promise.all(SHELL.map(async url=>{
    const response=await clean(await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)}));
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

self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if (request.method!=='GET' || url.origin!==ROOT.origin || url.search) return;
  const publicUrl=url.href===INDEX?ROOT.href:url.href;
  if (!SHELL.includes(publicUrl)) return;
  event.respondWith((async()=>{
    let cache=null;
    try {
      cache=await caches.open(CACHE_NAME);
      const saved=await cache.match(publicUrl);
      if (saved) return saved;
    } catch (error) { cache=null; } // storage unavailable: fall through to the network
    // Fetch by URL: re-sending a navigation Request with options throws a TypeError in browsers.
    const response=await clean(await fetch(publicUrl,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)}));
    if (response.ok && cache) cache.put(publicUrl,response.clone()).catch(()=>{});
    return response;
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