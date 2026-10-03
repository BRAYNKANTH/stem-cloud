/* STEM Cloud account layer: syncs lesson progress (localStorage) to the signed-in account and adds the account menu to the header. */
(function () {
  'use strict';
  var U = window.SCX_USER;
  if (!U || window.__acctSync) return;
  window.__acctSync = true;

  var TRACK = /^(scx_[a-z0-9_]+|lessonLang|lessonTheme)$/;
  var HDR = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };
  var timer = null, dirty = {}, status = 'saved';

  /* ---------------------------------------------------------------- progress sync */
  function snapshot(all) {
    var out = {};
    try {
      if (all) {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (TRACK.test(k)) out[k] = localStorage.getItem(k);
        }
      } else {
        Object.keys(dirty).forEach(function (k) {
          var v = localStorage.getItem(k);
          if (v !== null) out[k] = v;
        });
      }
    } catch (e) {}
    return out;
  }

  function L(en, ta) { var l = null; try { l = localStorage.getItem('lessonLang'); } catch (e) {} return l === 'ta' ? ta : en; }
  function statusText() {
    return status === 'saved' ? L('✓ Saved', '✓ சேமிக்கப்பட்டது') : status === 'saving' ? L('Saving…', 'சேமிக்கிறது…') :
      status === 'offline' ? L('Offline: will save later', 'இணைய இணைப்பு இல்ல: அப்புறம் சேமிப்போம்') : L('Please log in again', 'மறுபடி லாகின் பண்ணு');
  }
  function setStatus(s) {
    status = s;
    var el = document.getElementById('acctStatus');
    if (el) el.textContent = statusText();
  }

  function push(all, keepalive) {
    var body = snapshot(all);
    if (!Object.keys(body).length) { setStatus('saved'); return Promise.resolve(); }
    dirty = {}; setStatus('saving');
    return fetch('/api/progress', { method: 'PUT', headers: HDR, body: JSON.stringify(body), credentials: 'same-origin', keepalive: !!keepalive })
      .then(function (r) {
        if (r.status === 401) { setStatus('login'); return; }
        if (!r.ok) throw new Error('http ' + r.status);
        setStatus('saved');
      })
      .catch(function () {
        Object.keys(body).forEach(function (k) { dirty[k] = 1; });
        setStatus('offline');
        schedule(15000);
      });
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(function () { push(false); }, ms == null ? 1500 : ms);
  }

  /* watch every progress write the lesson pages make */
  try {
    var set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var r = set.apply(this, arguments);
      if (this === window.localStorage && TRACK.test(k)) { dirty[k] = 1; setStatus('saving'); schedule(); }
      return r;
    };
  } catch (e) {}

  window.addEventListener('online', function () { schedule(500); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && Object.keys(dirty).length) push(false, true);
  });
  window.addEventListener('pagehide', function () { if (Object.keys(dirty).length) push(false, true); });

  /* first load: upload anything this device already had (the server merges, progress only goes up) */
  push(true);

  /* ---------------------------------------------------------------- account menu */
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function build() {
    var wrap = mk('div', 'stem-acct');
    var av = mk('button', 'stem-av', (U.display_name || U.username || '?').trim().charAt(0).toUpperCase());
    av.type = 'button'; av.setAttribute('aria-haspopup', 'true'); av.setAttribute('aria-expanded', 'false');
    av.setAttribute('aria-label', 'Account: ' + (U.display_name || U.username));
    var menu = mk('div', 'stem-menu'); menu.setAttribute('role', 'menu');
    wrap.appendChild(av); wrap.appendChild(menu);

    function fill() {
      menu.textContent = '';
      menu.appendChild(mk('div', 'nm', U.display_name || U.username));
      var st = mk('div', 'st', statusText()); st.id = 'acctStatus'; menu.appendChild(st);
      function link(t, h) { var a = mk('a', '', t); a.href = h; menu.appendChild(a); }
      function act(t, fn) { var b = mk('button', '', t); b.type = 'button'; b.onclick = fn; menu.appendChild(b); return b; }
      link('🏠 ' + L('All lessons', 'எல்லா பாடங்கள்'), '/lessons/index.html');
      link('👤 ' + L('My account', 'என் கணக்கு'), '/account');
      if (U.role === 'admin') link('🛠 Admin', '/admin');

      var tt = document.getElementById('themeToggle');
      if (tt && getComputedStyle(tt).display === 'none') {
        act('🌓 ' + L('Light / dark', 'வெளிச்சம் / இருட்டு'), function () { tt.click(); close(); });
      }
      var App = window.StemApp;
      if (App && App.canInstall()) {
        act('📲 ' + L('Install app', 'ஆப்பை நிறுவு'), function () { App.install().then(close); });
      } else if (App && App.isIOS) {
        menu.appendChild(mk('div', 'hint', '📲 ' + L('To install: tap Share, then "Add to Home Screen".', 'நிறுவ: Share அழுத்தி, "Add to Home Screen" தேர்ந்தெடு.')));
      }
      menu.appendChild(mk('hr'));
      act('🚪 ' + L('Log out', 'வெளியேறு'), logout);
    }

    function close() { wrap.classList.remove('open'); av.setAttribute('aria-expanded', 'false'); }
    av.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains('open');
      if (open) fill();
      wrap.classList.toggle('open', open); av.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('stem-install-change', function () { if (wrap.classList.contains('open')) fill(); });

    var host = document.querySelector('.topbar .toggles') || document.querySelector('.topbar-inner');
    if (host) host.appendChild(wrap); else { wrap.classList.add('float'); document.body.appendChild(wrap); }
  }

  function logout() {
    (Object.keys(dirty).length ? push(false) : Promise.resolve()).then(function () {
      if (window.StemApp) window.StemApp.clearPageCache();
      return fetch('/api/logout', { method: 'POST', headers: HDR, credentials: 'same-origin' });
    }).then(function () { location.href = '/login'; });
  }

  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
