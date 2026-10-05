/* STEM Cloud story: swipe between Raja's and Chittu's lines (instead of Next / Back buttons).
 * Swipe left = next line, swipe right = previous line, a tap on the speech bubble also goes on. */
(function () {
  'use strict';
  var doc = document;
  var stage = doc.querySelector('.so-stage'), next = doc.getElementById('so_next'), prev = doc.getElementById('so_prev');
  var bubble = doc.getElementById('so_bubble'), chars = doc.querySelector('.so-chars');
  if (!stage || !next || !prev || !bubble) return;

  function lang() { try { return (typeof APP_LANG !== 'undefined' ? APP_LANG : localStorage.getItem('lessonLang')) === 'ta' ? 'ta' : 'en'; } catch (e) { return 'en'; } }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(5); } catch (e) {} }
  var swipes = 0;
  try { swipes = parseInt(localStorage.getItem('stem_swipes') || '0', 10) || 0; } catch (e) {}

  /* a quiet hint instead of big buttons */
  var hint = doc.createElement('div');
  hint.className = 'so-hint';
  hint.innerHTML = '<span class="so-arr" aria-hidden="true">‹</span><span class="so-finger" aria-hidden="true">👆</span><span class="so-arr" aria-hidden="true">›</span><span class="so-hint-t"></span>';
  var ctrls = stage.querySelector('.so-ctrls');
  if (ctrls) ctrls.parentNode.insertBefore(hint, ctrls.nextSibling);
  function hintText() {
    var t = hint.querySelector('.so-hint-t');
    t.textContent = lang() === 'ta' ? 'தொடர்ந்து படிக்க ஸ்வைப் பண்ணு' : 'swipe to read on';   /* read by screen readers only; sighted students see the moving finger */
    hint.classList.toggle('quiet', swipes >= 3);
  }
  hintText();
  doc.addEventListener('stem-step', hintText);
  var lt = doc.getElementById('langToggle'); if (lt) lt.addEventListener('click', function () { setTimeout(hintText, 60); });

  function slide(dir) {                                              /* dir 1 = new line comes from the right */
    var cls = dir > 0 ? 'so-in-r' : 'so-in-l';
    [bubble, chars].forEach(function (el) { if (!el) return; el.classList.remove('so-in-r', 'so-in-l'); void el.offsetWidth; el.classList.add(cls); });
    setTimeout(function () { [bubble, chars].forEach(function (el) { if (el) el.classList.remove('so-in-r', 'so-in-l'); }); }, 320);
  }
  function isTyping() { var c = doc.getElementById('so_caret'); return !!c && c.style.display !== 'none'; }
  function lineNo() { return [].findIndex.call(doc.querySelectorAll('.so-dots i'), function (i) { return i.classList.contains('now'); }); }
  function advance(dir, tap) {
    var btn = dir > 0 ? next : prev;
    if (btn.disabled) { wobble(); return; }
    var isLast = doc.getElementById('so_cta') && doc.getElementById('so_cta').classList.contains('show');
    if (dir > 0 && isLast && !isTyping()) { wobble(); return; }
    var before = lineNo();
    /* the story's own Next first finishes a line that is still being typed; a swipe should always move on, a tap only skips the typing */
    if (dir > 0 && !tap && isTyping()) btn.click();
    btn.click();
    if (lineNo() !== before) {
      slide(dir); buzz();
      swipes++; try { localStorage.setItem('stem_swipes', String(swipes)); } catch (e) {}
      hintText();
    }
  }
  function wobble() { bubble.classList.remove('so-wobble'); void bubble.offsetWidth; bubble.classList.add('so-wobble'); }

  /* gesture */
  var sx = 0, sy = 0, st = 0, dx = 0, active = false, horiz = false, pid = null;
  function skip(t) { return t.closest && t.closest('button, a, input, .so-voice'); }
  stage.addEventListener('pointerdown', function (e) {
    if (skip(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    active = true; horiz = false; sx = e.clientX; sy = e.clientY; st = Date.now(); dx = 0; pid = e.pointerId;
    bubble.style.transition = 'none';
  });
  stage.addEventListener('pointermove', function (e) {
    if (!active || e.pointerId !== pid) return;
    dx = e.clientX - sx;
    var dy = e.clientY - sy;
    if (!horiz && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) { horiz = true; try { stage.setPointerCapture(pid); } catch (er) {} }
    if (horiz) {
      var lim = Math.max(-90, Math.min(90, dx * 0.55));
      bubble.style.transform = 'translateX(' + lim + 'px)'; bubble.style.opacity = String(1 - Math.min(0.45, Math.abs(lim) / 160));
    }
  });
  function end(e) {
    if (!active || (e && e.pointerId !== pid)) return;
    active = false;
    bubble.style.transition = 'transform .2s ease, opacity .2s ease';
    bubble.style.transform = ''; bubble.style.opacity = '';
    var dt = Date.now() - st;
    if (horiz && Math.abs(dx) > 48) advance(dx < 0 ? 1 : -1);
    else if (!horiz && Math.abs(dx) < 8 && dt < 400 && e && e.type === 'pointerup') advance(1, true);   /* tap */
    horiz = false;
    setTimeout(function () { bubble.style.transition = ''; }, 230);
  }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  /* keyboard: arrow keys while the story is on screen */
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (/input|textarea|select/i.test((e.target.tagName || '')) || !stage.offsetParent) return;
    e.preventDefault(); advance(e.key === 'ArrowRight' ? 1 : -1);
  });
})();
