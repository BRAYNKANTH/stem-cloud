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
      if (window.StemPlayer && window.StemPlayer.active) { window.StemPlayer.openMap(); return; }   /* lesson map instead of the link list */
      var open = nav.classList.toggle('stem-open');
      b.setAttribute('aria-expanded', String(open)); b.textContent = open ? '✕' : '☰';
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    doc.addEventListener('click', function (e) { if (!nav.contains(e.target) && e.target !== b) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 760) close(); });
  }

  /* the "Step n/12" pill hides while scrolling down (when it covers the text) and returns on scroll up */
  var lastY = window.pageYOffset, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var y = window.pageYOffset, d = y - lastY;
      if (y < 120 || d < -6) doc.body.classList.remove('stem-down');
      else if (d > 12) doc.body.classList.add('stem-down');
      lastY = y; ticking = false;
    });
  }, { passive: true });

  /* remember the lesson for the hub's "continue where you left off" card */
  try { if (doc.getElementById('fw_path')) localStorage.setItem('stem_last_lesson', location.pathname.split('/').pop()); } catch (e) {}

  /* the language button names the language it switches to, for screen readers and as a tooltip */
  function langLabel() {
    var lt = doc.getElementById('langToggle'); if (!lt) return;
    var ta = false; try { ta = localStorage.getItem('lessonLang') === 'ta'; } catch (e) {}
    var l = ta ? 'Switch to English' : 'தமிழுக்கு மாற்று (Switch to Tamil)';
    lt.setAttribute('aria-label', l); lt.title = l;
  }
  langLabel();
  var ltb = doc.getElementById('langToggle'); if (ltb) ltb.addEventListener('click', function () { setTimeout(langLabel, 120); });

  /* New user onboarding banner helper */
  function initOnboarding() {
    if (!doc.getElementById('fw_path')) return;   /* lesson pages only: the hub has its own welcome card */
    if (localStorage.getItem('stem_hide_onboarding') || window.StemPlayer) return;     /* the picture coach (player.js) replaces this text banner */
    var hero = doc.querySelector('.hero') || doc.querySelector('.wrap');
    if (!hero) return;
    
    var banner = doc.createElement('div');
    banner.className = 'stem-welcome-banner';
    function text() {
      var ta = false; try { ta = localStorage.getItem('lessonLang') === 'ta'; } catch (e) {}
      return ta
        ? '<b>எப்படி வேலை செய்யுது:</b> <b>தொடங்கு ›</b> அழுத்து, அப்புறம் ஒவ்வொரு படியா <b>அடுத்து ›</b>. கதைய ஸ்வைப் பண்ணு 👉, 🔊 அழுத்தினா எந்த பக்கத்தையும் படிச்சுக் காட்டும்.'
        : '<b>How it works:</b> tap <b>Start ›</b>, then <b>Next ›</b> through each step. Swipe the story 👉, and tap 🔊 to hear any page read aloud.';
    }
    banner.innerHTML =
      '<div class="icon">🚀</div>' +
      '<div class="txt">' + text() + '</div>' +
      '<button type="button" class="dismiss" aria-label="Close guide">✕</button>';
    var lt = doc.getElementById('langToggle');
    if (lt) lt.addEventListener('click', function () { setTimeout(function () { var t = banner.querySelector('.txt'); if (t) t.innerHTML = text(); }, 80); });

    var closeBtn = banner.querySelector('.dismiss');
    closeBtn.onclick = function() {
      banner.remove();
      localStorage.setItem('stem_hide_onboarding', 'true');
    };

    hero.parentNode.insertBefore(banner, hero.nextSibling);
    doc.addEventListener('stem-step', function (e) {
      if (e.detail && e.detail.index > 0) { banner.remove(); try { localStorage.setItem('stem_hide_onboarding', 'true'); } catch (x) {} }
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initOnboarding);
  } else {
    initOnboarding();
  }
})();
