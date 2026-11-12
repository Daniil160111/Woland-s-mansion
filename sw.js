/* sw.js */
const CACHE_NAME = 'woland-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Кэшируем только GET-запросы
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Скрипты, HTML и манифест всегда грузим из сети (с фолбэком на кэш при отсутствии сети)
  if (url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/' || 
      url.pathname.endsWith('load.json') || 
      url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Всё остальное (картинки, звуки, шрифты) кэшируем намертво
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Отдаем из кэша, если есть
      }

      return fetch(event.request).then((networkResponse) => {
        // Если ответ успешный, сохраняем в кэш
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        console.warn('[SW] Нет сети и нет в кэше:', event.request.url);
      });
    })
  );
});
