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

  // Pour les pages HTML (navigation) : Cache First ou Fast Network avec timeout de 800ms
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        // Lancer la mise à jour réseau en arrière-plan
        const networkFetch = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkResponse;
        }).catch(() => null);

        // Si disponible en cache, servir instantanément (< 20ms)
        if (cachedResponse) {
          return cachedResponse;
        }

        // Sinon attendre le réseau avec fallback sur index.html
        return networkFetch.then((res) => res || caches.match('./index.html'));
      })
    );
    return;
  }

  // Pour les scripts JS et styles CSS : Stale-While-Revalidate (ouverture ultra-rapide)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkResponse;
        }).catch(() => null);

        // Renvoie immédiatement le cache si existant, sinon attend le réseau
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Pour les images, fonts et autres assets statiques : Cache First avec mise en cache
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
