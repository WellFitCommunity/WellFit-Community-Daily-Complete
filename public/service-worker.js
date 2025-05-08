// public/service-worker.js

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated');
  });
  
  self.addEventListener('fetch', (event) => {
    // This can be extended with caching later
  });
  