/**
 * SERVICE WORKER - GESTION DIPE
 * Cache statique pour chargement instantané en 3G / consultation hors-ligne
 */

const CACHE_NAME = 'gestion-dipe-v1';
const STATIC_ASSETS = [
  './index.html',
  './app.html',
  './verify.html',
  './manifest.webmanifest',
  './css/design-system.css',
  './css/landing.css',
  './css/app.css',
  './css/receipt.css',
  './js/config.js',
  './js/utils.js',
  './js/stamp.js',
  './js/demo-data.js',
  './js/store.js',
  './js/landing.js',
  './js/onboarding.js',
  './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Stratégie Cache First avec Network Fallback pour les ressources statiques
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
