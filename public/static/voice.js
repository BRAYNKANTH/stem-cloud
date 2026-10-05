/* STEM Cloud voice: read-aloud for every step, plus the story voices.
 * - Listen button in the lesson bar: reads the text on the current step, sentence by sentence, with the part being read highlighted.
 * - Story: 🔊 switches the voices of Raja and Chittu on (neural Tamil recordings, device voice for English).
 * Uses the phone's own speech engine (speechSynthesis), so it also works for text added later and needs no download. */
(function () {
  'use strict';
  var doc = document, synth = window.speechSynthesis;
  var hasTTS = !!(synth && window.SpeechSynthesisUtterance);

  function lang() { try { return (typeof APP_LANG !== 'undefined' ? APP_LANG : localStorage.getItem('lessonLang')) === 'ta' ? 'ta' : 'en'; } catch (e) { return 'en'; } }
  function L(en, ta) { return lang() === 'ta' ? ta : en; }
  function mk(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function calm() { return doc.documentElement.classList.contains('stem-calm'); }

  function toast(msg) {
    var t = mk('div', 'stem-toast', ''); t.textContent = msg; t.setAttribute('role', 'status');
    doc.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 5200);
  }

  var SVGO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON = {
    speaker: SVGO + '<path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    pause: SVGO + '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    play: SVGO + '<path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    prev: SVGO + '<path d="M6 5v14M19 5 9 12l10 7z" fill="currentColor"/></svg>',
    next: SVGO + '<path d="M18 5v14M5 5l10 7L5 19z" fill="currentColor"/></svg>',
    stop: SVGO + '<path d="M6 6l12 12M18 6 6 18"/></svg>',
    mic: SVGO + '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'
  };

  /* ------------------------------------------------------------------ voices */
  var voices = [];
  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (hasTTS) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { synth.onvoiceschanged = loadVoices; } }
  function vlang(v) { return String(v.lang || '').replace('_', '-').toLowerCase(); }
  var FEMALE = /female|zira|heera|neerja|swara|pallavi|sonia|susan|hazel|samantha|karen|lekha|vani|kalpana|aditi|raveena|priya/i;
  var MALE = /\bmale\b|ravi|prabhat|valluvar|hemant|david|mark|guy|daniel|alex|rishi|kumar|madhur/i;
  function hasVoice(lg) { return voices.some(function (v) { return vlang(v).indexOf(lg) === 0; }); }
  function voicesFor(lg) { return voices.filter(function (v) { return vlang(v).indexOf(lg) === 0; }); }
  function pickVoice(lg, who) {
    var saved = store('stem_voice_' + lg);                      /* the voice the student chose */
    if (saved) { var sv = voices.filter(function (v) { return v.name === saved; })[0]; if (sv) return sv; }
    var prefixes = lg === 'ta' ? ['ta'] : ['en-in', 'en-gb', 'en-us', 'en'];
    for (var i = 0; i < prefixes.length; i++) {
      var m = voices.filter(function (v) { return vlang(v).indexOf(prefixes[i]) === 0; });
      if (!m.length) continue;
      var good = m.filter(function (v) { return /google|natural|online|neural/i.test(v.name); });
      var pool = good.length ? good : m;
      var want = who === 'C' ? FEMALE : (who === 'R' ? MALE : null);
      if (want) { var w = pool.filter(function (v) { return want.test(v.name); }); if (w.length) return w[0]; }
      return pool[0];
    }
    return null;
  }

  /* ------------------------------------------------------------------ make symbols and units sayable */
  var EN = [
    [/(\d)\s*m\s*s\s*[-−]\s*2\b/g, '$1 metres per second squared'], [/(\d)\s*m\s*s\s*[-−]\s*1\b/g, '$1 metres per second'],
    [/m\s*\/\s*s\s*[²2]/g, 'metres per second squared'], [/m\s*\/\s*s\b/g, 'metres per second'], [/m\s*s\s*[-−]\s*2\b/g, 'metres per second squared'], [/m\s*s\s*[-−]\s*1\b/g, 'metres per second'],
    [/(\d)\s*N\s*m\b/g, '$1 newton metres'], [/(\d)\s*N\b/g, '$1 newtons'], [/(\d)\s*kg\b/g, '$1 kilograms'], [/(\d)\s*km\b/g, '$1 kilometres'], [/(\d)\s*cm\b/g, '$1 centimetres'],
    [/(\d)\s*m\b/g, '$1 metres'], [/(\d)\s*s\b/g, '$1 seconds'], [/(\d)\s*g\b/g, '$1 grams'], [/(\d)\s*°\s*C\b/g, '$1 degrees celsius'], [/(\d)\s*°/g, '$1 degrees'],
    [/F\s*=\s*m\s*a\b/g, 'F equals m a'], [/μ/g, ' mu '], [/Δ/g, ' delta '], [/θ/g, ' theta '], [/√/g, ' square root of '],
    [/×/g, ' times '], [/÷/g, ' divided by '], [/\s[−–-]\s(?=\d)/g, ' minus '], [/=/g, ' equals '], [/\+/g, ' plus '], [/≈/g, ' approximately '], [/≤/g, ' less than or equal to '], [/≥/g, ' greater than or equal to '],
    [/²/g, ' squared'], [/³/g, ' cubed'], [/→|⟶|⇒/g, ', ']
  ];
  var TA = [
    [/(\d)\s*m\s*s\s*[-−]\s*2\b/g, '$1 மீட்டர் பெர் செகண்ட் ஸ்கொயர்'], [/(\d)\s*m\s*s\s*[-−]\s*1\b/g, '$1 மீட்டர் பெர் செகண்ட்'],
    [/m\s*\/\s*s\s*[²2]/g, 'மீட்டர் பெர் செகண்ட் ஸ்கொயர்'], [/m\s*\/\s*s\b/g, 'மீட்டர் பெர் செகண்ட்'],
    [/(\d)\s*N\s*m\b/g, '$1 நியூட்டன் மீட்டர்'], [/(\d)\s*N\b/g, '$1 நியூட்டன்'], [/(\d)\s*kg\b/g, '$1 கிலோகிராம்'], [/(\d)\s*km\b/g, '$1 கிலோமீட்டர்'], [/(\d)\s*cm\b/g, '$1 சென்டிமீட்டர்'],
    [/(\d)\s*m\b/g, '$1 மீட்டர்'], [/(\d)\s*s\b/g, '$1 விநாடி'], [/(\d)\s*g\b/g, '$1 கிராம்'], [/(\d)\s*°/g, '$1 டிகிரி'],
    [/F\s*=\s*m\s*a\b/g, 'எஃப் சமம் எம் ஏ'], [/μ/g, ' மியூ '], [/Δ/g, ' டெல்டா '], [/θ/g, ' தீட்டா '], [/√/g, ' வர்க்கமூலம் '],
    [/×/g, ' பெருக்கல் '], [/÷/g, ' வகுத்தல் '], [/\s[−–-]\s(?=\d)/g, ' கழித்தல் '], [/=/g, ' சமம் '], [/\+/g, ' கூட்டல் '], [/≈/g, ' கிட்டத்தட்ட '],
    [/²/g, ' ஸ்கொயர்'], [/³/g, ' கியூப்'], [/→|⟶|⇒/g, ', ']
  ];
  var SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4' };
  function speakable(t, lg) {
    t = String(t).replace(/[₀-₄]/g, function (c) { return ' ' + SUB[c]; });
    t = t.replace(/[←-⇿⌀-⏿☀-➿⬀-⯿️‍]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, ' ');   /* emoji and arrows, ticks */
    (lg === 'ta' ? TA : EN).forEach(function (r) { t = t.replace(r[0], r[1]); });
    if (lg === 'ta') t = t.replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }
  function chunks(t) {                                              /* sentences, split further if very long (some engines stop after ~15 s) */
    var s = t.match(/[^.!?…]+[.!?…]*\s*/g) || [t], out = [];
    s.forEach(function (x) {
      x = x.trim(); if (!x) return;
      while (x.length > 190) { var cut = x.lastIndexOf(',', 190); if (cut < 60) cut = x.lastIndexOf(' ', 190); if (cut < 60) cut = 190; out.push(x.slice(0, cut + 1)); x = x.slice(cut + 1).trim(); }
      if (x) out.push(x);
    });
    return out;
  }

  /* ------------------------------------------------------------------ speak */
  var gen = 0, audio = null;
  function silence() {
    gen++;
    if (hasTTS) { try { synth.cancel(); } catch (e) {} }
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
  }
  function speak(text, o, done) {                                   /* o: {who, rate} */
    o = o || {};
    var lg = lang(), parts = chunks(speakable(text, lg)), my = ++gen, i = 0;
    if (!hasTTS || !parts.length) { if (done) done(); return; }
    function nextPart() {
      if (my !== gen) return;
      if (i >= parts.length) { if (done) done(); return; }
      var u = new SpeechSynthesisUtterance(parts[i++]);
      var v = pickVoice(lg, o.who);
      u.lang = lg === 'ta' ? 'ta-IN' : 'en-IN';
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = o.rate || state.rate;
      u.pitch = o.who === 'R' ? 1.12 : (o.who === 'C' ? 1.3 : 1);
      u.onend = nextPart; u.onerror = function () { if (my === gen) nextPart(); };
      try { synth.speak(u); } catch (e) { if (done) done(); }
    }
    try { synth.cancel(); } catch (e) {}
    nextPart();
    return my;
  }
  function needTamilVoice() {
    if (lang() !== 'ta' || !hasTTS) return false;
    loadVoices();
    if (hasVoice('ta')) return false;
    toast('Tamil voice is not installed on this phone. Open Settings, then Text-to-speech (Google), and download the Tamil voice. English reading works now.');
    return true;
  }

  /* ------------------------------------------------------------------ read-aloud for a step */
  function defaultRate() { return parseFloat(store('stem_rate')) || (lang() === 'ta' ? 1.1 : 1); }   /* spoken Tamil is brisk; a slow voice sounds like a news reader */
  var state = { rate: defaultRate(), list: [], i: -1, on: false, paused: false };
  var RATES = [0.9, 1, 1.1, 1.25, 1.5];
  var SEL = 'h1,h2,h3,h4,p,li,dt,dd,blockquote,figcaption,.fw-sub,.sub,.work,.note,.exq > span:not(.exnum),.qlead,.qpart > .qt,.so-title,.fw-hint';
  var SKIP = '#stem-bar,#stem-vp,.stem-map,.stem-menu,nav,button,script,style,svg,.stem-nospeak,.so-hint,.stem-toast,.topbar,.xpbar,.stem-welcome-banner,.bs-pic,.bs-ic,.stem-coach';

  function visibleRoots() {
    var wrap = doc.querySelector('.wrap'), r = [];
    if (wrap) [].forEach.call(wrap.children, function (c) { if (!c.classList.contains('stem-hide')) r.push(c); });
    var f = doc.querySelector('footer'); if (f && !f.classList.contains('stem-hide')) r.push(f);
    return r;
  }
  function collect() {
    var all = [];
    visibleRoots().forEach(function (root) { [].forEach.call(root.querySelectorAll(SEL), function (e) { all.push(e); }); });
    var set = all.filter(function (e) {
      if (e.closest(SKIP) || !e.getClientRects().length || e.offsetParent === null) return false;
      var t = (e.innerText || '').trim();
      return t.length > 1 && /[\p{L}\p{N}]/u.test(t);
    });
    return set.filter(function (e) {                                 /* keep the innermost blocks only */
      for (var k = 0; k < set.length; k++) if (set[k] !== e && e.contains(set[k])) return false;
      return true;
    });
  }
  function firstInView(list) {
    var top = (doc.querySelector('.topbar') ? doc.querySelector('.topbar').offsetHeight : 0) + (doc.querySelector('.xpbar') ? doc.querySelector('.xpbar').offsetHeight : 0);
    for (var k = 0; k < list.length; k++) { var r = list[k].getBoundingClientRect(); if (r.bottom > top + 30) return k; }
    return 0;
  }

  var vp = null, listenBtn = null;
  function setBtn() {
    if (!listenBtn) return;
    listenBtn.innerHTML = state.on && !state.paused ? ICON.pause : ICON.speaker;
    listenBtn.classList.toggle('on', state.on);
    listenBtn.setAttribute('aria-label', state.on && !state.paused ? L('Pause reading', 'படிப்பதை நிறுத்து') : L('Read this step aloud', 'இந்த படியை படிச்சுக் காட்டு'));
    if (vp) {
      vp.querySelector('[data-a="pp"]').innerHTML = state.paused ? ICON.play : ICON.pause;
      vp.querySelector('[data-a="rate"]').textContent = state.rate + '×';
      vp.querySelector('.vp-pos').textContent = (state.i + 1) + ' / ' + state.list.length;
    }
  }
  function clearHi() { [].forEach.call(doc.querySelectorAll('.stem-reading'), function (e) { e.classList.remove('stem-reading'); }); }
  function stopReading() {
    silence(); state.on = false; state.paused = false; state.list = []; state.i = -1; clearHi();
    if (vp) { vp.remove(); vp = null; }
    setBtn();
  }
  function readAt(i) {
    if (i < 0) i = 0;
    if (i >= state.list.length) { stopReading(); return; }
    state.i = i; state.paused = false; clearHi();
    var el = state.list[i]; el.classList.add('stem-reading');
    try { el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' }); } catch (e) { el.scrollIntoView(); }
    setBtn();
    var me = ++stamp;
    speak(el.innerText, { who: null }, function () { if (me === stamp && state.on && !state.paused) readAt(state.i + 1); });
  }
  var stamp = 0;
  function startReading(from) {
    if (!hasTTS) { toast(L('This browser cannot read aloud.', 'இந்த பிரவுசர் படிச்சுக் காட்ட முடியாது.')); return; }
    if (needTamilVoice()) return;
    state.list = collect();
    if (!state.list.length) { toast(L('Nothing to read here.', 'இங்க படிக்க எதுவும் இல்ல.')); return; }
    state.on = true;
    buildVp();
    readAt(typeof from === 'number' ? from : firstInView(state.list));
  }
  function pauseReading() { stamp++; silence(); state.paused = true; setBtn(); }
  function resumeReading() { state.paused = false; readAt(state.i); }

  function changeVoice() {                                          /* cycle through the voices installed on this phone */
    loadVoices();
    var lg = lang(), list = voicesFor(lg);
    if (!list.length) { needTamilVoice() || toast(L('No other voice found on this phone.', 'இந்த போன்ல வேற குரல் இல்ல.')); return; }
    var cur = pickVoice(lg, null), k = list.indexOf(cur);
    var nv = list[(k + 1) % list.length];
    store('stem_voice_' + lg, nv.name);
    toast((lg === 'ta' ? 'குரல்: ' : 'Voice: ') + nv.name + (list.length > 1 ? ' (' + ((list.indexOf(nv)) + 1) + '/' + list.length + ')' : ''));
    if (state.on && !state.paused) { stamp++; readAt(state.i); }
  }
  function buildVp() {
    if (vp) return;
    vp = mk('div', '', '');
    vp.id = 'stem-vp'; vp.setAttribute('role', 'group'); vp.setAttribute('aria-label', 'Reading controls');
    vp.innerHTML = '<button type="button" data-a="prev" aria-label="Previous">' + ICON.prev + '</button><button type="button" data-a="pp" aria-label="Pause">' + ICON.pause + '</button>' +
      '<button type="button" data-a="next" aria-label="Next">' + ICON.next + '</button><button type="button" data-a="rate" aria-label="Speed">1×</button>' +
      '<button type="button" data-a="voice" aria-label="Change voice">' + ICON.mic + '</button>' +
      '<span class="vp-pos"></span><button type="button" data-a="stop" aria-label="Stop">' + ICON.stop + '</button>';
    vp.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var a = b.getAttribute('data-a');
      if (a === 'prev') { stamp++; readAt(state.i - 1); }
      else if (a === 'next') { stamp++; readAt(state.i + 1); }
      else if (a === 'pp') { state.paused ? resumeReading() : pauseReading(); }
      else if (a === 'rate') { state.rate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length]; store('stem_rate', String(state.rate)); if (!state.paused) { stamp++; readAt(state.i); } setBtn(); }
      else if (a === 'voice') { changeVoice(); }
      else if (a === 'stop') stopReading();
    });
    doc.body.appendChild(vp);
  }
  /* while reading, tapping any sentence continues from there */
  doc.addEventListener('click', function (e) {
    if (!state.on || e.target.closest('button,a,input,select,#stem-vp,#stem-bar')) return;
    var k = state.list.findIndex(function (x) { return x.contains(e.target); });
    if (k >= 0) { stamp++; readAt(k); }
  });

  /* ------------------------------------------------------------------ the bar button */
  function mountBar() {
    var slot = doc.getElementById('sb-slot');
    if (!slot || !hasTTS) return;
    listenBtn = mk('button', 'sb-btn sb-listen', ICON.speaker); listenBtn.type = 'button';
    listenBtn.addEventListener('click', function () {
      var cur = window.StemPlayer && window.StemPlayer.current && window.StemPlayer.stepIds[window.StemPlayer.current() - 1];
      if (cur === 'story') { toggleStory(); return; }
      if (!state.on) startReading(); else if (state.paused) resumeReading(); else pauseReading();
    });
    slot.appendChild(listenBtn); setBtn();
  }

  /* ------------------------------------------------------------------ story voices */
  var MODES = ['off', 'rec', 'tts'];
  var storyMode = store('stem_story_mode') || (store('stem_story_voice') === 'on' ? 'rec' : 'off');
  var lastLine = null, storyBtn = null;
  function storyVisible() { var s = doc.getElementById('story'); return !!(s && s.offsetParent !== null); }
  function playLine(d) {
    silence();
    if (!d || storyMode === 'off') return;
    function viaTTS() { if (needTamilVoice()) return; speak(d.text, { who: d.who }); }
    if (storyMode === 'tts') { viaTTS(); return; }
    /* recordings: Tamil in /audio/story/<id>/lineNN.mp3, English (when recorded) in /audio/story/<id>/en/lineNN.mp3 */
    var a = new Audio('/static/audio/story/' + d.id + '/' + (lang() === 'ta' ? '' : 'en/') + 'line' + ('0' + d.i).slice(-2) + '.mp3');
    a.playbackRate = state.rate;
    try { a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true; } catch (e) {}
    audio = a; var my = gen;
    a.addEventListener('error', function () { if (my === gen) { audio = null; viaTTS(); } });
    var p = a.play(); if (p && p.catch) p.catch(function () { if (my === gen) { audio = null; viaTTS(); } });
  }
  function toggleStory() {
    storyMode = MODES[(MODES.indexOf(storyMode) + 1) % MODES.length]; store('stem_story_mode', storyMode);
    paintStory();
    if (storyMode === 'off') { silence(); return; }
    if (storyMode === 'tts' && !hasTTS) { toast(L('This browser cannot read aloud.', 'இந்த பிரவுசர் படிச்சுக் காட்ட முடியாது.')); return; }
    playLine(lastLine);
  }
  function paintStory() {
    if (!storyBtn) return;
    var on = storyMode !== 'off';
    var off = ICON.speaker.replace('<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>', '<path d="M16 9l5 6M21 9l-5 6"/>');
    var label = storyMode === 'rec' ? L('Recorded voices', 'பதிவு செஞ்ச குரல்') : (storyMode === 'tts' ? L('Phone voice', 'போன் குரல்') : L('Voices off', 'குரல் ஆஃப்'));
    storyBtn.setAttribute('aria-pressed', String(on)); storyBtn.classList.toggle('on', on);
    /* icon only: speaker = recorded voices, phone = the phone's own voice, crossed speaker = off (the words stay as the tooltip / screen-reader label) */
    storyBtn.innerHTML = storyMode === 'tts' ? '<span class="sv-phone" aria-hidden="true">📱</span>' : (on ? ICON.speaker : off);
    storyBtn.setAttribute('aria-label', label); storyBtn.title = label;
  }
  function mountStory() {
    var head = doc.querySelector('.so-head'); if (!head) return;
    storyBtn = mk('button', 'so-voice', ''); storyBtn.type = 'button'; head.appendChild(storyBtn);
    storyBtn.addEventListener('click', toggleStory); paintStory();
    window.addEventListener('stem-story-line', function (e) {
      lastLine = e.detail;
      if (storyMode !== 'off' && storyVisible()) playLine(lastLine);
    });
    var lt = doc.getElementById('langToggle'); if (lt) lt.addEventListener('click', function () { setTimeout(paintStory, 80); });
  }

  /* ------------------------------------------------------------------ housekeeping */
  doc.addEventListener('stem-step', function () { stopReading(); silence(); });
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) { stopReading(); } });
  window.addEventListener('pagehide', function () { silence(); });
  var lt2 = doc.getElementById('langToggle'); if (lt2) lt2.addEventListener('click', function () { stopReading(); silence(); setTimeout(function () { if (!store('stem_rate')) state.rate = defaultRate(); setBtn(); }, 80); });

  window.StemVoice = { speak: function (t, o) { return speak(t, o); }, stop: function () { stopReading(); silence(); }, available: hasTTS, hasTamil: function () { loadVoices(); return hasVoice('ta'); }, _speakable: speakable, _chunks: chunks };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mountBar(); mountStory(); }); else { mountBar(); mountStory(); }
  /* the bar is created by player.js, which loads before this file */
})();
