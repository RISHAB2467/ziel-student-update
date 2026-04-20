importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyALyA_Yod2TKWonP_oSFehR6-tKq9xDC3I',
    authDomain: 'ziel-d0064.firebaseapp.com',
    projectId: 'ziel-d0064',
    storageBucket: 'ziel-d0064.firebasestorage.app',
    messagingSenderId: '249203765928',
    appId: '1:249203765928:web:391650d800d197d902c89d'
});

const messaging = firebase.messaging();

function buildReminderNotification(payload) {
    const notification = payload?.notification || {};
    const data = payload?.data || {};
    const title = notification.title || data.title || 'ZIEL Reminder';

    return {
        title,
        options: {
            body: notification.body || data.body || 'Please check your daily class data.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [500, 100, 500],
            tag: 'nagging-reminder',
            renotify: true,
            data
        }
    };
}

// 1. FORCE UPDATE: Kills the old worker immediately and takes control.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

messaging.onBackgroundMessage((payload) => {
    console.log('Received background message', payload);
    const built = buildReminderNotification(payload);

    // Return the promise so the browser knows a visible notification was shown.
    return self.registration.showNotification(built.title, built.options);
});

// Fallback for raw push events (PWA/device edge cases) to avoid Chrome generic message.
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        console.warn('Push payload parse failed, using defaults.', error);
    }

    const built = buildReminderNotification(payload);
    event.waitUntil(self.registration.showNotification(built.title, built.options));
});

// 3. CLICK HANDLER: Opens or focuses teacher dashboard on tap.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('teacher.html') && 'focus' in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow('/teacher.html');
            }

            return undefined;
        })
    );
});
