/* =====================================================================
   Woland's Mansion — Service Worker
   Путь: ./sw.js

   Задачи:
   1) Пройти критерий устанавливаемости PWA (Chrome/Edge/Samsung Internet):
      — зарегистрирован
      — активен (activate)
      — имеет обработчик fetch
   2) Не ломать офлайн-логику игры: игра сама кэширует медиа
      через localStorage (CACHE_PREFIX = 'woland_asset_').
   3) Дать минимальный app-shell кэш, чтобы при отсутствии сети
      index.html / manifest.json / sw.js всё же открывались.
   ===================================================================== */

const SW_VERSION   = 'v1.0.0';
const CACHE_SHELL  = 'woland-shell-' + SW_VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
];

/* ---------- install ---------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_SHELL);
        await Promise.all(
          SHELL_ASSETS.map(async (url) => {
            try {
              const resp = await fetch(url, { cache: 'reload' });
              if (resp && resp.ok) await cache.put(url, resp.clone());
            } catch (e) {}
          })
        );
      } catch (e) {}
    })()
  );
});

/* ---------- activate ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_SHELL ? caches.delete(k) : null))
      );
      await self.clients.claim();
    })()
  );
});

/* ---------- fetch ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(CACHE_SHELL);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;

        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }

        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});

/* ---------- message ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
