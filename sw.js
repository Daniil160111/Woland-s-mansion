/* Woland's Mansion — resilient offline/PWA service worker. */
const CACHE_NAME = 'woland-shell-v2';
const MEDIA_CACHE_NAME = 'woland-media-cache';
const SHELL_URLS = ['./', './index.html', './manifest.json', './sw.js', './icon/icon.jpg'];
const NETWORK_TIMEOUT_MS = 4000;

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function getCached(request) {
  // Match with the full request URL to keep project-site and subdirectory scopes isolated.
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
    // Keep installation resilient if an optional shell resource is temporarily unavailable.
    await Promise.all(SHELL_URLS.map(async (url) => {
      try {
        const response = await fetchWithTimeout(scopedUrl(url));
        if (response.ok) await cache.put(scopedUrl(url), response);
      } catch (error) {
        console.warn('[SW] Shell resource not cached:', url, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      // Do not delete the separate media cache populated by the game.
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
    // The existing HTML uses this legacy icon path; serve the repository's real JPEG icon.
    if (new URL(request.url).pathname.endsWith('/icon/name.png')) {
      const iconUrl = scopedUrl('./icon/icon.jpg');
      const iconRequest = new Request(iconUrl, { method: 'GET' });
      const cachedIcon = await getCached(iconRequest);
      if (cachedIcon) return cachedIcon;
      try {
        const iconResponse = await fetchWithTimeout(iconRequest);
        if (iconResponse.ok) return iconResponse;
      } catch (_) {}
    }

    const cached = await getCached(request);
    const isNavigation = request.mode === 'navigate';

    // Serve cached shell/media immediately; refresh successful responses in the background.
    if (cached && !isNavigation) {
      event.waitUntil(fetchWithTimeout(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
      }).catch(() => {}));
      return cached;
    }

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
