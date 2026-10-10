/* STEM Cloud quiz feedback sheet.
 * A lesson quiz question locks after one answer and marks the right option (the lesson's own code).
 * This adds the app-style answer sheet at the bottom of the screen: "Correct!" or "Not quite" with the right answer,
 * the explanation, and one button on to the next question. The explanation inside the card stays for review once the sheet is closed. */
(function () {
  'use strict';
  var doc = document;
  if (!doc.querySelector('#quizContainer')) return;

  function lang() { try { var l = localStorage.getItem('lessonLang'); return l === 'ta' ? 1 : (l === 'si' ? 2 : 0); } catch (e) { return 0; } }
  function T(en, ta, si) { var k = lang(); return k === 1 ? ta : (k === 2 ? si : en); }
  var TICK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var sheet = doc.createElement('section'), card = null;
  sheet.id = 'stem-qsheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'false');
  sheet.setAttribute('aria-labelledby', 'qs-h');
  sheet.setAttribute('aria-describedby', 'qs-d');
  doc.body.appendChild(sheet);

  function close(focusNext) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    doc.documentElement.classList.remove('qsheet-open');
    if (card) card.classList.remove('qz-in-sheet');
    var cards = [].slice.call(doc.querySelectorAll('.qz-card')), next = cards[cards.indexOf(card) + 1];
    if (!focusNext) return;
    if (next) {
      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var o = next.querySelector('.qz-opt'); if (o) o.focus({ preventScroll: true });
    } else {
      var s = doc.getElementById('quizScore'), box = s && (s.closest('.quiz-score') || s.parentNode);
      if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); }
    }
  }

  function open(c, picked) {
    card = c;
    var right = picked.classList.contains('correct');
    var answer = c.querySelector('.qz-opt.correct'), ex = c.querySelector('.qz-explain');
    var cards = doc.querySelectorAll('.qz-card'), last = c === cards[cards.length - 1];
    sheet.className = right ? 'ok' : 'no';
    sheet.innerHTML =
      '<div class="qs-head"><span class="qs-ic" aria-hidden="true">' + (right ? TICK : CROSS) + '</span><b id="qs-h">' + (right ? T('Correct!', 'சரி!', 'නිවැරදියි!') : T('Not quite', 'சரியில்ல', 'හරියටම නෑ')) + '</b></div>' +
      '<div id="qs-d">' + (right || !answer ? '' : '<p class="qs-ans">' + T('The answer is: ', 'சரியான பதில்: ', 'නිවැරදි පිළිතුර: ') + '<strong></strong></p>') +
      (ex ? '<div class="qs-why"></div>' : '') + '</div>' +
      '<button type="button" class="qs-go">' + (last ? T('See my score', 'என் மதிப்பெண்', 'මගේ ලකුණු') : T('Next question', 'அடுத்த கேள்வி', 'ඊළඟ ප්‍රශ්නය')) + '</button>';
    if (!right && answer) sheet.querySelector('.qs-ans strong').textContent = answer.textContent.trim();
    if (ex) sheet.querySelector('.qs-why').innerHTML = ex.innerHTML;     /* the lesson's own explanation markup (sub/sup, bold) */
    sheet.querySelector('.qs-go').addEventListener('click', function () { close(true); });
    c.classList.add('qz-in-sheet');
    sheet.hidden = false;
    doc.documentElement.classList.add('qsheet-open');
    sheet.querySelector('.qs-go').focus({ preventScroll: true });
    /* keep the answered options in sight above the sheet */
    var opts = c.querySelector('.qz-opts'), r = (opts || c).getBoundingClientRect(), room = innerHeight - sheet.offsetHeight - 12;
    if (r.bottom > room) scrollBy({ top: Math.min(r.bottom - room, Math.max(0, r.top - 70)), behavior: 'smooth' });
  }

  /* after the lesson's own handler has marked the answer */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.qz-opt');
    if (!b) return;
    var c = b.closest('.qz-card');
    if (!c) return;
    setTimeout(function () { if (b.classList.contains('correct') || b.classList.contains('wrong')) open(c, b); }, 0);
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) { close(false); if (card) { card.setAttribute('tabindex', '-1'); card.focus(); } } });   /* its options are disabled now, so the card itself takes focus */
  /* leaving the quiz step closes it */
  doc.addEventListener('stem-step', function () { close(false); });
})();
