/* STEM Cloud app layer (lesson pages): sticky-bar measurements and the phone section menu. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var tb = doc.querySelector('.topbar'), xp = doc.querySelector('.xpbar');

  function measure() {
    var h1 = tb ? tb.offsetHeight : 0, h2 = xp ? xp.offsetHeight : 0;
    root.style.setProperty('--stem-tb', h1 + 'px');
    root.style.setProperty('--stem-sticky', (h1 + h2) + 'px');
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
  if (window.ResizeObserver) { var ro = new ResizeObserver(measure); if (tb) ro.observe(tb); if (xp) ro.observe(xp); }

  /* phone: the 12-link section strip becomes a menu behind a button */
  var nav = doc.querySelector('.navlinks'), inner = tb && tb.querySelector('.topbar-inner');
  if (nav && inner) {
    var b = doc.createElement('button');
    b.type = 'button'; b.className = 'stem-menu-btn'; b.textContent = '☰';
    b.setAttribute('aria-label', 'Sections'); b.setAttribute('aria-expanded', 'false');
    inner.insertBefore(b, inner.firstChild);
    var close = function () { nav.classList.remove('stem-open'); b.setAttribute('aria-expanded', 'false'); b.textContent = '☰'; };
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('stem-open');
      b.setAttribute('aria-expanded', String(open)); b.textContent = open ? '✕' : '☰';
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    doc.addEventListener('click', function (e) { if (!nav.contains(e.target) && e.target !== b) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 760) close(); });
  }
})();
