/* sw.js */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Перехватываем запросы и отдаем из сети (или кэша)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
