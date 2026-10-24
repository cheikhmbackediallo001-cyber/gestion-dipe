/**
 * SERVICE WORKER - GESTION PRÉSCOLAIRE
 * Stratégie Network-First intégrale pour garantir l'arrivée immédiate des mises à jour sur mobile
 * et fonctionnement hors-ligne fiable (PWA).
 */

const CACHE_NAME = 'gestion-prescolaire-v20261024_v4';

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
  './js/html2canvas.min.js',
  './js/app.js',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/logo.png'
];

// ------------------------------------------------------------------------------
// 1. INSTALLATION : Préchargement avec contournement du cache HTTP
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
// 2. ACTIVATION : Purge agressive des anciens caches & prise de contrôle immédiate
// ------------------------------------------------------------------------------
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache PWA :', key);
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
// 4. INTERCEPTION DES REQUÊTES (FETCH)
// ------------------------------------------------------------------------------
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ignorer requêtes non-GET et requêtes externes (Supabase, API tierces)
  if (e.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // ============================================================================
  // A. PAGES HTML / NAVIGATION : NETWORK FIRST (Réseau d'abord avec timeout)
  // Lorsque l'utilisateur actualise sur téléphone, il reçoit TOUJOURS le nouveau code !
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
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const networkResponse = await fetch(e.request, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
          });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            return networkResponse;
          }
        } catch (netErr) {
          console.warn('[SW] Réseau indisponible ou lent, secours sur cache pour :', url.pathname);
        }

        // Si le réseau a échoué ou timeout : secours sur le cache local
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
  // B. SCRIPTS JS & FEUILLES CSS : NETWORK FIRST
  // Assure que toute mise à jour de code javascript ou style s'applique dès l'actualisation
  // ============================================================================
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(e.request, {
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            return networkResponse;
          }
        } catch (netErr) {
          // Hors-ligne : bascule sur le cache
        }

        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;

        const cleanName = url.pathname.split('/').pop();
        const folder = url.pathname.includes('/css/') ? 'css/' : 'js/';
        const fallback = await caches.match('./' + folder + cleanName, { ignoreSearch: true });
        if (fallback) return fallback;

        return Response.error();
      })()
    );
    return;
  }

  // ============================================================================
  // C. WEB MANIFEST : Toujours Network-First pour les métadonnées PWA
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
  // D. IMAGES ET ICÔNES STATIQUES : Cache First avec mise en cache
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
