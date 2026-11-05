/* Woland's Mansion — resilient offline/PWA service worker. */
const CACHE_NAME = 'woland-shell-v3';
const NETWORK_TIMEOUT_MS = 5000;

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function getCached(request) {
  return (await caches.match(request)) || (await caches.match(request.url));
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shell = ['./', './index.html', './manifest.json', './sw.js', './icon/icon.jpg'];
    await Promise.all(shell.map(async (path) => {
      const url = scopedUrl(path);
      try {
        const response = await fetchWithTimeout(url);
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        console.warn('[SW] Shell resource not cached:', path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      // Preserve game media cache, remove only older shell versions.
      if (key.startsWith('woland-shell-') && key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await getCached(request);
    const isNavigation = request.mode === 'navigate';
    if (cached && !isNavigation) return cached;

    try {
      const response = await fetchWithTimeout(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      if (isNavigation) {
        const shell = await getCached(new Request(scopedUrl('./index.html')));
        if (shell) return shell;
      }
      return new Response('Offline: resource is not available in the cache.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
