/* STEM Cloud textbook questions on phones:
 * 1. "(i) ... (ii) ... (iii) ..." (or (a) (b) (c)) written inline becomes aligned lines, one part per row.
 * 2. Tap a diagram to open it full screen at a readable size. */
(function () {
  'use strict';
  var doc = document;

  /* ---------------------------------------------------------------- parts */
  var ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'], LET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var SEL = '.qtext, .exq > span:not(.exnum), .final-answer';
  var busy = false;

  function split(html) {
    var re = /(^|[\s>])\((i{1,3}|iv|v|vi{1,3}|ix|x|[a-h])\)\s/g, hits = [], m;
    while ((m = re.exec(html))) hits.push({ at: m.index + m[1].length, label: m[2], len: m[0].length - m[1].length });
    if (hits.length < 2) return null;
    var series = ROMAN.indexOf(hits[0].label) === 0 ? ROMAN : (LET.indexOf(hits[0].label) === 0 ? LET : null);
    if (!series) return null;
    for (var k = 0; k < hits.length; k++) if (series.indexOf(hits[k].label) !== k) return null;      /* must run i, ii, iii ... in order */
    var lead = html.slice(0, hits[0].at).trim();
    var out = lead ? '<span class="qlead">' + lead + '</span>' : '';
    hits.forEach(function (h, k) {
      var end = k + 1 < hits.length ? hits[k + 1].at : html.length;
      out += '<span class="qpart"><b class="ql">(' + h.label + ')</b><span class="qt">' + html.slice(h.at + h.len, end).trim() + '</span></span>';
    });
    return out;
  }
  function fixEl(el) {
    if (el.querySelector('.qpart')) return;
    var r = split(el.innerHTML);
    if (!r) return;
    busy = true; el.innerHTML = r; el.classList.add('has-parts'); busy = false;
  }
  function run() { [].forEach.call(doc.querySelectorAll(SEL), fixEl); }
  run();

  /* the language switch rewrites the text: format it again (only the question sections are watched, never the animated ones) */
  var timer = null;
  function again() { if (busy) return; clearTimeout(timer); timer = setTimeout(run, 100); }
  ['practice', 'exercises', 'walkthroughs', 'examples', 'activities'].forEach(function (id) {
    var s = doc.getElementById(id);
    if (s && window.MutationObserver) new MutationObserver(again).observe(s, { childList: true, subtree: true, characterData: true });
  });

  /* ---------------------------------------------------------------- diagrams */
  var box = null;
  var boxModal = null;
  function closeBox() { if (box) { box.remove(); box = null; doc.removeEventListener('keydown', onKey); var m = boxModal; boxModal = null; if (m && window.StemModal) window.StemModal.close(m); } }
  function onKey(e) { if (e.key === 'Escape') closeBox(); }
  function openBox(svg) {
    closeBox();
    var vb = (svg.getAttribute('viewBox') || '0 0 560 200').split(/\s+/).map(Number), w = Math.max(vb[2] * 1.5, 640);
    box = doc.createElement('div'); box.className = 'stem-lightbox';
    var lang = ''; try { lang = localStorage.getItem('lessonLang') === 'ta' ? 'ta' : 'en'; } catch (e) {}
    box.innerHTML = '<div class="lb-bar"><b>' + (lang === 'ta' ? 'படம்' : 'Diagram') + '</b><span>' + (lang === 'ta' ? 'இழுத்து பார், இரண்டு விரலால பெரிதாக்கு' : 'drag to look around, pinch to zoom') + '</span><button type="button" aria-label="Close">✕</button></div><div class="lb-body"></div>';
    var c = svg.cloneNode(true);
    c.removeAttribute('id'); c.removeAttribute('style'); c.setAttribute('width', w); c.removeAttribute('height');
    c.style.cssText = 'width:' + w + 'px;max-width:none;min-width:0;height:auto;display:block';
    box.querySelector('.lb-body').appendChild(c);
    box.querySelector('button').addEventListener('click', closeBox);
    box.addEventListener('click', function (e) { if (e.target === box) closeBox(); });
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', (lang === 'ta' ? 'படம்' : 'Diagram'));
    doc.body.appendChild(box); doc.addEventListener('keydown', onKey);
    if (window.StemModal) boxModal = window.StemModal.open(box, box.querySelector('button'));
    else box.querySelector('button').focus();
  }
  doc.addEventListener('click', function (e) {
    var d = e.target.closest && e.target.closest('.qdiagram');
    if (!d || e.target.closest('button,a,input')) return;
    var svg = d.querySelector('svg');
    if (svg) openBox(svg);
  });
  /* diagrams wider than the screen show a "swipe" hint on the right edge */
  function mark() {
    [].forEach.call(doc.querySelectorAll('.qdiagram'), function (d) {
      d.classList.toggle('pannable', d.scrollWidth > d.clientWidth + 6 && d.scrollLeft < d.scrollWidth - d.clientWidth - 6);
      d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', 'Open diagram full screen');
      if (!d.nextElementSibling || !d.nextElementSibling.classList.contains('qd-cap')) {
        var cap = doc.createElement('div'); cap.className = 'qd-cap';
        var ta = false; try { ta = localStorage.getItem('lessonLang') === 'ta'; } catch (e) {}
        cap.textContent = ta ? '⤢ பெரிதாக்க படத்த தொடு' : '⤢ Tap the diagram to enlarge';
        d.parentNode.insertBefore(cap, d.nextSibling);
      }
    });
  }
  /* lesson figures (.fig): a readable minimum width on phones (sideways scroll), and tap to enlarge */
  function markFigs() {
    [].forEach.call(doc.querySelectorAll('.fig'), function (f) {
      var svg = f.querySelector('svg'); if (!svg) return;
      var vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      if (vb.length === 4 && vb[2] > 0) { f.style.setProperty('--fw', Math.round(Math.min(vb[2] * 0.92, 620)) + 'px'); f.style.setProperty('--far', vb[2] + ' / ' + vb[3]); }
      f.classList.toggle('pannable', f.scrollWidth > f.clientWidth + 6 && f.scrollLeft < f.scrollWidth - f.clientWidth - 6);
      if (f.classList.contains('zoomable')) return;
      f.classList.add('zoomable'); f.setAttribute('role', 'button'); f.setAttribute('tabindex', '0'); f.setAttribute('aria-label', 'Open figure full screen');
      var h = doc.createElement('div'); h.className = 'fig-hint'; h.innerHTML = '<span class="en">⤢ Tap to enlarge</span><span class="ta">⤢ பெரிதாக்க தொடு</span>';
      f.appendChild(h);
    });
  }
  doc.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('.fig.zoomable');
    if (!f || e.target.closest('button,a,input')) return;
    var svg = f.querySelector('svg'); if (svg) openBox(svg);
  });
  doc.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('zoomable')) { e.preventDefault(); var s = e.target.querySelector('svg'); if (s) openBox(s); } });
  markFigs();
  window.addEventListener('resize', markFigs);
  doc.addEventListener('scroll', function (e) { if (e.target.classList && e.target.classList.contains('fig')) markFigs(); }, true);
  doc.addEventListener('stem-step', function () { setTimeout(markFigs, 120); });

  window.addEventListener('resize', mark);
  doc.addEventListener('stem-step', function () { setTimeout(mark, 150); });
  doc.addEventListener('scroll', function (e) { if (e.target.classList && e.target.classList.contains('qdiagram')) mark(); }, true);
  doc.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('qdiagram')) { e.preventDefault(); var s = e.target.querySelector('svg'); if (s) openBox(s); } });
  setTimeout(mark, 400);
})();
