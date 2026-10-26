/**
 * SERVICE WORKER - GESTION PRÉSCOLAIRE
 * - Stratégie hybride haute vitesse : ouverture instantanée sur smartphone (< 100ms)
 * - Navigation Fast-Network (timeout 800ms) avec fallback immédiat sur cache
 * - Scripts & Styles en Stale-While-Revalidate pour zéro temps d'attente
 * - Prise de contrôle automatique et purge des anciens caches
 */

const CACHE_NAME = 'gestion-prescolaire-v20261026_v3';

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
  './css/datepicker.css',
  './js/config.js',
  './js/utils.js',
  './js/datepicker.js',
  './js/stamp.js',
  './js/supabase.js',
  './js/auth.js',
  './js/demo-data.js',
  './js/store.js',
  './js/cloud-sync.js',
  './js/landing.js',
  './js/onboarding.js',
  './js/html2canvas.min.js',
  './js/app.js',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable-512.png',
  './images/apple-touch-icon.png',
  './images/logo.png'
];

// ------------------------------------------------------------------------------
// 1. INSTALLATION : Préchargement des fichiers essentiels sans bloquer
// ------------------------------------------------------------------------------
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
    })
  );
});

// ------------------------------------------------------------------------------
// 2. ACTIVATION : Suppression immédiate des anciens caches et prise de contrôle
// ------------------------------------------------------------------------------
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purge ancien cache PWA :', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------------------
// 3. MESSAGES : Communication inter-processus (Purge manuelle & Skip Waiting)
// ------------------------------------------------------------------------------
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'PURGE_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => {
      if (e.ports && e.ports[0]) {
        e.ports[0].postMessage({ success: true });
      }
    });
  }
});

// ------------------------------------------------------------------------------
// 4. INTERCEPTION DES REQUÊTES (FETCH HAUTE VITESSE MOBILE)
// ------------------------------------------------------------------------------
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ignorer requêtes non-GET et requêtes externes (Supabase, API tierces) : jamais mises en cache
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // ============================================================================
  // A. PAGES HTML / NAVIGATION : FAST NETWORK (Timeout 800ms) AVEC REPLI CACHE ULTRA-RAPIDE
  // Si le réseau cellulaire mobile est lent, l'app s'affiche instantanément depuis le cache
  // ============================================================================
  if (
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/app') ||
    url.pathname.endsWith('/verify')
  ) {
    e.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 800); // 800ms max

          const networkResponse = await fetch(e.request, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
          });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            const cacheKey = url.origin + url.pathname; // sans « ?token=... »
            caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, clone));
            return networkResponse;
          }
        } catch (netErr) {
          // Timeout ou hors-ligne : bascule immédiate sur le cache local
        }

        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;

        if (url.pathname.includes('app')) {
          const appCached = await caches.match('./app.html');
          if (appCached) return appCached;
        }
        if (url.pathname.includes('verify')) {
          const verifyCached = await caches.match('./verify.html');
          if (verifyCached) return verifyCached;
        }
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      })()
    );
    return;
  }

  // ============================================================================
  // B. SCRIPTS JS & STYLES CSS : STALE-WHILE-REVALIDATE (Ouverture instantanée < 20ms)
  // Renvoie immédiatement la ressource en cache pour un affichage instantané,
  // tout en mettant à jour le cache en arrière-plan.
  // ============================================================================
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(e.request, { headers: { 'Cache-Control': 'no-cache' } })
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        // Si déjà en cache, renvoi immédiat sans aucun délai réseau
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // ============================================================================
  // C. WEB MANIFEST : Network First
  // ============================================================================
  if (url.pathname.endsWith('.webmanifest')) {
    e.respondWith(
      fetch(e.request, { headers: { 'Cache-Control': 'no-cache' } })
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            return res;
          }
          return caches.match(e.request, { ignoreSearch: true });
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  // ============================================================================
  // D. IMAGES ET ICÔNES STATIQUES : Cache-First
  // ============================================================================
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
