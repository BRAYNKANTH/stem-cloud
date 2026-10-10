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

  function handleKickedOut() {
    if (window.__kickedOutHandled) return;
    window.__kickedOutHandled = true;
    if (window.StemApp) window.StemApp.clearPageCache();

    var b = document.createElement('div');
    b.id = 'kickedOverlay';
    b.style.cssText = 'position:fixed;inset:0;background:rgba(11,15,23,0.96);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;font-family:system-ui,sans-serif;backdrop-filter:blur(8px);';
    b.innerHTML = '<div style="max-width:380px;background:#141d2c;border:1.5px solid #ff7a8f;border-radius:20px;padding:26px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.6)">'
      + '<div style="font-size:2.8rem;margin-bottom:8px">📱⚠️</div>'
      + '<h2 style="margin:0 0 8px;font-size:1.25rem;color:#ff7a8f">Device Limit Reached</h2>'
      + '<p style="margin:0 0 16px;color:#a7b3c8;font-size:0.92rem;line-height:1.5">You were logged out because this account was logged into on another device (maximum 2 active devices allowed).</p>'
      + '<button id="reloginBtn" style="background:#4cc3f0;color:#06182b;border:none;border-radius:12px;padding:12px 24px;font-weight:700;font-size:0.95rem;cursor:pointer">Log in on this device</button>'
      + '</div>';
    document.body.appendChild(b);
    var relogin = document.getElementById('reloginBtn');
    if (relogin) {
      relogin.onclick = function () {
        location.href = '/login?next=' + encodeURIComponent(location.pathname);
      };
    }
  }

  function checkSession() {
    if (!navigator.onLine || window.__kickedOutHandled) return;
    fetch('/api/me', { credentials: 'same-origin', headers: { 'X-Requested-With': 'stemcloud' } })
      .then(function (r) {
        if (r.status === 401) handleKickedOut();
      }).catch(function () {});
  }
  setInterval(checkSession, 15000);
  window.addEventListener('focus', checkSession);

  function push(all, keepalive) {
    var body = snapshot(all);
    if (!Object.keys(body).length) { setStatus('saved'); return Promise.resolve(); }
    dirty = {}; setStatus('saving');
    return fetch('/api/progress', { method: 'PUT', headers: HDR, body: JSON.stringify(body), credentials: 'same-origin', keepalive: !!keepalive })
      .then(function (r) {
        if (r.status === 401) { setStatus('login'); handleKickedOut(); return; }
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
    av.type = 'button'; av.setAttribute('aria-expanded', 'false');
    av.setAttribute('aria-label', 'Account: ' + (U.display_name || U.username));
    var menu = mk('div', 'stem-menu'); menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Account');      /* a disclosure with normal links and buttons, not an ARIA menu */
    wrap.appendChild(av); wrap.appendChild(menu);

    function fill() {
      menu.textContent = '';
      menu.appendChild(mk('div', 'nm', U.display_name || U.username));
      var st = mk('div', 'st', statusText()); st.id = 'acctStatus'; menu.appendChild(st);
      function link(t, h) { var a = mk('a', '', t); a.href = h; menu.appendChild(a); }
      function act(t, fn) { var b = mk('button', '', t); b.type = 'button'; b.onclick = fn; menu.appendChild(b); return b; }
      link('🏠 ' + L('Course contents', 'பாட உள்ளடக்கம்'), '/lessons/index.html');
      link('👤 ' + L('My account', 'என் கணக்கு'), '/account');
      link('ℹ️ ' + L('About STEM Cloud', 'STEM Cloud பற்றி'), '/about');
      link('🌐 ' + L('Platform Homepage', 'முகப்புப் பக்கம்'), '/home');

      var tt = document.getElementById('themeToggle');
      if (tt && getComputedStyle(tt).display === 'none') {
        act('🌓 ' + L('Light / dark', 'வெளிச்சம் / இருட்டு'), function () { tt.click(); close(); });
      }
      var calm = document.documentElement.classList.contains('stem-calm');
      var mb = act('🎞 ' + L('Animations', 'அனிமேஷன்'), function () {
        var off = !document.documentElement.classList.contains('stem-calm');
        document.documentElement.classList.toggle('stem-calm', off);
        document.documentElement.setAttribute('data-stem-motion', off ? 'off' : 'on');
        try { localStorage.setItem('stem_motion', off ? 'off' : 'on'); } catch (e) {}
        try { window.dispatchEvent(new Event('stem-calm-change')); } catch (e) {}
        fill();
      });
      mb.appendChild(mk('span', 'sw' + (calm ? ' off' : ''), calm ? L('Off', 'ஆஃப்') : L('On', 'ஆன்')));
      if (window.StemPlayer && window.StemPlayer.openCoach) {
        act('❓ ' + L('How it works', 'எப்படி வேலை செய்யுது'), function () { close(); window.StemPlayer.openCoach(); });
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('open')) { close(); av.focus(); } });
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
