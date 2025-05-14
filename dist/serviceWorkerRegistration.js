"use strict";
// src/serviceWorkerRegistration.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.unregister = exports.register = void 0;
// This file is based on the CRA PWA template.
// It registers the service worker produced in your build.
function register() {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
        const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
        navigator.serviceWorker
            .register(swUrl)
            .catch(error => console.error('SW registration failed:', error));
    }
}
exports.register = register;
function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.unregister());
    }
}
exports.unregister = unregister;
