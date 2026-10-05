/* STEM Cloud icon skin: the lesson pages label their round controls with words ("▶ Play", "🔇 Sound: off", "Show answer").
 * A student should read the picture, not the words, so this swaps each label for its icon and keeps the words as the
 * tooltip and screen-reader label. The lesson's own code still sets the text; we re-skin whenever it does. */
(function () {
  'use strict';
  var doc = document;
  var busy = false;

  function words(t) { return t.replace(/^[^\p{L}\p{N}]+/u, '').trim(); }
  function on(t) { return /:\s*(on|ஆன்)\s*$/i.test(t); }

  /* selector -> function(text) returning { icon, pressed? } */
  var SKINS = {
    '#fw_play': function (t) { return { icon: /^⏸/.test(t) ? '⏸' : '▶' }; },
    '#fw_rep': function () { return { icon: '⟲' }; },
    '#fw_slow': function (t) { return { icon: '🐢', pressed: on(t) }; },
    '#fw_snd': function (t) { return { icon: /^🔇/.test(t) ? '🔇' : '🔊', pressed: !/^🔇/.test(t) }; },
    '.ex-toggle': function (t) { return { icon: /hide|மறை/i.test(t) ? '🙈' : '👁' }; }
  };

  function skin(b, fn) {
    if (busy) return;
    var t = (b.dataset.words && b.textContent === b.dataset.icon) ? b.dataset.words : b.textContent.trim();
    if (!t) return;
    var r = fn(t);
    if (b.textContent === r.icon && b.dataset.words) return;       /* already an icon */
    busy = true;
    b.dataset.words = t; b.dataset.icon = r.icon;
    b.textContent = r.icon;
    var w = words(t) || t;
    b.setAttribute('aria-label', w); b.title = w;
    if (r.pressed !== undefined) b.setAttribute('aria-pressed', String(!!r.pressed));
    b.classList.add('icon-btn');
    busy = false;
  }

  function wire(sel, fn) {
    [].forEach.call(doc.querySelectorAll(sel), function (b) {
      skin(b, fn);
      try {
        new MutationObserver(function () {
          if (busy) return;
          /* the lesson wrote new words: skin again from the new words */
          if (b.textContent !== b.dataset.icon) { delete b.dataset.icon; b.dataset.words = ''; skin(b, fn); }
        }).observe(b, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
    });
  }

  function run() { Object.keys(SKINS).forEach(function (sel) { wire(sel, SKINS[sel]); }); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run); else run();
})();
