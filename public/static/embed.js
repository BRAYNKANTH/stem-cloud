/* STEM Cloud embedded lesson step.
 * The topic pages show one step of a lesson (the Watch animation, the lab) inside a frame: /lessons/<file>.html?embed=1&seg=11-20&dur=30#watch
 * In a frame this file
 *  - hides the lesson's own header, step bar and footer (the topic page has its own navigation),
 *  - keeps the lesson's "last lesson" and "current step" bookmarks and its chapter-level completion flags untouched, so looking at a
 *    topic never changes what the lesson page says the student has finished,
 *  - for the Watch animation, plays only the requested slice of the animation (seg=from-to, in seconds of dur) and tells the topic page
 *    when the slice has been played to its end.
 * Outside a frame, or without embed=1, it does nothing. It must load before player.js and app-layer.js. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (q.get('embed') !== '1' || window.parent === window) return;
  var root = document.documentElement;
  root.classList.add('stem-embed');

  /* bookmarks written by the lesson page when it starts: the hub's "continue" card and the saved step */
  try {
    var set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) {
      if (this === window.localStorage && (k === 'stem_last_lesson' || String(k).indexOf('stem_step_') === 0)) return;
      return set.apply(this, arguments);
    };
  } catch (e) {}

  var st = document.createElement('style');
  st.textContent =
    '.stem-embed .topbar,.stem-embed #stem-bar,.stem-embed .sb-strip,.stem-embed #stem-end,.stem-embed footer,.stem-embed .stem-ov,' +
    '.stem-embed .stem-welcome-banner,.stem-embed .xpbar,.stem-embed .section-label,.stem-embed .watch-takeaways,.stem-embed .skip-link,' +
    '.stem-embed #fw_path,.stem-embed .stem-toast,.stem-embed .stem-coach{display:none!important}' +
    '.stem-embed body{padding-top:0!important}' +
    '.stem-embed .wrap{padding-top:8px!important;padding-bottom:12px!important;max-width:none!important}' +
    '.stem-embed .block{margin-top:0!important}' +
    '.stem-embed.stem-seg #fw_rep{display:none!important}';
  document.head.appendChild(st);

  function post(ev, extra) {
    try { window.parent.postMessage(Object.assign({ type: 'stem-embed', event: ev }, extra || {}), location.origin); } catch (e) {}
  }
  function height() { post('height', { h: Math.ceil(document.documentElement.scrollHeight) }); }
  window.addEventListener('load', function () {
    height(); setTimeout(height, 600); setTimeout(height, 2000);
    if (window.ResizeObserver) new ResizeObserver(height).observe(document.body);
  });

  window.addEventListener('load', function () {
    /* the lesson's own completion flags stay with the lesson page */
    window.__fwMarkReal = function () {};
    window.__fwMark = function () {};

    var seg = (q.get('seg') || '').match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/), dur = parseFloat(q.get('dur') || '30') || 30;
    if (!seg) return;
    var from = parseFloat(seg[1]), to = parseFloat(seg[2]);
    root.classList.add('stem-seg');
    var scrub = document.getElementById('fw_scrub'), play = document.getElementById('fw_play');
    if (!scrub || !play || !window.__fwPaint) return;
    function now() { return (+scrub.value) * dur / 1000; }
    function playing() { return /⏸/.test(play.textContent); }
    window.__fwPaint(from);

    var sent = false;
    /* before the lesson's own handler: pressing Play on a finished slice starts it again from its beginning */
    play.addEventListener('click', function () { if (!playing() && now() >= to - 0.05) { window.__fwPaint(from); sent = false; } }, true);   /* only when it is paused at the end, not when we pause it there */
    /* the slider stays inside the slice */
    scrub.addEventListener('input', function () {
      var t = now();
      if (t < from) window.__fwPaint(from); else if (t > to) window.__fwPaint(to);
    });
    setInterval(function () {
      var t = now();
      if (t >= to - 0.02) {
        if (playing()) play.click();
        if (t > to) window.__fwPaint(to);
        if (!sent) { sent = true; post('segment-end'); }
      } else if (t < from - 0.02) {
        window.__fwPaint(from);
      }
    }, 100);
  });
})();
