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
  apiKey: "%REACT_APP_FIREBASE_API_KEY%",
  authDomain: "%REACT_APP_FIREBASE_AUTH_DOMAIN%",
  projectId: "%REACT_APP_FIREBASE_PROJECT_ID%",
  storageBucket: "%REACT_APP_FIREBASE_STORAGE_BUCKET%",
  messagingSenderId: "%REACT_APP_FIREBASE_MESSAGING_SENDER_ID%",
  appId: "%REACT_APP_FIREBASE_APP_ID%",
  measurementId: "%REACT_APP_FIREBASE_MEASUREMENT_ID%" // Optional
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
