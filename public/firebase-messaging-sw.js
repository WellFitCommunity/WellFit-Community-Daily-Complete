// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "REACT_APP_FIREBASE_API_KEY",
  authDomain: "wellfit-community.firebaseapp.com",
  projectId: "wellfit-community",
  storageBucket: "wellfit-community.appspot.com",
  messagingSenderId: "669875280900",
  appId: "1:669875280900:web:8269859e1afc3fa4a96951",
  measurementId: "G-0CR22423HQ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-512x512.png' // Optional: path to your app icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
