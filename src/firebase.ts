// firebase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Your web app's Firebase configuration (this is your existing config)
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

// Initialize Firebase Cloud Messaging
const messaging = getMessaging(app);

export { app, messaging };
