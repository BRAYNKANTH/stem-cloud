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

  /* register as soon as the page is parsed: waiting for 'load' would also wait for web fonts, which can take
     very long on a slow phone connection */
  if ('serviceWorker' in navigator) {
    var reg = function () { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {}); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reg); else reg();
  }

  /* Two small notices, on every page (old and new, so with their own styles):
     - "New version ready": a new service worker took over a page that already had one (not the first install); the page
       keeps working, a tap reloads it;
     - "Offline": while the device has no connection (saved pages still open, answers sync later). */
  var WORDS = {
    update: { en: 'New version ready. Tap to refresh', ta: 'புதிய பதிப்பு தயார். புதுப்பிக்கத் தொடு', si: 'නව අනුවාදය සූදානම්. නැවුම් කිරීමට තට්ටු කරන්න' },
    offline: { en: 'Offline: showing saved pages', ta: 'இணைப்பு இல்லை: சேமித்த பக்கங்கள் மட்டும்', si: 'නොබැඳි: සුරැකි පිටු පමණි' }
  };
  function say(k) { var l = document.documentElement.lang; return WORDS[k][l === 'ta' || l === 'si' ? l : 'en']; }
  function style() {
    if (document.getElementById('stem-app-style')) return;
    var st = document.createElement('style');
    st.id = 'stem-app-style';
    st.textContent =
      '.stem-update{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:1000;' +
      'min-height:48px;max-width:calc(100% - 32px);padding:10px 18px;border:0;border-radius:999px;cursor:pointer;' +
      'background:var(--sc-ink,#16183d);color:var(--sc-ground,#fff);font:700 15px/1.25 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
      '.stem-offline{position:fixed;left:50%;transform:translateX(-50%);top:calc(6px + env(safe-area-inset-top));z-index:1000;pointer-events:none;' +
      'max-width:calc(100% - 32px);padding:4px 12px;border-radius:999px;background:var(--sc-ink,#16183d);color:var(--sc-ground,#fff);' +
      'font:700 13px/1.4 system-ui,sans-serif;text-align:center}';
    document.head.appendChild(st);
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!document.body || document.getElementById('stem-update')) return;
      style();
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'stem-update'; b.className = 'stem-update'; b.textContent = say('update');
      b.addEventListener('click', function () { location.reload(); });
      document.body.appendChild(b);
    });
  }
  function net() {
    var el = document.getElementById('stem-offline');
    if (navigator.onLine) { if (el) el.parentNode.removeChild(el); return; }
    if (el || !document.body) return;
    style();
    el = document.createElement('div');
    el.id = 'stem-offline'; el.className = 'stem-offline'; el.setAttribute('role', 'status'); el.textContent = say('offline');
    document.body.appendChild(el);
  }
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  if (document.body) net(); else document.addEventListener('DOMContentLoaded', net);

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
