/*
  TalkChatt Service Worker — sw.js
  ──────────────────────────────────
  Required for PWA installability on Android Chrome.
  Strategy: Cache the wrapper shell, network-first for everything else.
*/

var CACHE_NAME = 'talkchatt-v1';

// Files to precache (the PWA wrapper shell)
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: precache the shell ───────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache what we can; ignore failures for missing icons
      return Promise.allSettled(
        PRECACHE_URLS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.log('Could not cache ' + url + ':', e.message);
          });
        })
      );
    }).then(function() {
      // Activate immediately without waiting for old SW to die
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name)   { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: network-first, fallback to cache ───────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET, chrome-extension, and GAS API calls
  // (GAS calls must go to network — never cache them)
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;
  if (url.includes('script.google.com')) return; // always network for GAS

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Only cache successful responses from our own origin
        if (response.ok && url.startsWith(self.location.origin)) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Network failed — return cached version
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;

          // For navigation requests, return the cached index.html shell
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html').then(function(shell) {
              return shell || offlinePage();
            });
          }

          return offlinePage();
        });
      })
  );
});

// Simple offline fallback HTML
function offlinePage() {
  return new Response(
    '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/>'
    + '<style>body{background:#0e0e12;color:#8888aa;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;height:100vh;font-family:sans-serif;gap:16px;}'
    + '.icon{font-size:48px}.title{font-size:20px;color:#eeeef5;font-weight:700}'
    + 'p{font-size:13px;text-align:center;max-width:220px;line-height:1.6}'
    + 'button{background:#2ee8c0;color:#0e0e12;border:none;padding:10px 20px;'
    + 'border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px}'
    + '</style></head><body>'
    + '<div class="icon">📡</div>'
    + '<div class="title">You\'re Offline</div>'
    + '<p>TalkChatt needs an internet connection. Please check your network and try again.</p>'
    + '<button onclick="location.reload()">Retry</button>'
    + '</body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}
