/* STEM Cloud Sinhala layer.
 * The lessons are written in English with a Tamil twin (data-ta). Sinhala is a THIRD language added on top, without touching the lesson code:
 * the lesson runs in English and this file swaps every English string that has a Sinhala translation (a "translation memory" keyed by the
 * English text: /static/si/_ui.json for the app, /static/si/<lesson>.json for a chapter). Text with no translation yet stays English.
 * It also owns the language picker (English / தமிழ் / සිංහල) used on every page. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;

  function saved() { try { return localStorage.getItem('lessonLang') || 'en'; } catch (e) { return 'en'; } }
  window.stemLang = function () { return window.STEM_LANG || saved(); };
  var LANGS = [['en', 'English', 'en'], ['ta', 'தமிழ்', 'ta'], ['si', 'සිංහල', 'si']];
  function nameOf(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return LANGS[i][1]; return 'English'; }

  var dict = {}, loaded = false, touched = [], busy = false, obs = null, timer = null, pending = [], coverage = null;
  var page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var phrases = [], prefixes = [], cache = {};
  /* replace a phrase only where it stands alone (not inside a longer English word) */
  function swap(str, from, to) {
    var out = '', i = 0, j;
    while ((j = str.indexOf(from, i)) >= 0) {
      var before = j ? str.charAt(j - 1) : ' ', after = str.charAt(j + from.length) || ' ';
      var okB = !/[A-Za-z]/.test(before) || !/[A-Za-z]/.test(from.charAt(0)), okA = !/[A-Za-z]/.test(after) || !/[A-Za-z]/.test(from.charAt(from.length - 1));
      out += str.slice(i, j) + (okB && okA ? to : from); i = j + from.length;
    }
    return out + str.slice(i);
  }
  function has(k) { return Object.prototype.hasOwnProperty.call(dict, k); }
  /* 1) the exact English text  2) the same with its numbers lifted out ("You have {0} step(s) left")  3) built from short phrases ("~Next:" + "~Notes") */
  function lookup(en) {
    var k = norm(en); if (!k) return null;
    if (has(k)) return dict[k];
    if (Object.prototype.hasOwnProperty.call(cache, k)) return cache[k];
    for (var q = 0; q < prefixes.length; q++) if (k.indexOf(prefixes[q][0]) === 0 && k.length > prefixes[q][0].length) return prefixes[q][1].replace('{*}', k.slice(prefixes[q][0].length));
    var out = null, nums = [], t = k.replace(/\d+(?:\.\d+)?/g, function (m) { nums.push(m); return '{' + (nums.length - 1) + '}'; });
    if (nums.length && has(t)) out = dict[t].replace(/\{(\d+)\}/g, function (m, i) { return nums[i] !== undefined ? nums[i] : m; });
    if (out === null && k.length <= 160 && phrases.length) {
      var r = k;
      for (var i = 0; i < phrases.length; i++) r = swap(r, phrases[i][0], phrases[i][1]);
      if (r !== k && !/[A-Za-z]{2,}/.test(r.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ''))) out = r;
    }
    cache[k] = out; return out;
  }
  function isSi() { return window.stemLang() === 'si'; }

  /* ------------------------------------------------------------------ dictionary */
  function get(url) { return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); }
  function load() {
    return Promise.all([get('/static/si/_ui.json'), get('/static/si/' + page + '.json')]).then(function (r) {
      dict = {}; phrases = []; prefixes = []; cache = {};
      [r[0], r[1]].forEach(function (d) { Object.keys(d).forEach(function (k) { if (k.charAt(0) === '~') phrases.push([k.slice(1), d[k]]); else if (k.slice(-3) === '{*}') prefixes.push([k.slice(0, -3), d[k]]); else dict[norm(k)] = d[k]; }); });
      phrases.sort(function (a, b) { return b[0].length - a[0].length; });
      loaded = true; if (isSi()) apply();
    });
  }

  /* ------------------------------------------------------------------ translating the page */
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/;
  var INLINE = /^(B|I|EM|STRONG|SUB|SUP|BR|SMALL|U|MARK|S)$/;

  function unitKey(el) {
    if (el.dataset && el.dataset.en !== undefined) return norm(el.dataset.en);       /* a lesson's own bilingual unit */
    if (!el.firstChild) return '';
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE.test(all[i].tagName) || all[i].attributes.length) return '';   /* only bare <b>, <i>, <sub> ... inside */
    return norm(el.innerHTML);
  }
  function setHTML(el, si) {
    if (el.__siOrig === undefined) { el.__siOrig = el.innerHTML; touched.push(el); }
    el.__siNow = si; el.innerHTML = si;
  }
  function translateEl(el) {
    if (!el || el.nodeType !== 1 || SKIP.test(el.tagName) || el.closest('[data-no-si]')) return;
    if (el.closest('svg') && !(/^(text|tspan)$/i.test(el.tagName) && !el.children.length)) return;     /* a drawing: only its plain text labels are translated */
    if (el.tagName === 'TD' && el.classList.contains('tt') && el.nextElementSibling && el.nextElementSibling.classList.contains('te')) {
      /* glossary table: the Tamil column shows the Sinhala term, found by its English neighbour ("@Work") */
      var gs = lookup('@' + norm(el.nextElementSibling.textContent));
      if (gs !== null && el.innerHTML !== gs) setHTML(el, gs);
      return;
    }
    if (el.tagName === 'TD' && el.classList.contains('te') && el.closest('table.gloss')) return;   /* the English column stays English */
    if (el.tagName === 'TH' && el.previousElementSibling === null && el.closest('table.gloss')) {
      if (el.innerHTML !== 'සිංහල') setHTML(el, 'සිංහල');         /* the glossary's first column is the Sinhala one here */
      return;
    }
    var k = unitKey(el), si;
    if (k && /[A-Za-z]/.test(k)) {
      si = lookup(k);
      if (si !== null) { if (el.innerHTML !== si) setHTML(el, si); }
      else if (el.__siOrig !== undefined && el.__siNow !== undefined && el.innerHTML === el.__siNow) { /* already ours */ }
    }
    if (!k) {                                                   /* mixed content (an icon span + a word): translate the bare text pieces */
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 3) continue;
        var raw = n.nodeValue, tk = norm(raw); if (!tk || !/[A-Za-z]{2,}/.test(tk)) continue;
        var ts = lookup(tk);
        if (ts !== null) { if (n.__siOrig === undefined) { n.__siOrig = raw; touched.push(n); } n.__siNow = raw.replace(tk, ts).replace(/^(\s*)\s*/, '$1'); n.nodeValue = raw.indexOf(tk) >= 0 ? raw.replace(tk, ts) : ts; n.__siNow = n.nodeValue; }
      }
    }
    ATTRS.forEach(function (a) {
      var v = el.getAttribute(a); if (!v) return;
      if (el.__siAttr && el.__siAttr[a] !== undefined && el.__siAttr[a].now === v) return;
      var t = lookup(v); if (t === null) return;
      el.__siAttr = el.__siAttr || {}; el.__siAttr[a] = { orig: v, now: t }; el.setAttribute(a, t);
      if (touched.indexOf(el) < 0) touched.push(el);
    });
  }
  function walk(node) {
    if (!node || node.nodeType !== 1) return;
    translateEl(node);
    var kids = node.getElementsByTagName('*'), i;
    for (i = 0; i < kids.length; i++) translateEl(kids[i]);
  }
  function scan() {
    busy = true;
    try {
      walk(doc.body);
      if (lookup(doc.title) !== null) { if (doc.__siTitle === undefined) doc.__siTitle = doc.title; doc.title = lookup(doc.__siTitle || doc.title); }
    } finally { busy = false; }
    measure();
  }
  /* how much of this chapter's own text is translated: below 90% a small note says the rest is still English */
  function measure() {
    var units = doc.querySelectorAll('.wrap [data-ta]'), n = 0, done = 0, i;
    for (i = 0; i < units.length; i++) { var k = norm(units[i].dataset.en || ''); if (!/[A-Za-z]{3,}/.test(k)) continue; n++; if (lookup(k) !== null) done++; }
    coverage = n ? done / n : 1;
    window.dispatchEvent(new CustomEvent('stem-si-coverage', { detail: { units: n, done: done, ratio: coverage } }));
    showNote();
  }

  /* a chapter whose Sinhala is not finished says so, once, at the top of its first screen */
  function showNote() {
    var host = doc.getElementById('fw_path'), old = doc.querySelector('.stem-si-note');
    if (!host) return;
    var need = isSi() && coverage !== null && coverage < 0.9;
    if (!need) { if (old) old.remove(); return; }
    if (old) return;
    var n = doc.createElement('div'); n.className = 'stem-si-note'; n.setAttribute('data-no-si', '');
    n.innerHTML = '<span aria-hidden="true">🛠️</span><span lang="si">මෙම පාඩමේ සිංහල පරිවර්තනය තවමත් සම්පූර්ණ නැත. පරිවර්තනය නොකළ තැන් ඉංග්‍රීසියෙන් පෙන්වයි.</span>';
    host.insertBefore(n, host.firstChild);
  }

  function watch() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(function (list) {
      if (busy || !isSi() || !loaded) return;
      list.forEach(function (m) {
        var t = m.type === 'characterData' ? m.target.parentElement : m.target;
        if (t && pending.indexOf(t) < 0) pending.push(t);
        if (m.type === 'childList') [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && pending.indexOf(n) < 0) pending.push(n); });
      });
      function flush() {
        timer = null; var set = pending; pending = [];
        busy = true; try { set.forEach(function (n) { if (doc.contains(n)) walk(n); }); } finally { busy = false; }
      }
      /* a drawing that a lab redraws every frame must be translated before the next paint, or its labels flash in English */
      var drawn = pending.filter(function (n) { return n.closest && n.closest('svg'); });
      if (drawn.length) {
        pending = pending.filter(function (n) { return drawn.indexOf(n) < 0; });
        busy = true; try { drawn.forEach(function (n) { if (doc.contains(n)) walk(n); }); } finally { busy = false; }
        if (!pending.length) return;
      }
      if (timer) return;                                    /* one flush for everything that changed in the last moment (never drop earlier targets) */
      timer = setTimeout(flush, 40);
    });
    obs.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function apply() {
    root.lang = 'si'; if (doc.body) doc.body.classList.add('lang-si');
    if (!loaded) return;
    scan(); watch();
  }
  function revert() {
    busy = true;
    try {
      touched.forEach(function (el) {
        if (el.nodeType === 3) { if (el.nodeValue === el.__siNow) el.nodeValue = el.__siOrig; delete el.__siOrig; delete el.__siNow; return; }
        if (el.__siOrig !== undefined) { if (el.innerHTML === el.__siNow) el.innerHTML = el.__siOrig; delete el.__siOrig; delete el.__siNow; }
        if (el.__siAttr) { Object.keys(el.__siAttr).forEach(function (a) { if (el.getAttribute(a) === el.__siAttr[a].now) el.setAttribute(a, el.__siAttr[a].orig); }); delete el.__siAttr; }
      });
      touched = [];
      if (doc.__siTitle !== undefined) { doc.title = doc.__siTitle; delete doc.__siTitle; }
    } finally { busy = false; }
    if (doc.body) doc.body.classList.remove('lang-si');
    var nn = doc.querySelector('.stem-si-note'); if (nn) nn.remove();
  }

  /* ------------------------------------------------------------------ language picker */
  var pop = null, popBtn = null;
  function closePop(focus) { if (pop) { pop.remove(); pop = null; if (popBtn) popBtn.setAttribute('aria-expanded', 'false'); if (focus && popBtn) popBtn.focus(); } doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('click', onDoc, true); }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); closePop(true); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var b = [].slice.call(pop.querySelectorAll('button')), i = b.indexOf(doc.activeElement); e.preventDefault(); b[(i + (e.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length].focus(); } }
  function onDoc(e) { if (pop && !pop.contains(e.target) && e.target !== popBtn && !(popBtn && popBtn.contains(e.target))) closePop(false); }
  function openPop(btn, pick) {
    closePop(false); popBtn = btn;
    var cur = window.stemLang();
    pop = doc.createElement('div'); pop.className = 'stem-langpop'; pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', 'Language');
    pop.innerHTML = LANGS.map(function (l) { return '<button type="button" lang="' + l[2] + '" data-l="' + l[0] + '" aria-pressed="' + (l[0] === cur) + '"><span class="lp-n">' + l[1] + '</span><span class="lp-t" aria-hidden="true">' + (l[0] === cur ? '✓' : '') + '</span></button>'; }).join('');
    doc.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.top = Math.round(r.bottom + 6 + window.pageYOffset) + 'px'; pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    pop.addEventListener('click', function (e) { var b = e.target.closest('button[data-l]'); if (!b) return; var code = b.getAttribute('data-l'); closePop(true); pick(code); });
    doc.addEventListener('keydown', onKey, true); doc.addEventListener('click', onDoc, true);
    (pop.querySelector('[aria-pressed="true"]') || pop.querySelector('button')).focus();
  }
  /* the button shows the language you are in (its own name); tapping it opens the picker */
  function labelBtn(btn) {
    if (!btn) return;
    var cur = window.stemLang();
    btn.textContent = '🌐 ' + nameOf(cur);
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');
    btn.setAttribute('aria-label', (cur === 'si' ? 'භාෂාව: ' : 'Language: ') + nameOf(cur)); btn.setAttribute('lang', cur);
    btn.title = 'English · தமிழ் · සිංහල';
  }
  function mountPicker(btn, pick) {
    if (!btn || btn.__siMounted) return; btn.__siMounted = true;
    labelBtn(btn);
    window.addEventListener('click', function (e) {
      if (!btn.contains(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (pop) closePop(true); else openPop(btn, pick);
    }, true);
  }

  window.StemSI = { lookup: lookup, t: function (en) { var s = lookup(en); return s === null ? en : s; }, apply: apply, revert: revert, load: load, mountPicker: mountPicker, labelBtn: labelBtn, names: nameOf, coverage: function () { return coverage; }, isSi: isSi };

  /* ------------------------------------------------------------------ boot */
  function boot() {
    if (isSi()) { root.lang = 'si'; if (doc.body) doc.body.classList.add('lang-si'); }
    load();
    var btn = doc.getElementById('langToggle');
    if (btn && typeof window.applyLang === 'function') {
      /* choose a language through the page's own applyLang (it re-renders the Tamil/English text and our layer follows) */
      mountPicker(btn, function (code) { window.applyLang(code); labelBtn(btn); });
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
