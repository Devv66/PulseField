const CACHE_PREFIX = 'pulsefield-';
const CACHE = 'pulsefield-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pulsefield-mark.svg'];

async function precacheBuildAssets(cache) {
  const indexUrl = new URL('/index.html', self.location.origin).href;
  const index = await cache.match(indexUrl);
  if (!index) return;

  const html = await index.text();
  const assets = new Set();
  const references = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);

  for (const reference of references) {
    const assetUrl = new URL(reference[1], self.location.origin);
    if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/assets/')) {
      assets.add(assetUrl.href);
    }
  }

  if (assets.size > 0) await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await precacheBuildAssets(cache);
    await self.skipWaiting();
  })());
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
