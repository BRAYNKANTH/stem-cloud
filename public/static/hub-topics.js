/* STEM Cloud course contents page: offers "learn by topic" under every chapter that has a topic-by-topic view.
 * The contents page is generated, so this file adds the link from outside (site/lessons/topics/index.json lists the chapters that have topics).
 * Topic progress is read from the same saved key the topic page writes (scx_topics_<chapter id>). */
(function () {
  'use strict';
  if (!/\/lessons\/(index\.html)?$/.test(location.pathname)) return;
  var toc = document.getElementById('toc');
  if (!toc) return;

  /* English only for now: Tamil and Sinhala wording for the new topic labels still has to be written and reviewed by the content team */
  function T(en) { return en; }
  function saved(id) { try { return JSON.parse(localStorage.getItem('scx_topics_' + id) || '{}') || {}; } catch (e) { return {}; } }
  function topicDone(rec, t) { var d = (rec[t.id] || {}).d || {}; return t.steps.every(function (s) { return d[s]; }); }

  var chapters = null, busy = false;
  function paint() {
    if (!chapters || busy) return;
    busy = true;
    try {
      chapters.forEach(function (c) {
        var a = toc.querySelector('a.row[href="' + c.lessonFile + '"]');
        if (!a || !a.parentNode || a.parentNode.querySelector('.tp-hub-link')) return;
        var rec = saved(c.id), done = c.topics.filter(function (t) { return topicDone(rec, t); }).length;
        var started = Object.keys(rec).length > 0;
        var link = document.createElement('a');
        link.className = 'tp-hub-link'; link.href = '/topics/' + c.slug;
        link.innerHTML = '<span aria-hidden="true">🧭</span><span><b>' + T('Learn topic by topic') + '</b> · ' +
          T(started ? 'Continue' : 'Start') +
          '</span><small>' + done + ' / ' + c.topics.length + ' ' + T('topics') + '</small>';
        a.parentNode.appendChild(link);
      });
    } finally { busy = false; }
  }

  var st = document.createElement('style');
  st.textContent =
    '.tp-hub-link{display:flex;align-items:center;gap:10px;margin:0 16px 12px 66px;padding:8px 12px;border-radius:var(--r,6px);text-decoration:none;font-size:.88rem;' +
    'color:var(--accent-text,#4cc3f0);border:1px solid var(--border,#2b3d55);min-height:44px}' +
    '.tp-hub-link:hover{border-color:var(--accent,#6ab4de)}' +
    '.tp-hub-link>span:nth-child(2){flex:1;min-width:0}.tp-hub-link small{font-weight:700;color:var(--text-dim,#a7b3c8);font-variant-numeric:tabular-nums}' +
    '@media (max-width:420px){.tp-hub-link{margin-left:16px}}';
  document.head.appendChild(st);

  fetch('/lessons/topics/index.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.chapters) return;
    chapters = j.chapters; paint();
    /* the contents page redraws itself (progress changes, language); put the links back each time */
    new MutationObserver(paint).observe(toc, { childList: true });
  }).catch(function () {});
})();
