// public/firebase-messaging-sw.js

// public/firebase-messaging-sw.js

// IMPORTANT:
// The placeholder values below (e.g., "%REACT_APP_FIREBASE_API_KEY%")
// MUST be replaced with actual Firebase configuration values during the build process
// or by Vercel's environment variable substitution if available for public static files.
// Do not deploy this file with these placeholders as strings.

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDLsPYyUQa5WsIS06tKxMSUS7xsPfAF9Zk",
  authDomain: "wellfit-community.firebaseapp.com",
  projectId: "wellfit-community",
  storageBucket: "wellfit-community.firebasestorage.app",
  messagingSenderId: "669875280900",
  appId: "1:669875280900:web:8269859e1afc3fa4a96951",
  measurementId: "G-0CR22423HQ"
};

// Check if all required config values are present (after potential replacement)
if (firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith('%REACT_APP_')) {
  console.error('Firebase SW Error: Firebase config placeholders not replaced. Notifications will not work.');
} else {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new message.',
      icon: '/android-chrome-192x192.png' // Ensure this icon exists in /public
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

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
