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

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [500, 100, 500]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
