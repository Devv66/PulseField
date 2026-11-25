const CACHE_PREFIX = 'pulsefield-';
const CACHE = 'pulsefield-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pulsefield-mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always ask the network for the latest app shell. Fall back to the last
  // successfully cached HTML document only when the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match('/index.html'))
          || Response.error();
      }
    })());
    return;
  }

  const isShellAsset = url.pathname === '/manifest.webmanifest'
    || url.pathname === '/pulsefield-mark.svg';
  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (!isShellAsset && !isHashedAsset) return;

  // Hashed Vite assets are immutable. Cache successful responses only, and
  // never substitute index.html for a missing script, stylesheet, or icon.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
