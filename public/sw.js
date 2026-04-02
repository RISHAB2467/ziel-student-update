const CACHE_NAME = 'ziel-v10';
const ASSETS = [
    '/',
    '/index.html',
    '/teacher.html',
    '/styles.css',
    '/app-firestore.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/teacher.html'));
});