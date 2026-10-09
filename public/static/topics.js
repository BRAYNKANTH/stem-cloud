/* STEM Cloud topic pages: Subject > Chapter > Topic > learning steps (Understand, Watch, Explore, Practice).
 * One page, /topics/<chapter slug>, shows the chapter overview, a topic, or the chapter revision, chosen by the address:
 *   /topics/<slug>                     chapter overview
 *   /topics/<slug>?t=<topic>&s=<step>  one learning step of a topic (understand | watch | explore | practice)
 *   /topics/<slug>?r=1&s=<part>        chapter revision (summary | mixed | quiz)
 * The content comes from /lessons/topics/<slug>.json (built from the lesson page by tools/build_topics.py).
 * Progress is saved in the key scx_topics_<chapter id> and keeps three things apart:
 *   v = the step was opened, d = the student did what the step asks (read it, watched it, answered, tried every question),
 *   q = one record per practice question: attempts, ever correct, correct at the first try. Opening a page never counts as mastery. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, app = doc.getElementById('app');
  var slug = (location.pathname.match(/\/topics\/([a-z0-9-]+)/) || [])[1] || new URLSearchParams(location.search).get('c') || '';
  var STEPS = ['understand', 'watch', 'explore', 'practice'];
  /* English only for now: Tamil and Sinhala wording for these labels has to be written and reviewed by the content team.
     (The lesson text itself, notes, questions and answers, still follows the language button.) */
  var NAME = { understand: 'Understand', watch: 'Watch', explore: 'Explore', practice: 'Practice' };
  var WHAT = { understand: 'Introductory notes', watch: 'Topic video', explore: 'Story or real-life application', practice: 'Topic exercises' };
  var ICON = { understand: 'book', watch: 'watch', explore: 'explore', practice: 'practice' };          // drawn icons (ui-icons.js)
  function ic(n) { return window.StemIcon ? window.StemIcon(n) : ''; }
  var RPARTS = ['summary', 'mixed', 'quiz'];
  var RNAME = { summary: 'Summary', mixed: 'Mixed practice', quiz: 'Chapter quiz' };
  var RWHAT = { summary: 'Key points, definitions and formulas', mixed: 'Questions that join several topics', quiz: 'Check the whole chapter' };

  var DATA = null, rec = {}, KEY = '', LANG = 'en', ui = { mcq: {}, ex: {}, story: {} };

  /* ---------------------------------------------------------------- small helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pick(o) { return o && (LANG === 'ta' && o.ta ? o.ta : o.en); }          /* lesson text: the Tamil twin when Tamil is chosen */
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function say(t) { if (window.StemLive) window.StemLive.say(t); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------------------------------------------------------------- progress */
  function load() {
    try { rec = JSON.parse(safeGet(KEY) || '{}') || {}; } catch (e) { rec = {}; }
  }
  function save() { safeSet(KEY, JSON.stringify(rec)); }
  function R(id) { return (rec[id] = rec[id] || { v: {}, d: {}, q: {} }); }
  function reread() { load(); }                                       /* the account layer may have merged newer progress from another device */
  function markViewed(id, step) { reread(); var r = R(id); if (!r.v[step]) { r.v[step] = 1; save(); } }
  function markDone(id, step) { reread(); var r = R(id); r.v[step] = 1; if (!r.d[step]) { r.d[step] = 1; save(); return true; } save(); return false; }
  function qrec(id, qid) { return (R(id).q[qid] || null); }
  function recordAnswer(id, qid, ok) {
    reread();
    var r = R(id), q = r.q[qid] || { n: 0, ok: 0, f: 0 };
    q.n += 1;
    if (q.n === 1 && ok) q.f = 1;
    if (ok) q.ok = 1;
    r.q[qid] = q; save();
  }

  function topicOf(id) { for (var i = 0; i < DATA.topics.length; i++) if (DATA.topics[i].id === id) return DATA.topics[i]; return null; }
  function has(t, step) { return t.steps.indexOf(step) >= 0; }
  function stepState(t, step) {
    if (!has(t, step)) return 'soon';
    var r = rec[t.id] || { v: {}, d: {}, q: {} };
    return r.d[step] ? 'done' : (r.v[step] ? 'viewed' : 'todo');
  }
  function topicState(t) {
    var any = false, all = true;
    t.steps.forEach(function (s) { var st = stepState(t, s); if (st !== 'todo') any = true; if (st !== 'done') all = false; });
    var r = rec[t.id];
    if (r && Object.keys(r.q || {}).length) any = true;
    return all ? 'complete' : (any ? 'progress' : 'new');
  }
  function practiceStats(id, items) {
    var r = rec[id] || { q: {} }, s = { total: items.length, tried: 0, mcq: 0, mcqFirst: 0, mcqEver: 0, ex: 0, exTried: 0, exOk: 0 };
    items.forEach(function (it) {
      var q = r.q[it.id], tried = q && q.n > 0;
      if (tried) s.tried++;
      if (it.kind === 'mcq') { s.mcq++; if (tried && q.f) s.mcqFirst++; if (tried && q.ok) s.mcqEver++; }
      else { s.ex++; if (tried) s.exTried++; if (tried && q.ok) s.exOk++; }
    });
    return s;
  }
  function statsLine(s) {
    var parts = [];
    if (s.mcq) parts.push('Multiple choice: ' + s.mcqFirst + ' of ' + s.mcq + ' right first time');
    if (s.ex) parts.push('Self-checked: ' + s.exOk + ' of ' + s.ex + ' marked “I got it”');
    return parts.join(' · ');
  }

  /* where "Start / Continue learning" goes: the first step, in the recommended order, that has not been done yet */
  function nextTarget() {
    reread();
    for (var i = 0; i < DATA.topics.length; i++) {
      var t = DATA.topics[i];
      for (var j = 0; j < t.steps.length; j++) if (stepState(t, t.steps[j]) !== 'done') return { t: t.id, s: t.steps[j] };
    }
    var rv = rec.revision || { d: {} };
    for (var k = 0; k < RPARTS.length; k++) if (!rv.d[RPARTS[k]]) return { r: 1, s: RPARTS[k] };
    return null;
  }
  function started() { return Object.keys(rec).some(function (k) { var r = rec[k]; return Object.keys(r.v || {}).length || Object.keys(r.q || {}).length; }); }

  /* ---------------------------------------------------------------- addresses */
  function url(v) {
    var p = new URLSearchParams();
    if (v.t) p.set('t', v.t); if (v.r) p.set('r', '1'); if (v.s) p.set('s', v.s);
    var q = p.toString();
    return '/topics/' + slug + (q ? '?' + q : '');
  }
  function here() {
    var p = new URLSearchParams(location.search), t = p.get('t'), s = p.get('s');
    if (p.get('r') === '1') return { r: 1, s: RPARTS.indexOf(s) >= 0 ? s : 'summary' };
    var tp = t && topicOf(t);
    if (tp) return { t: tp.id, s: STEPS.indexOf(s) >= 0 ? s : 'understand' };
    return {};
  }
  function go(v, replace) {
    var u = url(v);
    if (replace) history.replaceState(null, '', u); else history.pushState(null, '', u);
    render(true);
  }
  function lessonUrl(hash) { return '/lessons/' + DATA.chapter.lessonFile + (hash ? '#' + hash : ''); }

  /* ---------------------------------------------------------------- pieces */
  function dots(t) {
    return '<span class="tp-dots" aria-hidden="true">' + STEPS.map(function (s) {
      return '<i class="tp-dot ' + stepState(t, s) + '" title="' + NAME[s] + '"></i>';
    }).join('') + '</span>';
  }
  var STATE_TXT = { soon: 'coming soon', done: 'done', viewed: 'opened, not finished', todo: 'not started' };
  function stepSr(t, s) { return NAME[s] + ': ' + STATE_TXT[stepState(t, s)]; }
  function topicStatusText(t) {
    var st = topicState(t), n = t.steps.filter(function (s) { return stepState(t, s) === 'done'; }).length;
    var base = st === 'complete' ? 'Complete' : (st === 'progress' ? 'In progress' : 'Not started');
    var of = n + ' of ' + t.steps.length + ' steps done';
    return { st: st, label: base, detail: of + (t.steps.length < 4 ? ' · ' + (4 - t.steps.length) + ' coming soon' : '') };
  }
  function crumbs(parts) {
    var lead = parts.length > 3;                                      // on a phone only the chapter and the page are shown (subject and grade are in the heading area)
    return '<nav class="tp-crumbs' + (lead ? ' has-lead' : '') + '" aria-label="Where you are"><ol>' + parts.map(function (p, i) {
      var last = i === parts.length - 1;
      return '<li' + (last ? ' aria-current="page"' : '') + '>' + (p.href && !last ? '<a href="' + p.href + '" data-go=\'' + esc(JSON.stringify(p.go || {})) + '\'>' + esc(p.text) + '</a>' : '<span>' + esc(p.text) + '</span>') + '</li>';
    }).join('') + '</ol></nav>';
  }
  function chapterCrumbs() {
    return [{ text: pick(DATA.chapter.subject) }, { text: 'Grade ' + DATA.chapter.grade }];
  }
  function footer(prev, next) {
    function b(x, cls) {
      return x ? '<a class="tp-btn ' + cls + '" href="' + url(x.go) + '" data-go=\'' + esc(JSON.stringify(x.go)) + '\'><span class="tp-sm">' + esc(x.small) + '</span><span class="tp-lg">' + esc(x.text) + '</span></a>' : '<span></span>';
    }
    return '<nav class="tp-foot" aria-label="Previous and next">' + b(prev, 'tp-prev') + b(next, 'tp-next primary') + '</nav>';
  }

  /* ---------------------------------------------------------------- chapter overview */
  function viewOverview() {
    var c = DATA.chapter, tgt = nextTarget(), doneN = DATA.topics.filter(function (t) { return topicState(t) === 'complete'; }).length;
    var qTried = 0, qTotal = 0;
    DATA.topics.forEach(function (t) { var s = practiceStats(t.id, t.practice.items); qTried += s.tried; qTotal += s.total; });
    var cta = tgt ? (started() ? 'Continue learning' : 'Start learning') : 'Review the chapter';
    var ctaGo = tgt || { t: DATA.topics[0].id, s: 'understand' };
    var ctaSub = tgt ? (tgt.t ? topicOf(tgt.t).title.en + ' · ' + NAME[tgt.s] : 'Chapter revision · ' + RNAME[tgt.s]) : 'Every step is done';
    var legacy = safeGet('scx_done_' + c.id) === '1';
    var h = crumbs(chapterCrumbs().concat([{ text: pick(c.title) }])) +
      '<header class="tp-head"><p class="tp-kicker">' + esc(pick(c.subject)) + ' · Grade ' + c.grade + '</p><h1 id="tp-h1" tabindex="-1">' + esc(pick(c.title)) + '</h1>' +
      '<p class="tp-desc">' + esc(c.desc.en) + '</p></header>' +
      '<section class="tp-sum" aria-label="Your progress"><span><b>' + doneN + '</b> of ' + DATA.topics.length + ' topics complete</span>' +
      '<span>Practice tried: <b>' + qTried + '</b> of ' + qTotal + ' questions</span></section>' +
      '<a class="tp-cta" href="' + url(ctaGo) + '" data-go=\'' + esc(JSON.stringify(ctaGo)) + '\'><span class="tp-play" aria-hidden="true">' + (tgt ? '▶' : '↻') + '</span><span class="tp-ctx"><b>' + cta + '</b><small>' + esc(ctaSub) + '</small></span></a>';
    if (legacy) h += '<p class="tp-note">You finished this chapter on the original lesson page. Topic progress is tracked separately, so the topics below start fresh.</p>';
    h += '<section aria-labelledby="tp-topics"><h2 id="tp-topics" class="tp-h2">Topics in the recommended order</h2><ol class="tp-topics">';
    DATA.topics.forEach(function (t) {
      var ts = topicStatusText(t), first = STEPS.filter(function (s) { return has(t, s) && stepState(t, s) !== 'done'; })[0] || 'understand';
      h += '<li class="tp-topic ' + ts.st + '"><a class="tp-tlink" href="' + url({ t: t.id, s: first }) + '" data-go=\'' + esc(JSON.stringify({ t: t.id, s: first })) + '\'>' +
        '<span class="tp-num" aria-hidden="true">' + (ts.st === 'complete' ? '✓' : t.n) + '</span>' +
        '<span class="tp-tbody"><b class="tp-tt">' + esc(pick(t.title)) + '</b><span class="tp-tb">' + esc(t.blurb) + '</span>' +
        '<span class="tp-tmeta">' + dots(t) + '<span class="tp-badge ' + ts.st + '">' + ts.label + '</span><span class="tp-tdet">' + ts.detail + '</span></span></span>' +
        '<span class="tp-go" aria-hidden="true">›</span>' +
        '<span class="sr-only">' + STEPS.map(function (s) { return stepSr(t, s); }).join('; ') + '</span></a></li>';
    });
    h += '</ol></section>';
    var rv = rec.revision || { d: {}, q: {} }, rdone = RPARTS.filter(function (p) { return rv.d[p]; }).length;
    h += '<section class="tp-rev" aria-labelledby="tp-revh"><h2 id="tp-revh" class="tp-h2">Chapter revision</h2><a class="tp-tlink tp-revlink" href="' + url({ r: 1, s: 'summary' }) + '" data-go=\'{"r":1,"s":"summary"}\'>' +
      '<span class="tp-num" aria-hidden="true">★</span><span class="tp-tbody"><b class="tp-tt">Revise the whole chapter</b><span class="tp-tb">Summary, key definitions and formulas, mixed questions and a chapter quiz.</span>' +
      '<span class="tp-tmeta"><span class="tp-badge ' + (rdone === 3 ? 'complete' : (rdone || Object.keys(rv.q || {}).length ? 'progress' : 'new') ) + '">' + (rdone === 3 ? 'Complete' : (rdone ? 'In progress' : 'Not started')) + '</span><span class="tp-tdet">' + rdone + ' of 3 parts done</span></span></span><span class="tp-go" aria-hidden="true">›</span></a></section>';
    h += '<section class="tp-more" aria-labelledby="tp-more"><h2 id="tp-more" class="tp-h2">Also in the full lesson</h2><p class="tp-muted">The original lesson page still has everything else for this chapter.</p><ul>' +
      DATA.extras.map(function (x) { return '<li><a href="' + lessonUrl(x.hash) + '">' + esc(x.title) + '</a></li>'; }).join('') +
      '<li><a href="' + lessonUrl('') + '"><b>Open the full lesson</b></a></li></ul></section>';
    return h;
  }

  /* ---------------------------------------------------------------- understand */
  function glanceHtml(g) {
    var h = '';
    if (g.definitions) h += '<dl class="tp-defs">' + g.definitions.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (g.unit) h += '<p class="tp-unit">' + esc(g.unit) + '</p>';
    if (g.table) {
      h += '<div class="tp-tablewrap"><table class="tp-table"><thead><tr>' + g.table.head.map(function (x) { return '<th scope="col">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        g.table.rows.map(function (r) { return '<tr>' + r.map(function (x, i) { return i === 0 ? '<th scope="row">' + esc(x) + '</th>' : '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    if (g.misconception) h += '<aside class="tp-callout"><b>Common misconception</b><p>' + esc(g.misconception) + '</p></aside>';
    return h;
  }
  function notesBlock(t, open) {
    var u = t.understand;
    return '<details class="tp-details"' + (open ? ' open' : '') + '><summary>Detailed notes</summary><div class="tp-lesson tp-notes">' + u.notes +
      (u.hasLiveDemo ? '<p class="tp-demo">There is an interactive route explorer for this topic in the <a href="' + lessonUrl('notes') + '">full lesson notes</a>.</p>' : '') + '</div></details>';
  }
  function formulasBlock(t) {
    return t.understand.formulas.length ? '<section aria-label="Key formulas" class="tp-formulas"><h3 class="tp-h3">Key formulas</h3><div class="tp-lesson">' + t.understand.formulas.join('') + '</div></section>' : '';
  }
  function stepUnderstand(t) {
    var u = t.understand;
    var h = '<div class="tp-learn"><b>You will learn:</b> ' + esc(t.learn) + '</div>';
    if (u.glance) h += '<section class="tp-glance" aria-label="At a glance">' + glanceHtml(u.glance) + '</section>';
    h += formulasBlock(t) + notesBlock(t, !u.glance);
    var done = stepState(t, 'understand') === 'done';
    h += '<div class="tp-donebar">' + (done ? '<span class="tp-check">✓ You marked this as read</span>' : '<button type="button" class="tp-btn" data-act="done" data-step="understand">I have read this</button>') + '</div>';
    return h;
  }

  /* ---------------------------------------------------------------- watch */
  function fmtSec(n) { return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }
  function stepWatch(t) {
    var w = t.watch, done = stepState(t, 'watch') === 'done';
    return '<div class="tp-vhead"><h3 class="tp-h3">' + esc(w.title) + '</h3><span class="tp-dur" aria-label="Length ' + w.seconds + ' seconds">⏱ ' + fmtSec(w.seconds) + '</span></div>' +
      '<p class="tp-muted">Press play. The video stops at questions: answer them to carry on. Keep the notes open below to look things up.</p>' +
      '<div class="tp-frame loading"><span class="skel frame" aria-hidden="true"></span><iframe id="tp-iframe" title="' + esc(w.title) + '" src="' + esc(w.src) + '" loading="eager" allow="autoplay"></iframe></div>' +
      '<p class="tp-muted tp-alt">Video not showing? <a href="' + esc(w.src.replace('embed=1&', '').replace(/&seg=[^#]*/, '')) + '">Open it in the full lesson</a>.</p>' +
      '<details class="tp-details tp-ref"><summary>Topic notes</summary><div class="tp-ref-body"><div class="tp-learn"><b>You will learn:</b> ' + esc(t.learn) + '</div>' +
      (t.understand.glance ? '<section class="tp-glance">' + glanceHtml(t.understand.glance) + '</section>' : '') + formulasBlock(t) + notesBlock(t, false) + '</div></details>' +
      '<div class="tp-donebar" id="tp-watchdone">' + (done ? '<span class="tp-check">✓ Watched</span>' : '<button type="button" class="tp-btn" data-act="done" data-step="watch">I have watched this</button>') + '</div>';
  }

  /* ---------------------------------------------------------------- explore */
  function stepExplore(t) {
    var e = t.explore, done = stepState(t, 'explore') === 'done';
    if (e.type === 'lab') {
      return '<h3 class="tp-h3">' + esc(e.title) + '</h3><p class="tp-muted">Try the lab, then come back and mark it done.</p>' +
        '<div class="tp-frame tp-lab loading"><span class="skel frame" aria-hidden="true"></span><iframe id="tp-iframe" title="' + esc(e.title) + '" src="' + esc(e.src) + '"></iframe></div>' +
        '<p class="tp-muted tp-alt">Lab not showing? <a href="' + lessonUrl('lab') + '">Open it in the full lesson</a>.</p>' +
        '<div class="tp-donebar">' + (done ? '<span class="tp-check">✓ You tried this</span>' : '<button type="button" class="tp-btn" data-act="done" data-step="explore">I have tried this</button>') + '</div>';
    }
    var st = ui.story[t.id] = ui.story[t.id] || { i: 0, picked: {} };
    var h = '<h3 class="tp-h3">' + esc(e.title) + '</h3><p class="tp-story">' + esc(e.scenario) + '</p>';
    e.steps.forEach(function (q, i) {
      if (i > st.i) return;
      var picked = st.picked[i], answered = picked !== undefined;
      h += '<div class="tp-ask" role="group" aria-labelledby="ask' + i + '"><p class="tp-askq" id="ask' + i + '"><span class="tp-tag">Predict</span> ' + esc(q.ask) + '</p>' +
        q.options.map(function (o, k) {
          var cls = answered ? (k === q.correct ? ' right' : (k === picked ? ' wrong' : '')) : '';
          return '<button type="button" class="tp-opt' + cls + '" data-act="story" data-i="' + i + '" data-k="' + k + '"' + (answered ? ' aria-disabled="true"' : '') + '>' + esc(o) + '</button>';
        }).join('') +
        (answered ? '<p class="tp-fb ' + (picked === q.correct ? 'ok' : 'bad') + '" role="status"><b>' + (picked === q.correct ? 'Yes. ' : 'Not quite. ') + '</b>' + esc(q.why) + '</p>' : '') + '</div>';
    });
    if (st.i >= e.steps.length) {
      h += '<aside class="tp-callout good"><b>What this shows</b><p>' + esc(e.wrap) + '</p></aside>';
    } else if (st.picked[st.i] !== undefined) {
      h += '<button type="button" class="tp-btn" data-act="story-next">Next question</button>';
    }
    if (done) h += '<div class="tp-donebar"><span class="tp-check">✓ You worked through this</span></div>';
    return h;
  }

  /* ---------------------------------------------------------------- practice */
  function mcqCard(id, it, n) {
    var s = ui.mcq[id + ':' + it.id] = ui.mcq[id + ':' + it.id] || { sel: null, checked: false };
    var opts = LANG === 'ta' && it.opts.ta ? it.opts.ta : it.opts.en, ok = s.checked && s.sel === it.correct;
    var h = '<article class="tp-qcard" id="q-' + it.id + '"><header><span class="tp-qn">' + n + '</span><span class="tp-qk">Multiple choice</span></header>' +
      '<div role="group" aria-labelledby="qt-' + it.id + '"><p class="tp-qt" id="qt-' + it.id + '">' + esc(pick(it.q)) + '</p><div class="tp-opts">' +
      opts.map(function (o, k) {
        var cls = s.checked ? (k === it.correct ? ' right' : (k === s.sel ? ' wrong' : '')) : (k === s.sel ? ' sel' : '');
        return '<button type="button" class="tp-opt' + cls + '" aria-pressed="' + (k === s.sel) + '" data-act="pick" data-q="' + it.id + '" data-k="' + k + '"' + (s.checked ? ' aria-disabled="true"' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div></div>';
    if (!s.checked) {
      h += '<button type="button" class="tp-btn" data-act="check" data-q="' + it.id + '"' + (s.sel === null ? ' disabled' : '') + '>Check answer</button>';
    } else {
      h += '<div class="tp-result ' + (ok ? 'ok' : 'bad') + '" role="status"><b>' + (ok ? '✓ Correct' : '✗ Not quite') + '</b><p>' + esc(pick(it.why)) + '</p>' +
        (ok ? '' : '<p class="tp-hint">Hint: go back over the notes for this topic, then try again.</p>') + '</div>' +
        (ok ? '' : '<div class="tp-actions"><button type="button" class="tp-btn" data-act="retry" data-q="' + it.id + '">Try again</button>' + revisitLinks() + '</div>');
    }
    return h + '</article>';
  }
  function revisitLinks() {
    var v = here(), t = v.t && topicOf(v.t);
    if (!t) return '';
    return ['understand', 'watch'].filter(function (s) { return has(t, s); }).map(function (s) {
      return '<a class="tp-btn ghost" href="' + url({ t: t.id, s: s }) + '" data-go=\'' + esc(JSON.stringify({ t: t.id, s: s })) + '\'>Revisit ' + NAME[s] + '</a>';
    }).join('');
  }
  function exCard(id, it, n) {
    var s = ui.ex[id + ':' + it.id] = ui.ex[id + ':' + it.id] || { shown: false };
    var q = qrec(id, it.id), graded = q && q.n > 0;
    var h = '<article class="tp-qcard" id="q-' + it.id + '"><header><span class="tp-qn">' + n + '</span><span class="tp-qk">Worked question · ' + esc(it.group === 'Chapter Exercise' ? 'textbook chapter exercise' : 'textbook ' + it.group.toLowerCase()) + '</span></header>' +
      '<div class="tp-qt exq">' + pick(it.q) + '</div>';
    if (!s.shown) {
      h += '<p class="tp-muted">Work it out on paper first, then check.</p><button type="button" class="tp-btn" data-act="show" data-q="' + it.id + '">Show worked solution</button>';
    } else {
      h += '<div class="tp-result tp-sol"><b>Worked solution</b><div class="ex-answer show">' + pick(it.a) + '</div></div>';
      if (s.graded) {
        h += '<p class="tp-fb ' + (s.graded === 'yes' ? 'ok' : 'bad') + '" role="status">' + (s.graded === 'yes' ? '✓ Marked: I got it.' : 'Marked: not yet. Revisit the notes, then try again.') + '</p>' +
          '<div class="tp-actions"><button type="button" class="tp-btn" data-act="again" data-q="' + it.id + '">Try again</button>' + (s.graded === 'yes' ? '' : revisitLinks()) + '</div>';
      } else {
        h += '<div class="tp-actions"><span class="tp-ask-q">Did you get it right?</span><button type="button" class="tp-btn" data-act="grade" data-q="' + it.id + '" data-v="yes">I got it</button>' +
          '<button type="button" class="tp-btn ghost" data-act="grade" data-q="' + it.id + '" data-v="no">Not yet</button></div>';
      }
    }
    return h + '</article>';
  }
  function practiceList(id, items) {
    var st = practiceStats(id, items), r = rec[id] || { d: {} }, h =
      '<section class="tp-pstats" aria-label="Practice results"><b>' + st.tried + ' of ' + st.total + ' tried</b>' + (st.tried ? '<span>' + statsLine(st) + '</span>' : '<span>Start with the first question.</span>') +
      '<small>These numbers show how you did on practice questions. They do not mean you have mastered the topic.</small></section>';
    h += items.map(function (it, i) { return it.kind === 'mcq' ? mcqCard(id, it, i + 1) : exCard(id, it, i + 1); }).join('');
    if (st.tried === st.total && st.total) h += '<div class="tp-donebar"><span class="tp-check">✓ You have tried every question</span></div>';
    return h;
  }
  function stepPractice(t) { return practiceList(t.id, t.practice.items); }

  /* ---------------------------------------------------------------- coming soon */
  function soonPanel(t, step) {
    return '<div class="tp-soon"><p class="tp-soon-t">' + ic(ICON[step]) + ' ' + NAME[step] + ' for this topic is coming soon.</p>' +
      '<p class="tp-muted">There is no ' + (step === 'watch' ? 'video' : step === 'explore' ? 'story or example' : step === 'practice' ? 'exercise' : 'note') + ' for “' + esc(t.title.en) + '” yet. This step does not count towards the topic being complete. ' +
      'You can carry on with the steps that are ready.</p></div>';
  }

  /* ---------------------------------------------------------------- topic page */
  function viewTopic(v) {
    var t = topicOf(v.t), step = v.s, idx = DATA.topics.indexOf(t), c = DATA.chapter;
    if (has(t, step)) markViewed(t.id, step);                       // opening a step is recorded as "opened", never as done
    var h = crumbs(chapterCrumbs().concat([{ text: pick(c.title), href: url({}), go: {} }, { text: 'Topic ' + t.n + ' of ' + DATA.topics.length + ': ' + pick(t.title) }]));
    h += '<header class="tp-head tp-thead"><p class="tp-kicker">Topic ' + t.n + ' of ' + DATA.topics.length + '</p><h1 id="tp-h1" tabindex="-1">' + esc(pick(t.title)) + '</h1></header>';
    h += '<nav class="tp-steps" aria-label="Learning steps for this topic"><ol>' + STEPS.map(function (s, i) {
      var st = stepState(t, s), cur = s === step;
      return '<li><a class="tp-step ' + st + (cur ? ' cur' : '') + '" href="' + url({ t: t.id, s: s }) + '" data-go=\'' + esc(JSON.stringify({ t: t.id, s: s })) + '\'' + (cur ? ' aria-current="step"' : '') + '>' +
        '<span class="tp-sn" aria-hidden="true">' + (st === 'done' ? '✓' : (i + 1)) + '</span><span class="tp-sl"><b>' + NAME[s] + '</b><small>' + (st === 'soon' ? 'Coming soon' : WHAT[s]) + '</small></span>' +
        '<span class="sr-only">' + STATE_TXT[st] + (cur ? ', current step' : '') + '</span></a></li>';
    }).join('') + '</ol></nav>';
    h += '<section class="tp-body" aria-labelledby="tp-sh"><h2 id="tp-sh" class="tp-h2">' + ic(ICON[step]) + ' ' + NAME[step] + ' <small>' + WHAT[step] + '</small></h2>';
    if (!has(t, step)) h += soonPanel(t, step);
    else h += step === 'understand' ? stepUnderstand(t) : step === 'watch' ? stepWatch(t) : step === 'explore' ? stepExplore(t) : stepPractice(t);
    h += '</section>';
    /* previous / next across steps, then topics, then the revision */
    var si = STEPS.indexOf(step), prev, next;
    if (si > 0) prev = { go: { t: t.id, s: STEPS[si - 1] }, small: 'Previous step', text: NAME[STEPS[si - 1]] };
    else if (idx > 0) { var pt = DATA.topics[idx - 1]; prev = { go: { t: pt.id, s: 'practice' }, small: 'Previous topic', text: pt.title.en }; }
    else prev = { go: {}, small: 'Back to', text: 'Chapter overview' };
    if (si < STEPS.length - 1) next = { go: { t: t.id, s: STEPS[si + 1] }, small: 'Next step', text: NAME[STEPS[si + 1]] };
    else if (idx < DATA.topics.length - 1) { var nt = DATA.topics[idx + 1]; next = { go: { t: nt.id, s: 'understand' }, small: 'Next topic', text: nt.title.en }; }
    else next = { go: { r: 1, s: 'summary' }, small: 'Next', text: 'Chapter revision' };
    if (step === 'practice' && idx < DATA.topics.length - 1) {
      var n2 = DATA.topics[idx + 1];
      h += '<aside class="tp-upnext"><span>Up next</span><b>' + esc(n2.title.en) + '</b><a class="tp-btn primary" href="' + url({ t: n2.id, s: 'understand' }) + '" data-go=\'' + esc(JSON.stringify({ t: n2.id, s: 'understand' })) + '\'>Go to ' + esc(n2.title.en) + '</a></aside>';
    }
    h += footer(prev, next);
    return h;
  }

  /* ---------------------------------------------------------------- revision */
  function viewRevision(v) {
    var c = DATA.chapter, rv = DATA.revision, part = v.s;
    markViewed('revision', part);
    var h = crumbs(chapterCrumbs().concat([{ text: pick(c.title), href: url({}), go: {} }, { text: 'Chapter revision' }]));
    h += '<header class="tp-head tp-thead"><p class="tp-kicker">After the ' + DATA.topics.length + ' topics</p><h1 id="tp-h1" tabindex="-1">Chapter revision</h1></header>';
    var R0 = rec.revision || { v: {}, d: {}, q: {} };
    h += '<nav class="tp-steps tp-steps3" aria-label="Revision parts"><ol>' + RPARTS.map(function (p, i) {
      var st = R0.d[p] ? 'done' : (R0.v[p] ? 'viewed' : 'todo'), cur = p === part;
      return '<li><a class="tp-step ' + st + (cur ? ' cur' : '') + '" href="' + url({ r: 1, s: p }) + '" data-go=\'' + esc(JSON.stringify({ r: 1, s: p })) + '\'' + (cur ? ' aria-current="step"' : '') + '>' +
        '<span class="tp-sn" aria-hidden="true">' + (st === 'done' ? '✓' : (i + 1)) + '</span><span class="tp-sl"><b>' + RNAME[p] + '</b><small>' + RWHAT[p] + '</small></span><span class="sr-only">' + STATE_TXT[st] + '</span></a></li>';
    }).join('') + '</ol></nav>';
    h += '<section class="tp-body"><h2 class="tp-h2">' + RNAME[part] + ' <small>' + RWHAT[part] + '</small></h2>';
    if (part === 'summary') {
      h += '<div class="tp-lesson tp-summary">' + rv.summary.join('') + '</div>';
      h += '<section class="tp-formulas"><h3 class="tp-h3">Key formulas from every topic</h3><div class="tp-lesson">' + rv.formulas.join('') + '</div></section>';
      h += '<div class="tp-donebar">' + (R0.d.summary ? '<span class="tp-check">✓ You marked this as read</span>' : '<button type="button" class="tp-btn" data-act="done" data-step="summary">I have read this</button>') + '</div>';
    } else if (part === 'mixed') {
      h += '<p class="tp-muted">These questions use more than one topic.</p>' + practiceList('revision', rv.mixed.map(function (x) { return Object.assign({}, x, { id: 'mx_' + x.id }); }));
    } else {
      h += '<p class="tp-muted">Every topic in one short quiz. Your answers are saved with your chapter revision, separate from the topic practice.</p>' + practiceList('revision', rv.quiz.map(function (x) { return Object.assign({}, x, { id: 'qz_' + x.id }); }));
    }
    h += '</section>';
    var pi = RPARTS.indexOf(part), last = DATA.topics[DATA.topics.length - 1];
    var prev = pi > 0 ? { go: { r: 1, s: RPARTS[pi - 1] }, small: 'Previous', text: RNAME[RPARTS[pi - 1]] } : { go: { t: last.id, s: 'practice' }, small: 'Previous topic', text: last.title.en };
    var next = pi < RPARTS.length - 1 ? { go: { r: 1, s: RPARTS[pi + 1] }, small: 'Next', text: RNAME[RPARTS[pi + 1]] } : { go: {}, small: 'Finished', text: 'Back to the chapter overview' };
    return h + footer(prev, next);
  }

  /* ---------------------------------------------------------------- render */
  function applyLessonLang() {
    if (LANG !== 'ta') return;
    [].forEach.call(app.querySelectorAll('.tp-lesson [data-ta]'), function (e) { e.innerHTML = e.getAttribute('data-ta'); });
  }
  function render(moved) {
    if (!DATA) return;
    var v = here(), html;
    reread();
    html = v.t ? viewTopic(v) : (v.r ? viewRevision(v) : viewOverview());
    app.innerHTML = html;
    applyLessonLang();
    if (LANG === 'si' && window.StemSI) { try { window.StemSI.apply(); } catch (e) {} }
    var tt = (v.t ? topicOf(v.t).title.en + ' · ' + NAME[v.s] : (v.r ? 'Chapter revision · ' + RNAME[v.s] : DATA.chapter.title.en));
    doc.title = tt + ' · STEM Cloud';
    wireFrame();
    if (moved) {
      window.scrollTo(0, 0);
      var h1 = doc.getElementById('tp-h1'); if (h1) h1.focus({ preventScroll: true });
      say(tt);
    }
  }

  /* ---------------------------------------------------------------- events */
  var frame = null;
  function wireFrame() {
    frame = doc.getElementById('tp-iframe');
    if (frame) frame.addEventListener('load', function () { frame.parentNode.classList.remove('loading'); });
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow || !e.data || e.data.type !== 'stem-embed') return;
    if (e.data.event === 'height' && e.data.h) frame.parentNode.style.setProperty('--tp-h', Math.max(320, Math.min(2200, e.data.h + 4)) + 'px');
    if (e.data.event === 'segment-end') {
      var v = here();
      if (v.t && v.s === 'watch' && markDone(v.t, 'watch')) { var box = doc.getElementById('tp-watchdone'); if (box) box.innerHTML = '<span class="tp-check">✓ Watched</span>'; say('Video finished. Marked as watched.'); refreshSteps(); }
    }
  });
  function refreshSteps() {
    var v = here(), t = v.t && topicOf(v.t);
    if (!t) return;
    [].forEach.call(app.querySelectorAll('.tp-step'), function (a, i) {
      var s = STEPS[i], st = stepState(t, s);
      a.className = 'tp-step ' + st + (s === v.s ? ' cur' : '');
      var n = a.querySelector('.tp-sn'); if (n) n.textContent = st === 'done' ? '✓' : (i + 1);
    });
  }

  app.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-go]');
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); go(JSON.parse(a.getAttribute('data-go'))); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    var act = b.getAttribute('data-act'), v = here(), pid = v.t || 'revision', key;
    function item(qid) {
      var list = v.t ? topicOf(v.t).practice.items : (v.s === 'mixed' ? DATA.revision.mixed.map(function (x) { return Object.assign({}, x, { id: 'mx_' + x.id }); }) : DATA.revision.quiz.map(function (x) { return Object.assign({}, x, { id: 'qz_' + x.id }); }));
      return list.filter(function (x) { return x.id === qid; })[0];
    }
    var qid = b.getAttribute('data-q');
    key = pid + ':' + qid;
    var keep = window.pageYOffset;
    if (act === 'done') {
      var step = b.getAttribute('data-step'); markDone(pid, step); say('Marked as done.');
      if (step === 'summary' || v.t) { render(false); }
    } else if (act === 'pick') {
      ui.mcq[key] = { sel: +b.getAttribute('data-k'), checked: false }; render(false);
      var nb = app.querySelector('[data-act="check"][data-q="' + qid + '"]'); if (nb) nb.focus({ preventScroll: true });
    } else if (act === 'check') {
      var it = item(qid), s = ui.mcq[key]; if (!it || !s || s.sel === null) return;
      s.checked = true; var ok = s.sel === it.correct; recordAnswer(pid, qid, ok);
      completePracticeIfAll(pid, v);
      render(false); say(ok ? 'Correct.' : 'Not quite.');
      var r = app.querySelector('#q-' + qid + ' .tp-result'); if (r) r.scrollIntoView({ block: 'nearest' });
    } else if (act === 'retry') {
      ui.mcq[key] = { sel: null, checked: false }; render(false);
      var fo = app.querySelector('#q-' + qid + ' .tp-opt'); if (fo) fo.focus({ preventScroll: true });
    } else if (act === 'show') {
      ui.ex[key] = { shown: true }; render(false);
    } else if (act === 'grade') {
      var yes = b.getAttribute('data-v') === 'yes'; recordAnswer(pid, qid, yes);
      ui.ex[key] = { shown: true, graded: yes ? 'yes' : 'no' }; completePracticeIfAll(pid, v); render(false); say(yes ? 'Marked: I got it.' : 'Marked: not yet.');
    } else if (act === 'again') {
      ui.ex[key] = { shown: false }; render(false);
    } else if (act === 'story') {
      var t = topicOf(v.t), st = ui.story[t.id], i = +b.getAttribute('data-i'), k = +b.getAttribute('data-k');
      st.picked[i] = k; if (i === t.explore.steps.length - 1) { st.i = t.explore.steps.length; markDone(t.id, 'explore'); }
      render(false);
    } else if (act === 'story-next') {
      ui.story[v.t].i += 1; render(false);
    }
    window.scrollTo(0, keep);
  });
  function completePracticeIfAll(pid, v) {
    var items = v.t ? topicOf(v.t).practice.items : (v.s === 'mixed' ? DATA.revision.mixed.map(function (x) { return 'mx_' + x.id; }) : DATA.revision.quiz.map(function (x) { return 'qz_' + x.id; }));
    var ids = items.map(function (x) { return typeof x === 'string' ? x : x.id; }), r = R(pid);
    if (ids.every(function (id) { return r.q[id] && r.q[id].n > 0; })) markDone(pid, v.t ? 'practice' : v.s);
  }
  window.addEventListener('popstate', function () { render(true); });

  /* ---------------------------------------------------------------- language and theme (the same conventions as the lesson pages) */
  var LNAME = { en: 'English', ta: 'தமிழ்', si: 'සිංහල' };
  window.applyLang = function (l) {
    window.STEM_LANG = l; if (window.StemSI) { try { window.StemSI.revert(); } catch (e) {} }
    LANG = l === 'ta' ? 'ta' : 'en';
    root.lang = l; doc.body.classList.toggle('lang-ta', l === 'ta'); doc.body.classList.toggle('lang-si', l === 'si');
    var btn = doc.getElementById('langToggle'); if (btn) { btn.textContent = '🌐 ' + LNAME[l]; if (window.StemSI) window.StemSI.labelBtn(btn); }
    safeSet('lessonLang', l);
    render(false);
    try { window.dispatchEvent(new Event('stem-lang')); } catch (e) {}
  };
  (function () {
    var tb = doc.getElementById('themeToggle'); if (!tb) return;
    var saved = safeGet('lessonTheme'); if (saved) root.setAttribute('data-theme', saved);
    tb.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), next = cur === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next); safeSet('lessonTheme', next);
    });
  })();

  /* ---------------------------------------------------------------- start */
  fetch('/lessons/topics/' + encodeURIComponent(slug) + '.json', { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('status ' + r.status);
    return r.json();
  }).then(function (d) {
    DATA = d; KEY = 'scx_topics_' + d.chapter.id; load();
    var l = safeGet('lessonLang') || 'en'; window.STEM_LANG = l; LANG = l === 'ta' ? 'ta' : 'en';
    root.lang = l; doc.body.classList.toggle('lang-ta', l === 'ta'); doc.body.classList.toggle('lang-si', l === 'si');
    var btn = doc.getElementById('langToggle'); if (btn) btn.textContent = '🌐 ' + LNAME[l];
    render(false);
    /* replace the address if it names a topic or step that does not exist */
    var p = new URLSearchParams(location.search);
    if ((p.get('t') && !topicOf(p.get('t'))) || (p.get('s') && !p.get('t') && p.get('r') !== '1')) history.replaceState(null, '', url({}));
  }).catch(function () {
    app.innerHTML = '<div class="tp-error" role="alert"><p><b>This chapter could not be loaded.</b></p><p>Check your connection, then <a href="">try again</a> or go back to the <a href="/lessons/index.html">course contents</a>.</p></div>';
  });
})();
