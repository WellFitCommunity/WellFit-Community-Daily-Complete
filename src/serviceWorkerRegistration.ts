// src/serviceWorkerRegistration.ts

// This file is based on the CRA PWA template.
// It registers the service worker produced in your build.

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
      )
  );
  
  export function register() {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      navigator.serviceWorker
        .register(swUrl)
        .catch(error => console.error('SW registration failed:', error));
    }
  }
  
  export function unregister() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => reg.unregister());
    }
  }
  