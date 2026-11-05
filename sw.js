/* =====================================================================
   Woland's Mansion — Service Worker (Исправленный)
   Путь: sw.js (в корневой папке рядом с index.html)
   ===================================================================== */

const CACHE_NAME = 'woland-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'manifest.json',
  'sw.js',
  'icon/name.png'
];

// Установка: кэшируем только критически важные файлы для PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        console.log('Один из файлов не кэшировался, но это не помешает установке.');
      });
    })
  );
});

// Активация: захватываем управление вкладками
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка запросов: отдаем из сети, при сбое — из кэша
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        // Если это переход на страницу, возвращаем index.html оффлайн
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
