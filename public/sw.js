const CACHE_NAME = 'ziel-v15';
const ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/teacher.html',
    '/styles.css',
    '/app-firestore.js?v=154'
];

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') {
        return;
    }

    e.respondWith((async () => {
        const cachedResponse = await caches.match(e.request, { ignoreSearch: true });
        if (cachedResponse) {
            return cachedResponse;
        }

        try {
            return await fetch(e.request);
        } catch (error) {
            // Prevent unhandled promise rejections for navigation requests when offline/intermittent network.
            if (e.request.mode === 'navigate') {
                const fallback = await caches.match('/index.html');
                if (fallback) {
                    return fallback;
                }
            }

            return new Response('Network error while offline.', {
                status: 503,
                statusText: 'Service Unavailable'
            });
        }
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/teacher.html'));
});