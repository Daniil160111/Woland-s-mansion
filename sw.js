/* =====================================================================
   Woland's mansion — Service Worker (минимальный)
   Путь: sw.js (корневая папка)

   Задача: пройти критерий устанавливаемости PWA в Chrome на Android.
   Без него Chrome не создаёт WebAPK и открывает сайт как вкладку.

   Никакой кастомной логики кэширования — игра сама кэширует медиа
   через IndexedDB. Service Worker только регистрируется и слушает fetch.
   ===================================================================== */

self.addEventListener('install', (event) => {
  // Активируемся сразу, не ждём закрытия вкладок
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Берём контроль над всеми открытыми вкладками
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Пропускаем все запросы напрямую в сеть, сообщая браузеру о наличии действующего fetch-обработчика для PWA
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
