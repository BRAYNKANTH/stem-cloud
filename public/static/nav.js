/* STEM Cloud bottom navigation: Home / Learn / Papers / Me, like a phone app.
 * Only on the "place" pages (course home, past papers, account); a lesson keeps its own Back / Next bar instead.
 * Shown on phone widths only (theme-bright.css), the header does this job on a wide screen. */
(function () {
  'use strict';
  var doc = document, path = location.pathname;
  var here = /\/lessons\/(index\.html)?$/.test(path) ? 'home' : (/\/lessons\/past-papers\.html$/.test(path) ? 'papers' : (/^\/account\/?$|\/account\.html$/.test(path) ? 'me' : null));
  if (!here || doc.getElementById('stem-bnav')) return;

  var WORDS = {
    home: ['Home', 'முகப்பு', 'මුල් පිටුව'],
    learn: ['Learn', 'படி', 'ඉගෙනුම'],
    papers: ['Papers', 'வினாத்தாள்', 'ප්‍රශ්න පත්‍ර'],
    me: ['Me', 'நான்', 'මම']
  };
  var ICONS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    learn: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
    papers: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5',
    me: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6'
  };
  function lang() { try { var l = localStorage.getItem('lessonLang'); return l === 'ta' ? 1 : (l === 'si' ? 2 : 0); } catch (e) { return 0; } }
  /* Learn = the lesson you were last in (only a plain lesson file name is trusted), else the first one */
  function learnHref() {
    var f = null; try { f = localStorage.getItem('stem_last_lesson'); } catch (e) {}
    return '/lessons/' + (f && /^[a-z0-9-]+\.html$/.test(f) && f !== 'index.html' && f !== 'past-papers.html' ? f : 'unit-02-motion-in-a-straight-line.html');
  }
  var HREF = { home: '/lessons/index.html', papers: '/lessons/past-papers.html', me: '/account' };

  var nav = doc.createElement('nav'), shown = -1;
  nav.id = 'stem-bnav';
  function render() {
    var k = lang();
    if (k === shown) return;
    shown = k;
    nav.setAttribute('aria-label', ['Main', 'முதன்மை', 'ප්‍රධාන'][k]);
    nav.innerHTML = ['home', 'learn', 'papers', 'me'].map(function (id) {
      return '<a href="' + (id === 'learn' ? learnHref() : HREF[id]) + '"' + (id === here ? ' aria-current="page"' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS[id] + '"/></svg>' +
        '<span>' + WORDS[id][k] + '</span></a>';
    }).join('');
  }
  render();
  doc.body.appendChild(nav);
  doc.body.classList.add('has-bnav');
  /* the language can change on the page (language button), so follow it */
  window.addEventListener('storage', render);
  doc.addEventListener('click', function () { setTimeout(render, 300); });
})();
