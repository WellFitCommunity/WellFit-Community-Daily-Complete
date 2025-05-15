// firebase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLsPYyUQa5WsIS06tKxMSUS7xsPfAF9Zk",
  authDomain: "wellfit-community.firebaseapp.com",
  projectId: "wellfit-community",
  storageBucket: "wellfit-community.firebasestorage.app",
  messagingSenderId: "669875280900",
  appId: "1:669875280900:web:8269859e1afc3fa4a96951",
  measurementId: "G-0CR22423HQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Safe messaging initialization
let messaging;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Firebase messaging not supported in this environment:", err);
  }
}

export { app, messaging };
