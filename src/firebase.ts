// ✅ File: src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: 'wellfit-community.firebaseapp.com',
  projectId: 'wellfit-community',
  storageBucket: 'wellfit-community.appspot.com',
  messagingSenderId: '669875280900',
  appId: '1:669875280900:web:8269859e1afc3fa4a96951',
  measurementId: 'G-0CR22423HQ',
};

const app = initializeApp(firebaseConfig);

let messaging;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn('Firebase messaging not supported:', err);
  }
}

export { app, messaging };

