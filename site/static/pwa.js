/* STEM Cloud app shell: service worker, "Install app" prompt, browser theme colour. Loaded on every page. */
(function () {
  'use strict';
  var evt = null;
  var ua = navigator.userAgent || '';
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  var App = window.StemApp = {
    isStandalone: standalone,
    isIOS: ios && !standalone,
    canInstall: function () { return !!evt && !standalone; },
    install: function () {
      if (!evt) return Promise.resolve(false);
      var e = evt; evt = null;
      e.prompt();
      return e.userChoice.then(function (c) { document.dispatchEvent(new Event('stem-install-change')); return c.outcome === 'accepted'; });
    },
    /* lesson pages hold one student's progress: wipe the offline copies when the account changes */
    clearPageCache: function () {
      try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'clear-pages' }); } catch (e) {}
      try { if (window.caches) caches.keys().then(function (ks) { ks.filter(function (k) { return k.indexOf('stemcloud-pages-') === 0; }).forEach(function (k) { caches.delete(k); }); }); } catch (e) {}
    }
  };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); evt = e;
    document.dispatchEvent(new Event('stem-install-change'));
  });
  window.addEventListener('appinstalled', function () { evt = null; document.dispatchEvent(new Event('stem-install-change')); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }

  /* browser / status bar colour follows the page's own light or dark background */
  function themeColor() {
    var bg = '';
    try { bg = getComputedStyle(document.body).backgroundColor; } catch (e) {}
    if (!bg || bg === 'rgba(0, 0, 0, 0)') {
      try { bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); } catch (e) {}
    }
    if (!bg) return;
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = bg;
  }
  function watchTheme() {
    themeColor();
    try { new MutationObserver(themeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeColor); } catch (e) {}
  }
  if (document.body) watchTheme(); else document.addEventListener('DOMContentLoaded', watchTheme);
})();
