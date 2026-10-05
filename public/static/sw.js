/* STEM Cloud service worker.
 * - static files + fonts: instant from cache, refreshed in the background
 * - lesson pages: network first (always fresh progress), last visited copy when offline
 * - /api: never touched (progress sync handles its own retries)
 * Lesson pages contain one student's progress, so that cache is wiped on logout / login page / account delete. */
var VERSION = 'v15';
var STATIC = 'stemcloud-static-' + VERSION;
var PAGES = 'stemcloud-pages-' + VERSION;
var FONTS = 'stemcloud-fonts-' + VERSION;
var PRECACHE = [
  '/static/offline.html', '/static/app.css', '/static/app-layer.css', '/static/player.css', '/static/app-layer.js', '/static/pwa.js', '/static/account.js',
  '/static/player.js', '/static/story.js', '/static/voice.js', '/static/questions.js', '/static/icons.js', '/static/si.js',
  '/static/past-papers.js', '/static/past-papers.css', '/static/past-paper-links.js',
  '/static/icons/icon-192.png', '/static/icons/icon-512.png', '/static/icons/icon-maskable-512.png', '/static/icons/favicon-32.png', '/static/icons/favicon.ico', '/static/brand/logo-mark.png', '/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(STATIC).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) < 0 && k.indexOf('stemcloud-') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'clear-pages') e.waitUntil(caches.delete(PAGES));
});

function swr(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin !== location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(swr(req, FONTS));
    return;
  }
  if (url.pathname.indexOf('/api/') === 0 || url.pathname === '/healthz') return;
  if (url.pathname.indexOf('/static/audio/') === 0) return;      /* audio needs Range requests, which the Cache API cannot answer (breaks Safari): always from the network */

  if (url.pathname.indexOf('/static/') === 0 || url.pathname === '/manifest.webmanifest') {
    e.respondWith(swr(req, STATIC));
    return;
  }

  /* Authenticated question-bank data/images use the private page cache; wiped on logout.
   * PDFs stay on the network because viewers may request byte ranges. */
  if (url.pathname.indexOf('/lessons/past-papers/') === 0 && /\.(json|jpg)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(function(res) {
      if(res.ok && !res.redirected) {var copy=res.clone();caches.open(PAGES).then(function(c){c.put(req,copy);});}
      return res;
    }).catch(function(){return caches.open(PAGES).then(function(c){return c.match(req);}).then(function(hit){return hit||Response.error();});}));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && !res.redirected && url.pathname.indexOf('/lessons/') === 0) {
        var copy = res.clone();
        caches.open(PAGES).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.open(PAGES).then(function (c) { return c.match(req, { ignoreSearch: true }); }).then(function (hit) {
        return hit || caches.match('/static/offline.html');
      });
    }));
  }
});
