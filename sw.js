// sw.js
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Просто пропускаем все запросы (сеть)
    // В будущем здесь можно кэшировать ассеты для офлайн-режима
    event.respondWith(fetch(event.request));
});
