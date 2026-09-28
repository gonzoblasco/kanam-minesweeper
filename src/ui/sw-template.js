// src/ui/sw-template.js
// Service Worker template - placeholders are replaced by the Vite plugin.
// Do NOT edit the placeholders directly; the plugin substitutes them with
// the actual precache list and version during the build.

self.__precacheManifest = [];
self.__cacheVersion = "";

self.addEventListener('install', (event) => {
  // Pre-cache all assets.
  event.waitUntil(
    caches.open('precache-' + self.__cacheVersion).then((cache) => cache.addAll(self.__precacheManifest))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Offline fallback for navigation requests.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Cache-first strategy for other assets.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
