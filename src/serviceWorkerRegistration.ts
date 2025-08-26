// src/serviceWorkerRegistration.ts
export function register() {
  // Temporarily disabled to avoid conflicts with Firebase messaging SW.
  // Re-enable after push/PWA is finalized.
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  }
}
