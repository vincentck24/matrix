// Operation Matrix — Service Worker
// Bump this version string whenever you deploy a change. Changing the name forces
// the old cache to be cleared on activate, so devices stop serving stale code.
const CACHE_NAME = 'matrix-cache-v3';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.svg'
];

// Install: pre-cache the shell and activate immediately (don't wait for old SW to die)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate: delete any old caches, then take control of open pages right away
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - HTML / navigations  -> NETWORK FIRST (so a fresh deploy shows up immediately,
//                           with cache as offline fallback)
//  - everything else     -> CACHE FIRST  (fast icons/assets; falls through to network)
// Cross-origin calls (Firebase, Tailwind CDN, Google Fonts) are not navigations and
// are never cached here, so they always hit the network and work normally.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET; let the browser deal with POST/PUT etc. (e.g. Firestore writes)
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then(response => response || fetch(req))
  );
});
