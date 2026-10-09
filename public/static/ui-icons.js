/* STEM Cloud icons: a small drawn set (24px grid, square caps, mitred corners) used instead of emoji.
 *   StemIcon('book')          -> HTML for an inline icon
 *   StemIcons.skin(element)   -> replaces emoji in that element's text with the matching icon (or removes decorative ones)
 * The skin runs on the app's own chrome (header, menus, step bars, contents page, topic pages, login) and on lesson headings.
 * It leaves the text a lesson teaches with (stories, questions, answers, diagrams) alone. */
(function () {
  'use strict';
  if (window.StemIcon) return;

  var S = {   /* stroke paths; names ending in -f are filled shapes */
    book: 'M3 5h8v14H3z M13 5h8v14h-8z M5.5 9h3 M15.5 9h3',
    watch: 'M3 5h18v14H3z M10 9v6l5-3z',
    explore: 'M12 3a9 9 0 100 18 9 9 0 000-18z M16 8l-2.2 5.8L8 16l2.2-5.8z',
    practice: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
    check: 'M4 12l5 5L20 6',
    cross: 'M5 5l14 14 M19 5L5 19',
    home: 'M3 11l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6',
    flag: 'M5 21V4 M5 4h13l-3 4 3 4H5',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c3.5 3 3.5 15 0 18 M12 3c-3.5 3-3.5 15 0 18',
    moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
    cap: 'M2 9l10-5 10 5-10 5z M6 11.5V16c3 2.5 9 2.5 12 0v-4.5',
    target: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z',
    map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
    next: 'M4 12h15 M13 6l6 6-6 6',
    back: 'M20 12H5 M11 6l-6 6 6 6',
    download: 'M12 3v12 M7 11l5 5 5-5 M4 20h16',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
    eyeoff: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z M4 4l16 16',
    bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    search: 'M10 4a6 6 0 100 12 6 6 0 000-12z M15 15l6 6',
    note: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
    help: 'M12 3a9 9 0 100 18 9 9 0 000-18z M9.5 9.5a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4 M12 17v.5',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2',
    list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h2 M3 12h2 M3 18h2',
    close: 'M5 5l14 14 M19 5L5 19',
    lock: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4',
    user: 'M12 4a4 4 0 100 8 4 4 0 000-8z M4 21c0-4 3.5-6 8-6s8 2 8 6',
    scale: 'M12 4v16 M5 20h14 M4 8h16 M4 8l-2 6h6z M20 8l-2 6h6z'
  };
  var F = {   /* filled shapes */
    play: 'M7 4l13 8-13 8z',
    star: 'M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z',
    flame: 'M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-2.2 1-3.6 2.4-4.6.2 1.6 1 2.6 2 2.6C9.4 8.4 10.2 5 12 2z',
    medal: 'M12 2.5l2.4 1.5 2.8-.3 1 2.6 2.4 1.5-.8 2.7.8 2.7-2.4 1.5-1 2.6-2.8-.3L12 21l-2.4-1.5-2.8.3-1-2.6L3.4 15.7l.8-2.7-.8-2.7 2.4-1.5 1-2.6 2.8.3z'
  };
  var NAMES = Object.keys(S).concat(Object.keys(F));

  function svg(name) {
    var p = F[name] ? '<path class="f" d="' + F[name] + '"/>' : '<path d="' + (S[name] || '') + '"/>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + '</svg>';
  }
  function icon(name, extra) { return NAMES.indexOf(name) < 0 ? '' : '<span class="ic' + (extra ? ' ' + extra : '') + '" aria-hidden="true">' + svg(name) + '</span>'; }

  /* emoji and symbols -> icon name; '' = decoration with no meaning, removed */
  var MAP = {
    '📖': 'book', '📚': 'book', '🎬': 'watch', '🧭': 'explore', '✏': 'practice', '📝': 'note', '✓': 'check', '✔': 'check', '✅': 'check', '✗': 'cross', '✘': 'cross', '❌': 'cross', '✕': 'close',
    '🏠': 'home', '🏁': 'flag', '🌐': 'globe', '🌙': 'moon', '🎓': 'cap', '🎯': 'target', '🗺': 'map', '➜': 'next', '➡': 'next', '←': 'back', '📲': 'download', '👁': 'eye', '🙈': 'eyeoff',
    '💡': 'bulb', '⚡': 'bolt', '🔍': 'search', '❓': 'help', '⏱': 'clock', '⚖': 'scale', '★': 'star', '⭐': 'star', '🔥': 'flame', '🏅': 'medal', '🏆': 'medal',
    '▶': 'play', '✨': '', '🚀': '', '🎉': '', '🔟': '', '👆': '', '👉': ''
  };
  var RE = /[\u{1F300}-\u{1FAFF}☀-➿⭐✅⬆⬇←-⇿⏱▶]️?/gu;

  var SKIP = 'script,style,textarea,input,select,option,svg,code,pre,[data-keep-emoji],.so-bubble,.so-scene,.qtext,.exq,.ex-answer,.qz-q,.qz-opt,.qz-explain,.fw-cap,.fw-ask,#fw_svg';
  var busy = false;
  function skin(root) {
    if (!root || !root.nodeType) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), hits = [], n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue || !RE.test(n.nodeValue)) { RE.lastIndex = 0; continue; }
      RE.lastIndex = 0;
      var p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      hits.push(n);
    }
    busy = true;
    hits.forEach(function (t) {
      var s = t.nodeValue, out = '', last = 0, m, changed = false;
      RE.lastIndex = 0;
      while ((m = RE.exec(s))) {
        var key = m[0].replace(/️/g, ''), name = MAP[key];
        out += esc(s.slice(last, m.index));
        last = m.index + m[0].length;
        if (name === undefined) name = '';                            // an emoji we have no drawing for is decoration here: removed
        changed = true;
        out += name ? icon(name) : '';
      }
      if (!changed) return;
      out += esc(s.slice(last));
      var span = document.createElement('span'); span.className = 'ic-wrap'; span.innerHTML = out.replace(/^\s+/, '');
      t.parentNode.replaceChild(span, t);
    });
    busy = false;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* what gets skinned: the app's own chrome, and the headings of lessons */
  var ROOTS = '.topbar,#stem-bar,.sb-strip,#stem-end,.stem-ov,.sm-sheet,.stem-menu,.stem-langpop,.stem-coach,.stem-toast,#toc,.course,.tp-wrap,#app,.section-label,.so-head,.hero,.fw-phase,.fw-finish,#fw_finish,.xpbar,.badges-btn,.navlinks,.card h3,.login-page,.tour-modal,.wrap > header,main,.foot';
  var timer = null;
  function run() {
    if (busy) return;
    if (document.body.hasAttribute('data-ui-skin-all')) skin(document.body); else [].forEach.call(document.querySelectorAll(ROOTS), skin);
  }
  function soon() { clearTimeout(timer); timer = setTimeout(run, 60); }
  function start() {
    run();
    try { new MutationObserver(function () { if (!busy) soon(); }).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.StemIcon = icon;
  window.StemIcons = { skin: skin, names: NAMES, html: icon };
})();
