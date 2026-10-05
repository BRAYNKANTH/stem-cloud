/* STEM Cloud lesson player.
 * A lesson is one long page of 12 sections. On every screen size this turns it into a guided path:
 * one step at a time, a bottom bar (Back / progress / Next), a lesson map, and no sudden auto-start.
 * "Show whole lesson as one page" in the account menu turns it off (stem_view = scroll). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var wrap = doc.querySelector('.wrap'), pathBox = doc.getElementById('fw_path');
  if (!wrap || !pathBox) return;                                   /* lesson pages only */
  try { if (localStorage.getItem('stem_view') === 'scroll') return; } catch (e) {}
  var footer = doc.querySelector('footer');
  var finishEl = doc.getElementById('fw_finish');

  function lang() { try { return (typeof APP_LANG !== 'undefined' ? APP_LANG : localStorage.getItem('lessonLang')) === 'ta' ? 'ta' : 'en'; } catch (e) { return 'en'; } }
  function L(en, ta) { return lang() === 'ta' ? ta : en; }
  function mk(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }

  /* ------------------------------------------------------------------ steps */
  function pathLinks() { return [].slice.call(doc.querySelectorAll('#fw_phases a.fw-step')); }
  var ids = pathLinks().map(function (a) { return (a.getAttribute('href') || '').slice(1); }).filter(function (id) { return doc.getElementById(id); });
  if (!ids.length) return;
  var N = ids.length, LAST = N + 1;                               /* 0 = start, 1..N = lesson steps, N+1 = finish */

  function topOf(el) { while (el && el.parentNode !== wrap && el.parentNode !== doc.body) el = el.parentNode; return el; }
  var tops = ids.map(function (id) { return topOf(doc.getElementById(id)); });

  function stepOf(el) {
    var t = topOf(el);
    if (!t) return 0;
    var k = tops.indexOf(t);
    if (k >= 0) return k + 1;
    if (t === footer || t === topOf(finishEl)) return LAST;
    var kids = [].slice.call(wrap.children), pos = kids.indexOf(t);
    if (pos < 0) return LAST;
    if (pos < kids.indexOf(tops[0])) return 0;
    var before = 0;
    for (var i = 0; i < tops.length; i++) if (kids.indexOf(tops[i]) < pos) before = i + 1;
    return before >= N ? LAST : before;
  }

  function cleanLabel(a) {
    var c = a.cloneNode(true), t = c.querySelector('.tick'); if (t) t.remove();
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function label(i) {
    if (i === 0) return L('Start', 'தொடக்கம்');
    if (i === LAST) return L('Finish', 'முடிவு');
    var a = pathLinks()[i - 1];
    return a ? cleanLabel(a) : String(i);
  }
  function isDone(i) { var a = pathLinks()[i - 1]; return !!(a && a.classList.contains('done')); }

  /* ------------------------------------------------------------------ bar */
  var bar = mk('nav', '', '');
  bar.id = 'stem-bar'; bar.setAttribute('aria-label', 'Lesson steps');
  bar.innerHTML =
    '<button type="button" class="sb-btn sb-back" aria-label="Previous step">‹</button>' +
    '<span class="sb-slot" id="sb-slot"></span>' +
    '<button type="button" class="sb-mid" aria-haspopup="dialog"><span class="sb-title"></span><span class="sb-track"></span></button>' +
    '<button type="button" class="sb-btn sb-next primary"></button>';
  var bBack = bar.querySelector('.sb-back'), bNext = bar.querySelector('.sb-next'), bMid = bar.querySelector('.sb-mid');
  var bTitle = bar.querySelector('.sb-title'), bTrack = bar.querySelector('.sb-track');
  doc.body.appendChild(bar);

  var cur = -1, visited = {};

  function renderBar() {
    var i = cur;
    bTitle.textContent = i === 0 ? label(0) : (i === LAST ? '🏁 ' + label(LAST) : i + ' / ' + N + ' · ' + label(i));
    var seg = '';
    for (var k = 1; k <= N; k++) seg += '<i class="' + (k === i ? 'cur ' : '') + ((visited[k] || isDone(k)) && k !== i ? 'done' : '') + '"></i>';
    bTrack.innerHTML = seg;
    bBack.disabled = i === 0;
    bBack.setAttribute('aria-label', L('Previous step', 'முந்தைய படி'));
    var nxt = i === LAST ? null : label(i + 1);
    bNext.textContent = i === 0 ? L('Start ›', 'தொடங்கு ›') : (i === N ? L('Finish 🏁', 'முடி 🏁') : (i === LAST ? L('All lessons', 'எல்லா பாடங்கள்') : L('Next ›', 'அடுத்து ›')));
    bNext.setAttribute('aria-label', nxt ? L('Next: ', 'அடுத்து: ') + nxt : L('All lessons', 'எல்லா பாடங்கள்'));
    bMid.setAttribute('aria-label', L('Open lesson map', 'பாடத்தின் வரைபடம்'));
    /* header menu button and nav links show where you are */
    [].forEach.call(doc.querySelectorAll('.navlinks a'), function (a) { a.removeAttribute('aria-current'); });
    var id = i >= 1 && i <= N ? ids[i - 1] : null;
    if (id) { var na = doc.querySelector('.navlinks a[href="#' + id + '"]'); if (na) na.setAttribute('aria-current', 'step'); }
  }

  /* ------------------------------------------------------------------ go */
  function applyVis(animate) {
    var kids = [].slice.call(wrap.children); if (footer) kids.push(footer);
    kids.forEach(function (el) {
      var on = stepOf(el) === cur;
      el.classList.toggle('stem-hide', !on);
      if (on && animate) { el.classList.remove('stem-enter'); void el.offsetWidth; el.classList.add('stem-enter'); }
    });
  }
  /* things added to the page after start-up (the welcome banner ...) get hidden on the right steps too */
  try { new MutationObserver(function () { if (cur >= 0) applyVis(false); }).observe(wrap, { childList: true }); } catch (e) {}

  function hashFor(i) { return i === 0 ? location.pathname + location.search : '#' + (i === LAST ? 'fw_finish' : ids[i - 1]); }

  function go(i, o) {
    o = o || {};
    i = Math.max(0, Math.min(LAST, i));
    var prev = cur, changed = prev !== i;
    cur = i; visited[i] = 1;
    root.setAttribute('data-stem-step', i === 0 ? 'start' : (i === LAST ? 'finish' : 'mid'));
    applyVis(changed && !o.silent);
    if (o.scrollTo) { o.scrollTo.scrollIntoView({ block: 'start' }); }
    else if (!o.keepScroll) window.scrollTo(0, 0);
    if (changed && !o.nopush) {
      try { if (prev === -1) history.replaceState({ stem: i }, '', hashFor(i)); else history.pushState({ stem: i }, '', hashFor(i)); } catch (e) {}
    }
    try { localStorage.setItem('stem_step_' + location.pathname.split('/').pop(), String(i)); } catch (e) {}
    renderBar();
    if (changed && prev !== -1) buzz(6);
    window.dispatchEvent(new Event('resize'));
    doc.dispatchEvent(new CustomEvent('stem-step', { detail: { index: i, id: i >= 1 && i <= N ? ids[i - 1] : (i === 0 ? 'start' : 'fw_finish'), first: !!changed } }));
  }

  /* ------------------------------------------------------------------ map */
  var mapEl = null;
  /* the XP strip only shows on the first and last step; the map carries the same numbers */
  function txt(id) { var e = doc.getElementById(id); return e ? e.textContent : '0'; }
  function statLine() {
    if (!doc.getElementById('xpLevel')) return '';
    return '<div class="sm-stats"><span>⭐ ' + L('Lv', 'மட்டம்') + ' <b>' + txt('xpLevel') + '</b></span><span><b>' + txt('xpTotal') + '</b> XP</span><span>🔥 <b>' + txt('streakVal') + '</b></span><span>🏅 <b>' + txt('badgeCount') + '</b>/5</span></div>';
  }
  function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; doc.removeEventListener('keydown', mapKey); } }
  function mapKey(e) { if (e.key === 'Escape') closeMap(); }
  function openMap() {
    closeMap();
    var done = 0; for (var k = 1; k <= N; k++) if (isDone(k)) done++;
    mapEl = mk('div', 'stem-map', '');
    var h = '<div class="sm-back"></div><div class="sm-sheet" role="dialog" aria-modal="true" aria-label="' + L('Lesson map', 'பாடத்தின் வரைபடம்') + '">' +
      '<div class="sm-grip"></div><div class="sm-head"><b>' + L('Lesson map', 'பாடத்தின் வரைபடம்') + '</b><span>' + done + ' / ' + N + ' ' + L('done', 'முடிந்தது') + '</span></div>' + statLine() + '<div class="sm-list">';
    for (var i = 0; i <= LAST; i++) {
      var mark = i === 0 ? '🏠' : (i === LAST ? '🏁' : (isDone(i) ? '✓' : i));
      h += '<button type="button" class="sm-item' + (i === cur ? ' cur' : '') + (i >= 1 && i <= N && isDone(i) ? ' done' : '') + '" data-i="' + i + '"><span class="sm-n">' + mark + '</span><span class="sm-l">' + label(i) + '</span></button>';
    }
    h += '</div></div>';
    mapEl.innerHTML = h;
    doc.body.appendChild(mapEl);
    mapEl.querySelector('.sm-back').addEventListener('click', closeMap);
    mapEl.addEventListener('click', function (e) { var b = e.target.closest('.sm-item'); if (b) { closeMap(); go(parseInt(b.getAttribute('data-i'), 10)); } });
    doc.addEventListener('keydown', mapKey);
    var c = mapEl.querySelector('.sm-item.cur'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center' });
  }

  /* ------------------------------------------------------------------ events */
  bBack.addEventListener('click', function () { go(cur - 1); });
  bNext.addEventListener('click', function () {
    if (cur === LAST) { var hub = doc.querySelector('.crumb a, a[href$="index.html"]'); location.href = hub ? hub.getAttribute('href') : 'index.html'; return; }
    go(cur + 1);
  });
  bMid.addEventListener('click', openMap);

  /* in-page links jump to the right step (works for the path card, "Start", story button, nav links ...) */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.closest('#stem-bar') || e.defaultPrevented) return;
    var h = a.getAttribute('href') || '';
    var m = h.match(/#(.+)$/);
    if (!m) return;
    if (h.charAt(0) !== '#' && h.split('#')[0].split('/').pop() !== location.pathname.split('/').pop()) return;
    var t = doc.getElementById(m[1]);
    if (!t) return;
    var i = stepOf(t);
    e.preventDefault();
    if (i === cur) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    go(i, { scrollTo: topOf(t) === t || tops.indexOf(t) >= 0 ? null : t });
  }, true);

  window.addEventListener('popstate', function () {
    var h = location.hash.slice(1), t = h && doc.getElementById(h);
    go(t ? stepOf(t) : 0, { nopush: true });
  });

  /* labels / ticks change with the language and as steps are completed */
  var rebar = function () { if (cur >= 0) renderBar(); };
  try { var mo = new MutationObserver(rebar); mo.observe(doc.getElementById('fw_phases'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); } catch (e) {}
  window.addEventListener('storage', rebar);

  /* ------------------------------------------------------------------ lab step: cartoon, sliders, then the extras folded away */
  function fold(cls, open) {
    var d = mk('details', 'stem-fold ' + cls), sm = mk('summary', '', '<span class="sf-t"></span><span class="sf-n"></span>');
    d.appendChild(sm); if (open) d.open = true; return d;
  }
  var labCard = null, missFold = null, guideFold = null;
  function labText() {
    if (missFold) {
      var all = doc.querySelectorAll('#ls_miss .ls-m'), ok = doc.querySelectorAll('#ls_miss .ls-m.ok');
      missFold.querySelector('.sf-t').textContent = '🎯 ' + L('Missions', 'மிஷன்கள்');
      missFold.querySelector('.sf-n').textContent = ok.length + ' / ' + all.length;
      missFold.classList.toggle('all-done', all.length > 0 && ok.length === all.length);
    }
    if (guideFold) guideFold.querySelector('.sf-t').textContent = 'ℹ️ ' + L('How to use this lab', 'இந்த லேப்பை எப்படி பயன்படுத்துவது');
  }
  function foldLab() {
    var miss = doc.getElementById('ls_miss'), guide = doc.getElementById('lg'), card = miss && miss.closest('.lab-card');
    if (!card || card === labCard) return;
    labCard = card;
    var phone = window.innerWidth <= 760;
    missFold = fold('stem-fold-miss', false);
    miss.parentNode.insertBefore(missFold, miss); missFold.appendChild(miss);
    if (guide) { guideFold = fold('stem-fold-guide', !phone); guide.parentNode.insertBefore(guideFold, guide); guideFold.appendChild(guide); card.appendChild(guideFold); }
    labText();
    try { new MutationObserver(labText).observe(miss, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    var lt = doc.getElementById('langToggle'); if (lt) lt.addEventListener('click', function () { setTimeout(labText, 120); });
  }
  doc.addEventListener('stem-step', function (e) { if (e.detail.id === 'lab') foldLab(); });
  foldLab();

  /* ------------------------------------------------------------------ "Tap to watch" instead of a sudden auto-start */
  function poster() {
    var card = doc.querySelector('#watch .fw-anim'), play = doc.getElementById('fw_play'), svg = card && card.querySelector('svg');
    if (!card || !play || !svg || card.querySelector('.stem-poster')) return;
    var p = mk('button', 'stem-poster', '<span class="pp-btn">▶</span><span class="pp-cap">' + L('Tap to watch', 'பார்க்க தொடு') + '</span>');
    p.type = 'button';
    var fit = function () {
      var r = svg.getBoundingClientRect(), c = card.getBoundingClientRect();
      p.style.left = (r.left - c.left - card.clientLeft) + 'px'; p.style.top = (r.top - c.top - card.clientTop) + 'px';
      p.style.width = r.width + 'px'; p.style.height = r.height + 'px';
    };
    var gone = function () { if (p.parentNode) p.remove(); window.removeEventListener('resize', fit); };
    p.addEventListener('click', function () { gone(); play.click(); });
    play.addEventListener('click', gone, { once: true });
    var sc = doc.getElementById('fw_scrub'); if (sc) sc.addEventListener('input', gone, { once: true });
    card.appendChild(p); fit(); window.addEventListener('resize', fit);
  }

  /* ------------------------------------------------------------------ story: restart the first line when its step opens */
  var storyShown = false;
  doc.addEventListener('stem-step', function (e) {
    var id = e.detail.id;
    if (id === 'watch') setTimeout(poster, 60);
    if (id === 'story' && !storyShown) { storyShown = true; if (window.__soShow) setTimeout(function () { window.__soShow(0); }, 120); }
  });

  /* ------------------------------------------------------------------ start */
  root.classList.add('stem-player');
  window.StemPlayer = { active: true, go: go, openMap: openMap, count: N, current: function () { return cur; }, stepIds: ids, stepOf: stepOf, label: label };
  var h0 = location.hash.slice(1), t0 = h0 ? doc.getElementById(h0) : null;
  var inner = t0 && t0 !== topOf(t0) ? t0 : null;                 /* a link to something inside a step: scroll to it */
  go(t0 ? stepOf(t0) : 0, { silent: true, scrollTo: inner });
})();
