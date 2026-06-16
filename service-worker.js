const CACHE_NAME = "tegaki-memo-v8-image-move";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=8",
  "./app.js?v=8",
  "./manifest.json",
  "./icons/icon.svg"
];
const NETWORK_FIRST_PATHS = new Set([
  "/",
  "/index.html",
  "/style.css",
  "/app.js"
]);

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function shouldCacheResponse(response) {
  return response && response.ok && response.type === "basic";
}

function isNetworkFirstRequest(request) {
  if (request.mode === "navigate") return true;

  const url = new URL(request.url);
  const fileName = url.pathname.split("/").pop();
  const path = fileName ? `/${fileName}` : "/";
  return NETWORK_FIRST_PATHS.has(path);
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (isSameOrigin(request) && shouldCacheResponse(networkResponse)) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (isSameOrigin(request) && shouldCacheResponse(networkResponse)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    isNetworkFirstRequest(event.request)
      ? networkFirst(event.request)
      : cacheFirst(event.request)
  );
});
