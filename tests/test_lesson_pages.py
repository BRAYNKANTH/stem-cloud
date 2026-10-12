# -*- coding: utf-8 -*-
"""Real-browser checks for the new lesson pages (/learn/..., built from content/): the Phase 5 "done when" checks.

    cd web && npm run build && cd .. && python tests/test_lesson_pages.py

Needs the web build (the API serves web/dist-private/learn after the sign-in check) and Playwright with Edge, Chrome or
Playwright's Chromium (python -m playwright install chromium). For every chapter, on a phone (375 px) and a desktop:
the islands start without errors, and in every step and language nothing scrolls sideways; on the phone every control
is at least 44 px (links inside sentences excepted). On Motion: the player, the story, the quiz and its answer sheet,
worked-example reveals, read-aloud, and the page without JavaScript. Speech is replaced by a recording stub.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8768
BASE = 'http://localhost:%d' % PORT
H = {'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'}
CATALOG = json.load(open(os.path.join(ROOT, 'content', 'catalog.json'), encoding='utf-8'))['lessons']
URLS = ['/learn/%s/g%d/%s/' % (l['subject'], l['grade'], l['slug']) for l in CATALOG]
MOTION = '/learn/physics/g10/motion-in-a-straight-line/'
# the topic view: lessons that have topics (content/.../lesson.json "topics"), their overview, topic and revision pages
TOPIC_URLS = []
for l in CATALOG:
    data = json.load(open(os.path.join(ROOT, l['path']), encoding='utf-8'))
    if data.get('topics'):
        base = '/learn/%s/g%d/%s/topics/' % (l['subject'], l['grade'], l['slug'])
        TOPIC_URLS += [base] + [base + t['id'] + '/' for t in data['topics']] + ([base + 'revision/'] if data.get('revision') else [])
fails = []


def check(name, cond, extra=''):
    """cond and extra may be functions: then cond is tried again until it holds or 4 s have passed, because the page
    updates a moment after a click or key press (and slower on CI machines)."""
    if callable(cond):
        until = time.time() + 4
        while True:
            try:
                ok = bool(cond())
            except Exception:
                ok = False
            if ok or time.time() > until:
                break
            time.sleep(0.05)
        cond = ok
    if callable(extra):
        try:
            extra = extra()
        except Exception as e:
            extra = e
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)
        if os.environ.get('GITHUB_ACTIONS'):          # an annotation, readable on the run page without opening the log
            print('::error title=Lesson pages::%s  %s' % (name, str(extra)[:300].replace(chr(10), ' ')))


STUB = """
window.__spoken = [];
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: function (t) { this.text = t; }, configurable: true, writable: true });
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speak: function (u) { window.__spoken.push(u.text); if (!window.__hold) setTimeout(function () { u.onend && u.onend(); }, 50); },   // __hold: a sentence never ends
  cancel: function () {}, pause: function () {}, resume: function () {},
  getVoices: function () { return [{ name: 'Test Tamil', lang: 'ta-IN' }, { name: 'Test English', lang: 'en-IN' }]; }, addEventListener: function () {} } });
"""

# Every step in every language: sideways scroll, and (phone) controls under 44 px. Steps are shown one by one directly,
# so the check does not depend on timers.
LAYOUT = """(phone) => {
  const d = document, out = [], secs = [...d.querySelectorAll('section.lstep')];
  for (const lang of ['en', 'ta', 'si']) {
    d.documentElement.lang = lang;
    for (const sec of secs) {
      secs.forEach((s) => s.classList.toggle('on', s === sec));
      const sw = d.documentElement.scrollWidth, w = d.documentElement.clientWidth;
      if (sw > w + 1) out.push(lang + ' #' + sec.id + ' scrolls sideways (' + sw + ' > ' + w + ')');
      if (!phone || lang !== 'en') continue;
      for (const el of sec.querySelectorAll('button, a, summary, [role=button]')) {
        const r = el.getBoundingClientRect();
        if (el.offsetParent && r.width && r.height < 43.5 && !el.closest('p, li, td'))
          out.push('#' + sec.id + ' ' + el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '') + ' is ' + Math.round(r.height) + ' px');
      }
    }
  }
  d.documentElement.lang = 'en';
  return [...new Set(out)];
}"""


def set_lang(pg, lang):
    """The language buttons sit at the top of the content: scroll up first, as a student would (the sticky header and a
    lab frame can cover them further down)."""
    pg.evaluate('scrollTo(0, 0)')
    pg.click('button[lang=%s]' % lang)


def run():
    if not os.path.isfile(os.path.join(ROOT, 'web', 'dist-private', 'learn', 'physics', 'g10', 'motion-in-a-straight-line', 'index.html')):
        sys.exit('No web build: run  cd web && npm run build  first.')
    tmp = tempfile.mkdtemp()
    env = dict(os.environ, DB_PATH=os.path.join(tmp, 't.db'))
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'], cwd=os.path.join(ROOT, 'api'), env=env)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1)
                break
            except Exception:
                time.sleep(0.3)
        with sync_playwright() as p:
            browser = None
            for channel in ('msedge', 'chrome', None):
                try:
                    browser = p.chromium.launch(channel=channel, headless=True) if channel else p.chromium.launch(headless=True)
                    break
                except Exception:
                    continue
            if browser is None:
                sys.exit('No browser: install Edge or Chrome, or run  python -m playwright install chromium')

            # the first account on a fresh database may sign itself up; its cookies are shared by the contexts below
            first = browser.new_context()
            r = first.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'learn_test', 'password': 'LocalTest-2468'}))
            check('test account', r.status == 200, r.status)
            state = first.storage_state()

            def context(**kw):
                ctx = browser.new_context(storage_state=state, **kw)
                ctx.add_init_script(STUB)
                return ctx

            def open_page(ctx, url):
                pg = ctx.new_page()
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
                pg.goto(BASE + url, wait_until='load')
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')", timeout=15000)
                return pg, errs

            # ------------------------------------------------------------ sign-in check
            visitor = browser.new_context()
            r = visitor.request.get(BASE + MOTION, max_redirects=0)
            check('a visitor is sent to the login page', r.status == 302 and r.headers.get('location', '').startswith('/login?next=/learn/'), r.status)

            # ------------------------------------------------------------ every chapter, phone and desktop
            for label, kw, phone in (('phone', dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True), True),
                                     ('desktop', dict(viewport={'width': 1280, 'height': 800}), False)):
                ctx = context(**kw)
                for url in URLS:
                    pg, errs = open_page(ctx, url)
                    name = url.split('/')[-2]
                    steps = pg.eval_on_selector_all('section.lstep', 'els => els.length')
                    check('%s %s: %d steps, no script errors' % (label, name, steps), steps >= 10 and not errs, errs)
                    problems = pg.evaluate(LAYOUT, phone)
                    check('%s %s: no sideways scroll%s, all languages' % (label, name, ', 44 px controls' if phone else ''), not problems, problems[:6])
                    pg.close()
                for url in TOPIC_URLS:
                    pg, errs = open_page(ctx, url)
                    name = '/'.join(url.split('/')[4:-1])
                    problems = pg.evaluate(LAYOUT, phone)
                    check('%s %s: no script errors, no sideways scroll%s' % (label, name, ', 44 px controls' if phone else ''), not errs and not problems, (errs + problems)[:6])
                    pg.close()
                ctx.close()

            # ------------------------------------------------------------ Motion: the player
            ctx = context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
            pg, errs = open_page(ctx, MOTION)
            on = lambda: pg.evaluate("document.querySelector('section.lstep.on').id")
            check('opens on the first step', lambda: on() == 'story', lambda: on())
            pg.click('.lbar .lb-btn.primary')
            check('Next shows the next step and records it in the URL', lambda: on() == 'basics' and pg.url.endswith('#basics'), lambda: pg.url)
            pg.go_back()
            pg.wait_for_function("document.querySelector('section.lstep.on').id === 'story'")
            check("the browser's Back button steps back", lambda: on() == 'story')
            pg.goto(BASE + MOTION + '#worked')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('a #step link opens that step', lambda: on() == 'worked', lambda: on())
            set_lang(pg, 'ta')
            check('switching language keeps the step', lambda: on() == 'worked' and pg.evaluate('document.documentElement.lang') == 'ta')
            set_lang(pg, 'en')

            # worked example: marking steps one at a time, then the final answer
            vis = "el => !!el && el.offsetParent !== null"
            card = pg.locator('#worked .qcard').first
            copy = card.locator('[data-l~="en"] [data-qcard]').first
            n = copy.locator(':scope > .step').count()
            for i in range(n):
                copy.locator('.step-toggle:visible').first.click()
            final = card.locator('[data-l~="en"] .final-toggle')
            check('all marking steps revealed, then "Show final answer"', lambda: final.is_visible() and copy.locator('.step-content:visible').count() == n)
            final.click()
            check('the final answer shows', lambda: card.locator('[data-l~="en"] .final-answer').is_visible())

            # the lesson map, and the whole lesson on one page
            pg.click('.lbar .lb-mid')
            pg.click('dialog.lmap .lm-step:has-text("Quiz")')
            check('the lesson map opens a step', lambda: on() == 'quiz')
            pg.click('.lbar .lb-mid')
            pg.click('dialog.lmap .btn.full')
            shown = pg.eval_on_selector_all('section.lstep', 'els => els.filter(e => e.offsetParent).length')
            check('"Whole lesson on one page" shows every step', lambda: shown == 13, lambda: shown)
            pg.click('.lbar .lb-mid')
            pg.click('dialog.lmap .btn.full')
            shown = pg.eval_on_selector_all('section.lstep', 'els => els.filter(e => e.offsetParent).length')
            check('and back to one step at a time', lambda: shown == 1, lambda: shown)

            # ------------------------------------------------------------ Motion: the quiz and its answer sheet
            pg.goto(BASE + MOTION + '#quiz')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            answers = pg.eval_on_selector_all('.quiz.nojs .qz-ans > p:first-of-type b', "bs => bs.map(b => 'ABCDEF'.indexOf(b.textContent))")
            cards = pg.locator('.qz .qz-card')
            cards.nth(0).locator('.qz-opt').nth(answers[0]).click()
            sheet = pg.locator('#stem-qsheet')
            check('a right answer: "Correct!"', lambda: sheet.get_attribute('class') == 'ok' and 'Correct!' in sheet.inner_text())
            pg.click('.qs-go')
            check('"Next question" closes the sheet and moves on', lambda: sheet.count() == 0 and pg.evaluate("document.activeElement.className") == 'qz-opt')
            cards.nth(1).locator('.qz-opt').nth((answers[1] + 1) % 4).click()
            check('a wrong answer: "Not quite" with the right answer', lambda: sheet.get_attribute('class') == 'no' and 'The answer is' in sheet.inner_text())
            check('the options lock and show the right one', lambda: cards.nth(1).locator('.qz-opt:disabled').count() == 4 and cards.nth(1).locator('.qz-opt.correct').count() == 1)
            pg.keyboard.press('Escape')
            check('Escape closes the sheet', lambda: sheet.count() == 0)
            for i in range(2, cards.count()):
                cards.nth(i).locator('.qz-opt').nth(answers[i]).click()
                if i == cards.count() - 1:
                    check('the last question says "See my score"', lambda: 'See my score' in pg.inner_text('.qs-go'))
                pg.click('.qs-go')
            check('the score counts the right answers', lambda: pg.inner_text('.qz .quiz-score').split() == ['Score:', '%d' % (cards.count() - 1), '/', '%d' % cards.count()], lambda: pg.inner_text('.qz .quiz-score'))

            # ------------------------------------------------------------ Motion: the story
            pg.goto(BASE + MOTION + '#story')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            label = lambda: pg.inner_text('.so-line-label')
            pg.click('.so-ctrls .btn.primary')
            check('"Next line" goes on', lambda: label().endswith('2 / 9'), lambda: label())
            pg.keyboard.press('ArrowRight')
            pg.keyboard.press('ArrowRight')
            check('arrow keys always go on, as a swipe does (a tap only finishes the typing)', lambda: label().endswith('4 / 9'), lambda: label())
            pg.keyboard.press('ArrowLeft')
            check('arrow left goes back', lambda: label().endswith('3 / 9'), lambda: label())
            pg.click('.so-ctrls .btn.primary')
            pg.click('.so-bubble')
            check('a tap on the bubble first finishes the line being typed', lambda: label().endswith('4 / 9') and not pg.locator('.so-caret').count(), lambda: label())
            pg.click('.so-voice')
            pg.click('.so-voice')                         # off -> recorded -> phone voice
            pg.click('.so-ctrls .btn.primary')
            pg.wait_for_timeout(300)
            spoken = pg.evaluate('window.__spoken')
            check('the phone voice says the line', lambda: len(spoken) > 0, lambda: spoken[-1:])
            for _ in range(10):
                pg.keyboard.press('ArrowRight')
                pg.keyboard.press('ArrowRight')
            check('the last line offers the next step', lambda: pg.locator('.so-cta.show a').is_visible())
            pg.click('.so-cta a')
            check('...and it opens it', lambda: on() == 'basics', lambda: on())
            # ------------------------------------------------------------ Motion: the topic view
            pg.goto(BASE + MOTION)
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('the lesson links to its topics', lambda: pg.locator('a.by-topic').get_attribute('href') == MOTION + 'topics/')
            pg.click('a.by-topic')
            pg.wait_for_url('**/topics/')
            check('the topic overview lists the topics and the revision', lambda: pg.locator('.tp-list > li').count() == 5 and pg.locator('a.tp-rev').count() == 1)
            pg.click('.tp-list > li >> nth=0 >> a')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            ids = pg.eval_on_selector_all('section.lstep', 'els => els.map(e => e.id)')
            check('a topic page has the steps it has content for', ids == ['understand', 'watch', 'explore', 'practice'], ids)
            check('...one at a time, Understand first, with the summary and the notes card', lambda: on() == 'understand' and pg.locator('#understand .tp-glance').is_visible() and pg.locator('#understand .card').count() >= 2)
            pg.click('.lbar .lb-btn.primary')
            check('Watch plays its scene of the animation', lambda: 'seg=0-11&dur=30#watch' in (pg.locator('#watch iframe').get_attribute('src') or ''), lambda: pg.locator('#watch iframe').get_attribute('src'))
            pg.click('.lbar .lb-btn.primary')
            story = pg.locator('#explore .tp-story')
            story.locator('.qz-opt').nth(1).click()
            check('Explore: an answer shows whether it is right and why', lambda: story.locator('.qz-explain.show').count() == 1 and story.locator('.qz-opt.correct').count() == 1)
            story.locator('.tp-next').click()
            story.locator('.qz-card').nth(1).locator('.qz-opt').nth(2).click()
            check('...then the next question, and the wrap-up at the end', lambda: story.locator('.qz-card').count() == 2 and pg.locator('#explore .tp-story .tp-wrap').is_visible())
            pg.click('.lbar .lb-btn.primary')
            check('Practice: the lesson questions and exercises of the topic, in order', lambda: pg.locator('#practice .ex').count() == 4 and pg.locator('#practice .qz .qz-card').count() == 1)
            check('...a practice question has no score line', lambda: pg.locator('#practice .quiz-score').count() == 0)
            pg.locator('#practice .qz .qz-opt').first.click()
            check('...and opens the answer sheet', lambda: pg.locator('#stem-qsheet').count() == 1)
            pg.keyboard.press('Escape')
            pg.goto(BASE + MOTION + 'topics/speed-velocity/')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            ids = pg.eval_on_selector_all('section.lstep', 'els => els.map(e => e.id)')
            check('a topic without a video or story leaves those steps out', ids == ['understand', 'practice'], ids)
            pg.goto(BASE + MOTION + 'topics/revision/#quiz')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('the revision has the summary, mixed practice and the scored chapter quiz', lambda: pg.eval_on_selector_all('section.lstep', 'els => els.map(e => e.id)') == ['summary', 'mixed', 'quiz']
                  and on() == 'quiz' and pg.locator('#quiz .quiz-score').is_visible())

            # ------------------------------------------------------------ Motion: read-aloud
            pg.goto(BASE + MOTION + '#notes')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.evaluate('window.__spoken = []; window.__hold = true')
            pg.click('.lbar .lb-listen')
            pg.wait_for_timeout(300)
            spoken = pg.evaluate('window.__spoken')
            reading = pg.locator('.stem-reading')
            check('Listen reads the step, the block being read highlighted', lambda: len(spoken) > 0 and reading.count() == 1 and reading.is_visible(), lambda: spoken[:2])
            check('...from this step only, in the language on screen', lambda: reading.evaluate("e => !!e.closest('#notes') && !e.closest('[data-l]:not([data-l~=\"en\"])')"))
            check('the reading controls show', lambda: pg.locator('#stem-vp').is_visible())
            check('symbols and units are said as words', lambda: not any('=' in s or '×' in s for s in spoken), lambda: [s for s in spoken if '=' in s][:1])
            pos = lambda: pg.inner_text('#stem-vp .vp-pos')
            first = pos()
            pg.click('#stem-vp [data-a=next]')
            pg.wait_for_function("t => document.querySelector('#stem-vp .vp-pos').innerText !== t", arg=first)
            check('Next reads the next block', lambda: pos() != first and pos().split(' / ')[0] == str(int(first.split(' / ')[0]) + 1), lambda: (first, pos()))
            pg.click('.lbar .lb-listen')
            pg.wait_for_function("() => document.querySelector('#stem-vp [data-a=pp]').getAttribute('aria-label') === 'Play'")
            check('Listen again pauses', lambda: pg.locator('#stem-vp [data-a=pp]').get_attribute('aria-label') == 'Play')
            pg.click('#stem-vp [data-a=rate]')
            check('the speed changes and is remembered', lambda: pg.evaluate("localStorage.getItem('stem_rate')") is not None)
            pg.click('#stem-vp [data-a=stop]')
            settled = "() => !document.querySelector('#stem-vp') && !document.querySelector('.stem-reading')"
            pg.wait_for_function(settled, timeout=5000)
            check('Stop ends reading', lambda: pg.locator('#stem-vp').count() == 0 and pg.locator('.stem-reading').count() == 0)
            pg.evaluate('window.__hold = false')
            pg.click('.lbar .lb-listen')
            pg.wait_for_selector('#stem-vp')
            pg.wait_for_function(settled, timeout=30000)
            check('reading goes on block by block to the end of the step, then stops', lambda: pg.locator('.stem-reading').count() == 0)
            set_lang(pg, 'ta')
            pg.evaluate('window.__spoken = []')
            pg.click('.lbar .lb-listen')
            pg.wait_for_timeout(300)
            spoken = pg.evaluate('window.__spoken')
            check('in Tamil it reads the Tamil text', lambda: any(any('஀' <= c <= '௿' for c in s) for s in spoken), lambda: spoken[:1])
            pg.click('.lbar .lb-btn.primary')
            check('a new step stops reading', lambda: pg.locator('#stem-vp').count() == 0)
            set_lang(pg, 'en')
            pg.goto(BASE + MOTION + '#story')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.evaluate("localStorage.setItem('stem_story_mode', 'off')")
            pg.reload()
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.click('.lbar .lb-listen')
            check('on the story, Listen switches the story voices', lambda: pg.evaluate("localStorage.getItem('stem_story_mode')") == 'rec' and pg.locator('#stem-vp').count() == 0)
            # ------------------------------------------------------------ Motion: progress v2 (outbox -> server)
            L = 'physics.g10.motion-in-a-straight-line'
            server = lambda: pg.evaluate("fetch('/api/v2/progress?lesson=%s').then(r => r.json())" % L)
            summary = lambda: pg.evaluate("fetch('/api/v2/progress/summary').then(r => r.json())")
            outbox = lambda: pg.evaluate("new Promise(r => { const o = indexedDB.open('stem-progress', 1); o.onsuccess = () => { const q = o.result.transaction('outbox').objectStore('outbox').count(); q.onsuccess = () => r(q.result); }; o.onerror = () => r(-1); })")
            pg.goto(BASE + MOTION + '#quiz')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('progress: the steps opened and the answers given reach the server', lambda: server()['questions'].get(L + '/q1', {}).get('attempts', 0) >= 1
                  and 'quiz' in server()['steps'] and 'story' in server()['steps'], lambda: server())
            check('progress: the steps moved on from are done', lambda: (server()['steps'].get('story') or {}).get('done') is not None, lambda: server()['steps'])
            xp = summary()['xp']
            check('progress: right answers, the story and a worked example earned XP', xp >= 10 + 5 + 15, xp)
            check('progress: the header shows the XP', lambda: pg.locator('.xp-chip b').inner_text() == str(xp), lambda: pg.locator('.xp-chip').inner_text())
            right = [int(i) for i in pg.eval_on_selector_all('.quiz.nojs .qz-ans > p:first-of-type b', "bs => bs.map(b => 'ABCDEF'.indexOf(b.textContent))")]
            pg.locator('.qz .qz-card').nth(0).locator('.qz-opt').nth(right[0]).click()       # the same question right again, after a reload
            pg.keyboard.press('Escape')
            check('progress: a reward counts once (a reload cannot earn it again)', lambda: outbox() == 0 and summary()['xp'] == xp, lambda: (outbox(), summary()['xp'], xp))
            attempts = server()['questions'][L + '/q2']['attempts']
            ctx.set_offline(True)
            pg.locator('.qz .qz-card').nth(1).locator('.qz-opt').nth(right[1]).click()
            pg.keyboard.press('Escape')
            check('progress: offline, the answer waits in the outbox on the device', lambda: outbox() >= 1, lambda: outbox())
            ctx.set_offline(False)
            pg.evaluate("window.dispatchEvent(new Event('online'))")
            check('progress: back online, the outbox is sent', lambda: outbox() == 0 and server()['questions'][L + '/q2']['attempts'] == attempts + 1, lambda: (outbox(), server()['questions'][L + '/q2']))
            pg.click('.lbar .lb-mid')
            check('progress: the lesson map ticks the steps done', lambda: pg.locator('dialog.lmap .lm-step.done').count() >= 1)
            pg.keyboard.press('Escape')

            check('no script errors on Motion', lambda: not errs, lambda: errs)
            ctx.close()

            # ------------------------------------------------------------ Motion without JavaScript
            ctx = browser.new_context(storage_state=state, java_script_enabled=False, viewport={'width': 375, 'height': 812})
            pg = ctx.new_page()
            pg.goto(BASE + MOTION)
            shown = pg.eval_on_selector_all('section.lstep', 'els => els.filter(e => e.offsetParent).length')
            check('without JavaScript every step is on the page', lambda: shown == 13, lambda: shown)
            check('...the story as bubbles and the quiz answers behind "Show answer"',
                  lambda: pg.locator('.story.nojs').is_visible() and pg.locator('.quiz.nojs details').count() == 5 and not pg.locator('.so-player').is_visible())
            check('...and the worked examples fully shown', lambda: pg.locator('#worked .final-answer').first.is_visible())
            ctx.close()
            browser.close()
    finally:
        srv.terminate()
    print('\n%s (%d failed)' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails[:20]), len(fails)))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    try:
        run()
    except Exception as e:
        if os.environ.get('GITHUB_ACTIONS'):
            print('::error title=Lesson pages::stopped: %s' % str(e)[:600].replace(chr(10), ' '))
        raise
