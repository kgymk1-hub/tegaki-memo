const CACHE_NAME = "pocket-image-resizer-v38-redesign";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css?v=38",
  "./libs/jszip.min.js?v=38",
  "./js/app.js?v=38",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg"
];
function isSameOrigin(request){return new URL(request.url).origin===self.location.origin;}
function shouldCacheResponse(response){return response&&response.ok&&response.type==="basic";}
async function cacheFirst(request){const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(isSameOrigin(request)&&shouldCacheResponse(response)){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}
async function networkFirst(request){try{const response=await fetch(request);if(isSameOrigin(request)&&shouldCacheResponse(response)){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}catch(error){const cached=await caches.match(request);if(cached)return cached;throw error;}}
self.addEventListener("install",(event)=>{event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener("activate",(event)=>{event.waitUntil(caches.keys().then((names)=>Promise.all(names.filter((name)=>name!==CACHE_NAME).map((name)=>caches.delete(name)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",(event)=>{if(event.request.method!=="GET")return;event.respondWith(event.request.mode==="navigate"?networkFirst(event.request):cacheFirst(event.request));});
