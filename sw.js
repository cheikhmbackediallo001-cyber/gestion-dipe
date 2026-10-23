/**
 * SERVICE WORKER - GESTION DIPE
 * Mise en cache intelligente pour fonctionnement PWA hors-ligne et chargement ultra-rapide
 */

const CACHE_NAME = 'gestion-prescolaire-v20261023_v1';

const STATIC_ASSETS = [
  './',
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
  './js/supabase.js',
  './js/auth.js',
  './js/demo-data.js',
  './js/store.js',
  './js/landing.js',
  './js/onboarding.js',
  './js/app.js',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/logo.png'
];

self.addEventListener('install', (e) => {
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
  const url = new URL(e.request.url);

  // Ignorer les requêtes non-GET et les requêtes Supabase / externes
  if (e.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Pour les pages HTML, scripts JS et styles CSS : Toujours Network First avec cache fallback
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then((res) => res || (e.request.mode === 'navigate' ? caches.match('./index.html') : null)))
    );
    return;
  }

  // Pour les images et fonts : Cache first avec fallback réseau
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        return response;
      });
    })
  );
});
