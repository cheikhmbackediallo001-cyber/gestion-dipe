/**
 * SERVICE WORKER - GESTION DIPE
 * Mise en cache intelligente pour fonctionnement PWA hors-ligne et chargement ultra-rapide
 */

const CACHE_NAME = 'gestion-dipe-v2';

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
  './js/demo-data.js',
  './js/store.js',
  './js/landing.js',
  './js/onboarding.js',
  './js/app.js',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/scene_arrival.jpg',
  './images/scene_payment.jpg',
  './images/scene_receipt.jpg',
  './images/preschool_hero.jpg',
  './images/director_portrait.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll avec tolérance aux erreurs individuelles
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn('[SW] Échec de mise en cache de:', url, err);
        }))
      );
    })
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
  const url = new URL(e.request.url);

  // Ignorer les requêtes non-GET et les requêtes Supabase / externes
  if (e.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Pour les pages de navigation HTML : Network first avec fallback cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Pour les assets statiques (CSS, JS, images) : Cache first avec fallback réseau
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // En arrière-plan, rafraîchir le cache (Stale-While-Revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
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
