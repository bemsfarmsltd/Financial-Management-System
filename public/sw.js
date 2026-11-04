// BEMS Attendance Kiosk Service Worker for PWA Desktop App
const CACHE_NAME = 'bems-kiosk-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Never cache API requests - always fetch live from network
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Pass-through network requests with fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

