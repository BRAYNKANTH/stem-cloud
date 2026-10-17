# -*- coding: utf-8 -*-
"""Real-browser checks for the new lesson pages (/learn/..., built from content/): the Phase 5 "done when" checks.

    cd web && npm run build && cd .. && python tests/test_lesson_pages.py

Needs the web build (the API serves web/dist-private/learn after the sign-in check) and Playwright with Edge, Chrome or
Playwright's Chromium (python -m playwright install chromium). For every chapter, on a phone (375 px) and a desktop:
the islands start without errors, and in every step and language nothing scrolls sideways; on the phone every control
is at least 44 px (links inside sentences excepted). On Motion: the player, the story, the quiz and its answer sheet,
worked-example reveals, read-aloud, and the page without JavaScript. Speech is replaced by a recording stub.
"""
import glob, json, os, re, subprocess, sys, tempfile, time, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8768
BASE = 'http://localhost:%d' % PORT
H = {'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'}
CATALOG = json.load(open(os.path.join(ROOT, 'content', 'catalog.json'), encoding='utf-8'))['lessons']
URLS = ['/learn/%s/g%d/%s/' % (l['subject'], l['grade'], l['slug']) for l in CATALOG]
# each lesson page on the current site -> its new lesson page
LESSON_URL = {}
for _f in glob.glob(os.path.join(ROOT, 'content', '*', '*', '*', 'lesson.json')):
    _l = json.load(open(_f, encoding='utf-8'))
    if _l.get('legacy'):
        LESSON_URL[_l['legacy']['file']] = '/learn/%s/g%d/%s/' % (_l['subject'], _l['grade'], _l['slug'])
MOTION = '/learn/physics/g10/motion-in-a-straight-line/'
NEWTON = '/learn/physics/g10/newtons-laws/'
FRICTION = '/learn/physics/g10/friction/'
RESULTANT = '/learn/physics/g10/resultant-force/'
TURNING = '/learn/physics/g10/turning-effect/'
EQUILIBRIUM = '/learn/physics/g10/equilibrium/'
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


def OUTBOX(pg):
    """What is still waiting in the device's outbox (for a failure message)."""
    return pg.evaluate("""new Promise(res => { const r = indexedDB.open('stem-progress', 1); r.onsuccess = () => { const q = r.result.transaction('outbox').objectStore('outbox').getAll();
        q.onsuccess = () => res(q.result.map(e => e.type + ':' + (e.step || e.badge || e.source || e.game || ''))); }; r.onerror = () => res('no outbox'); })""")


def set_lang(pg, lang):
    """The language button is in the header: open it and choose (a page without it has the language buttons in its
    content: scroll up first, as a student would)."""
    pg.evaluate('scrollTo(0, 0)')
    if pg.locator('.langsw-btn').count():          # the language button in the header (islands/LangSwitch.tsx)
        pg.click('.langsw-btn')
        pg.click('.langsw-menu button[lang=%s]' % lang)
    else:
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
            check('the chapter name is the page\'s one H1; the two step bars have their own names',
                  lambda: pg.locator('h1').count() == 1 and pg.locator('header').count() == 1
                  and {'Step menu', 'Step navigation'} <= set(pg.eval_on_selector_all('nav', 'ns => ns.map(n => n.getAttribute("aria-label"))')),
                  lambda: (pg.locator('h1').count(), pg.locator('header').count(), pg.eval_on_selector_all('nav', 'ns => ns.map(n => n.getAttribute("aria-label"))')))
            check('one way forward: Next is the bottom bar, sticky in thumb reach (no Next at the top)',
                  lambda: pg.locator('.lbar .lb-btn.primary').count() == 0 and pg.evaluate("getComputedStyle(document.querySelector('.lend')).position") == 'sticky')
            pg.click('.lend .btn.primary')
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
            pg.click('.lend .btn.primary')
            check('Watch: its scene of the animation, rebuilt (not a frame)', lambda: pg.locator('#watch .watch-anim #fw_svg > *').count() > 5 and pg.locator('#watch iframe').count() == 0)
            pg.locator('#watch #fw_scrub').fill('1000')
            check('...and the time slider stays inside the scene (0 to 11 s of 30)', lambda: int(pg.locator('#watch #fw_scrub').input_value()) <= 367 and not pg.locator('#watch #fw_rep').is_visible(),
                  lambda: pg.locator('#watch #fw_scrub').input_value())
            pg.click('.lend .btn.primary')
            story = pg.locator('#explore .tp-story')
            story.locator('.qz-opt').nth(1).click()
            check('Explore: an answer shows whether it is right and why', lambda: story.locator('.qz-explain.show').count() == 1 and story.locator('.qz-opt.correct').count() == 1)
            story.locator('.tp-next').click()
            story.locator('.qz-card').nth(1).locator('.qz-opt').nth(2).click()
            check('...then the next question, and the wrap-up at the end', lambda: story.locator('.qz-card').count() == 2 and pg.locator('#explore .tp-story .tp-wrap').is_visible())
            pg.click('.lend .btn.primary')
            check('Practice: the lesson questions and exercises of the topic, in order', lambda: pg.locator('#practice .ex').count() == 4 and pg.locator('#practice .qz .qz-card').count() == 1)
            check('...a practice question has no score line', lambda: pg.locator('#practice .quiz-score').count() == 0)
            pg.locator('#practice .qz .qz-opt').first.click()
            check('...and opens the answer sheet', lambda: pg.locator('#stem-qsheet').count() == 1)
            pg.keyboard.press('Escape')
            # the current pages' section ids open the step they became (old links and the cut-over redirects keep the #section)
            pg.wait_for_timeout(300)                      # closing the answer sheet goes back in history: let it land first
            for old, new in (('practice', 'worked'), ('sortgame', 'sort'), ('exercises', 'exercises')):
                pg.goto('about:blank')                    # each one a fresh load, as a link from elsewhere would be
                pg.goto(BASE + MOTION + '#' + old)
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                check('an old link #%s opens the %s step (and only that one)' % (old, new), lambda: pg.eval_on_selector_all('section.lstep.on', 'els => els.map(e => e.id)') == [new],
                      lambda: pg.evaluate("""[location.href, document.documentElement.hasAttribute('data-player'), [...document.querySelectorAll('section.lstep.on')].map(s => s.id),
                        ((document.querySelector('astro-island[component-url*=LessonPlayer]') || { getAttribute: () => '' }).getAttribute('props') || '').match(/aliases.{0,120}/)]"""))
            pg.goto(BASE + MOTION + 'topics/acceleration/#explore')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check("a topic's Explore lab is the rebuilt lab (not a frame)", lambda: pg.locator('#explore .lab-card .lg-try').count() == 3 and pg.locator('#explore iframe').count() == 0)
            pg.goto(BASE + MOTION + 'topics/speed-velocity/')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            ids = pg.eval_on_selector_all('section.lstep', 'els => els.map(e => e.id)')
            check('a topic without a video or story leaves those steps out', ids == ['understand', 'practice'], ids)
            pg.goto(BASE + MOTION + 'topics/revision/#quiz')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('the revision has the summary, mixed practice and the scored chapter quiz', lambda: pg.eval_on_selector_all('section.lstep', 'els => els.map(e => e.id)') == ['summary', 'mixed', 'quiz']
                  and on() == 'quiz' and pg.locator('#quiz .quiz-score').is_visible())

            # ------------------------------------------------------------ Motion: the bus stop game (the lab step)
            # animations off (as a student can choose), so each ride ends at once
            pg.evaluate("localStorage.setItem('stem_motion', 'off'); localStorage.removeItem('scx_bus_v1')")
            pg.goto(BASE + MOTION + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.locator('.bus').scroll_into_view_if_needed()
            pg.wait_for_selector('.bus .stop')          # the game is fetched when the step comes into view (labs/physics/BusStop.tsx)
            coins = lambda: pg.inner_text('.hud-coins b')
            stars = lambda: pg.inner_text('.hud-stars b')
            check('the lab step starts with the bus stop game: 5 stops (4 locked), 0 stars, Rs 10, then the free lab',
                  lambda: pg.locator('.bus .stop').count() == 5 and pg.locator('.bus .stop:disabled').count() == 4 and stars() == '0' and coins() == '10'
                  and pg.locator('#lab .lab-card .lg-try').count() == 3, lambda: (pg.locator('.bus .stop').count(), stars(), coins()))
            signs = lambda: pg.eval_on_selector_all('.bus-scene .sign-t, .bus-scene .lbl', 'els => els.map(e => e.textContent)')
            check('before the ride the road shows every place in the story', lambda: {'Home', 'Corner shop', "Kamal's house"} <= set(signs()), signs)
            pg.click('.bus-opts .opt >> nth=1')
            pg.click('.bus .chip >> text="Rs 2"')
            pg.click('.bus-bet .btn.primary')
            check('a right prediction wins the bet and the first star', lambda: coins() == '12' and stars() == '1', lambda: (coins(), stars()))
            check('...and the next stop stays locked until this one is cleared (all three steps)',
                  lambda: pg.locator('.bus .stop:disabled').count() == 4 and pg.locator('.bus-map-note').is_visible())
            pg.locator('#bus-time').fill('24')
            check('the ride can be watched again: the time slider moves Nimal, the readouts and the graph together',
                  lambda: pg.inner_text('.bus-ro').replace('\n', ' ').count('24.0 s') == 1 and '92.0 m' in pg.inner_text('.bus-ro')
                  and pg.locator('.bus-graph .g-ghost').count() == 1 and pg.locator('.bus-scene .disp text').text_content() == '68 m east',
                  lambda: (pg.inner_text('.bus-ro').split(), pg.locator('.bus-graph .g-ghost').count(), pg.locator('.bus-scene .disp text').all_text_contents()))
            pg.click('.bus-msg .btn.primary')
            check('reading the graph starts with the ride again, the step saying what to do',
                  lambda: pg.inner_text('.bus-do').startswith('Step 2 of 3') and pg.locator('#bus-time').input_value() == '30')
            pg.focus('.bus-graph.tap svg')
            for _ in range(4):
                pg.keyboard.press('PageUp')
            check('the graph reads a value from the keyboard', lambda: pg.inner_text('.g-read').startswith('Time 20.0 s'), lambda: pg.inner_text('.g-read'))
            pg.keyboard.press('Enter')
            pg.click('.bus-row .btn.primary >> nth=0')
            check('reading the graph right gives a star and Rs 2', lambda: coins() == '14' and stars() == '2', lambda: (coins(), stars()))
            pg.click('.bus-row .btn.primary >> nth=1')
            pg.locator('#bus-e').fill('90')
            pg.locator('#bus-w').fill('40')
            pg.click('.bus-panel .btn.primary')
            check('a ride that misses the goal says what happened', lambda: 'Distance 130 m' in pg.inner_text('.bus-msg.err'))
            pg.locator('#bus-e').fill('80')
            pg.click('.bus-panel .btn.primary')
            check('the goal gives the third star, opens the next stop, and is kept on this device',
                  lambda: stars() == '3' and coins() == '17' and pg.locator('.bus .stop:disabled').count() == 3
                  and pg.evaluate("JSON.parse(localStorage.getItem('scx_bus_v1')).stars[0]") == 15, lambda: (stars(), coins()))
            pg.click('.bus-shop summary')
            pg.click('.bus-shop li >> nth=1 >> .btn')
            check('the bike shop sells a helmet for Rs 8 and Nimal wears it', lambda: coins() == '9' and pg.locator('.bus-scene path[fill="#E53935"]').count() == 1, lambda: coins())
            pg.evaluate("localStorage.removeItem('stem_motion')")

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
            pg.click('.lend .btn.primary')
            check('a new step stops reading', lambda: pg.locator('#stem-vp').count() == 0)
            set_lang(pg, 'en')
            pg.goto(BASE + MOTION + '#story')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.evaluate("localStorage.setItem('stem_story_mode', 'off')")
            pg.reload()
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.click('.lbar .lb-listen')
            check('on the story, Listen switches the story voices', lambda: pg.evaluate("localStorage.getItem('stem_story_mode')") == 'rec' and pg.locator('#stem-vp').count() == 0)
            # ------------------------------------------------------------ Motion: the lab, rebuilt (labs/physics/MotionLab.tsx)
            pg.goto(BASE + MOTION + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('the lab is the rebuilt one, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('the lab stage draws Raja and Chittu', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_u2_' + i))")
            pg.locator('#lab .lg-try').nth(2).click()                    # slowing down, then back: u = 10, a = -2
            ro = lambda k: pg.locator('#lab [data-ro=%s]' % k).inner_text()
            check('a try sets the sliders and plays', lambda: pg.locator('#uSlider').input_value() == '10' and pg.locator('#aSlider').input_value() == '-2' and float(ro('t').split()[0]) > 0)
            pg.wait_for_function("document.querySelector('#lab [data-ro=t]').textContent.startsWith('10.0')", timeout=20000)
            check('the motion: after 10 s, v = -10 m/s, displacement 0, distance 50 m', lambda: (ro('v'), ro('s'), ro('d')) == ('-10.0 m/s', '0.0 m', '50.0 m'), lambda: (ro('v'), ro('s'), ro('d')))
            check('stopping and turning back complete missions 2 and 3', lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')] == [False, True, True],
                  lambda: pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)'))
            check('a mission is kept on this device under the current page key', lambda: pg.evaluate("localStorage.getItem('scx_lab_u2_2')") == '1')
            # ------------------------------------------------------------ Newton's laws: the Force lab, rebuilt (labs/physics/ForceLab.tsx)
            pg.goto(BASE + NEWTON + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('Force lab: rebuilt, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('Force lab: the stage draws', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_c4_' + i))")
            pg.locator('#lab .lg-try').nth(2).click()                    # double the push: F = 20 N, m = 5 kg
            check('Force lab: a try sets F and m, a = F/m', lambda: pg.locator('#fSlider').input_value() == '20' and pg.locator('#mSlider').input_value() == '5' and ro('a') == '4.00 ms⁻²', lambda: ro('a'))
            pg.wait_for_function("document.querySelector('#lab [data-ro=t]').textContent.startsWith('6.0')", timeout=20000)
            check('Force lab: after 6 s, v = 24 m/s, p = 120 kg m/s, s = 72 m', lambda: (ro('v'), ro('p'), ro('s')) == ('24.0 m/s', '120.0 kg·m/s', '72.0 m'), lambda: (ro('v'), ro('p'), ro('s')))
            check('Force lab: a big acceleration completes mission 1 only', lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')] == [True, False, False],
                  lambda: pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)'))
            check('Force lab: the mission is kept under the current page key', lambda: pg.evaluate("localStorage.getItem('scx_lab_c4_0')") == '1')
            set_lang(pg, 'ta')
            check('Force lab: in Tamil', lambda: pg.locator('#lab .lg-try').nth(0).inner_text().startswith('1. 10 N தள்ளல்'))
            set_lang(pg, 'en')
            # ------------------------------------------------------------ Friction: the lab, rebuilt (labs/physics/FrictionLab.tsx)
            pg.goto(BASE + FRICTION + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('Friction lab: rebuilt, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('Friction lab: the stage draws', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_c5_' + i))")
            pg.locator('#lab .lg-try').nth(2).click()                    # rough floor, 8 N: below the 12 N limit
            check('Friction lab: below the limit friction matches the push', lambda: (ro('status'), ro('limit'), ro('fr')) == ('Stationary', '12.0 N', '8.0 N'), lambda: (ro('status'), ro('limit'), ro('fr')))
            pg.wait_for_timeout(1500)
            check('...and the block does not move', lambda: ro('s') == '0.0 m' and ro('t') == '0.0 s', lambda: (ro('s'), ro('t')))
            pg.locator('#lab .lg-try').nth(1).click()                    # smooth floor, 8 N: past the 6 N limit
            check('Friction lab: past the limit it slides on dynamic friction', lambda: (ro('status'), ro('limit'), ro('fr')) == ('Sliding!', '6.0 N', '4.5 N'), lambda: (ro('status'), ro('limit'), ro('fr')))
            pg.wait_for_function("document.querySelector('#lab [data-ro=t]').textContent.startsWith('6.0')", timeout=20000)
            check('Friction lab: after 6 s it slid 31.5 m (a = (8 - 4.5) / 2)', lambda: ro('s') == '31.5 m', lambda: ro('s'))
            check('Friction lab: sliding on the smooth floor completes mission 1 only', lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')] == [True, False, False],
                  lambda: pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)'))
            check('Friction lab: the mission is kept under the current page key', lambda: pg.evaluate("localStorage.getItem('scx_lab_c5_0')") == '1')
            # ------------------------------------------------------------ Resultant force: the lab, rebuilt (labs/physics/ResultantLab.tsx)
            pg.goto(BASE + RESULTANT + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('Resultant lab: rebuilt, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('Resultant lab: the stage draws', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_c9_' + i))")
            pg.locator('#lab .lg-try').nth(2).click()                    # left pull bigger: 8 N right, 15 N left
            check('Resultant lab: R = 7 N to the left', lambda: ro('R') == '7.0 N ←', lambda: ro('R'))
            pg.wait_for_function("document.querySelector('#lab [data-ro=t]').textContent.startsWith('6.0')", timeout=20000)
            check('Resultant lab: after 6 s, v = -8.4 m/s, s = -25.2 m (a = R / 5 kg)', lambda: (ro('v'), ro('s')) == ('-8.4 m/s', '-25.2 m'), lambda: (ro('v'), ro('s')))
            pg.locator('#lab .lg-try').nth(1).click()                    # equal pulls
            check('Resultant lab: equal pulls are balanced', lambda: ro('R') == '0.0 N (balanced!)', lambda: ro('R'))
            check('Resultant lab: Chittu winning, then equal pulls, complete missions 3 and 1', lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')] == [True, False, True],
                  lambda: pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)'))
            # ------------------------------------------------------------ Turning effect: the see-saw lab, rebuilt (labs/physics/SeesawLab.tsx)
            pg.goto(BASE + TURNING + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('See-saw lab: rebuilt, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('See-saw lab: the stage draws', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_c11_' + i))")
            pg.locator('#lab .lg-try').nth(1).click()                    # 30 N at 1 m against 10 N at 3 m
            check('See-saw lab: heavy close balances light far (30 N m each)', lambda: (ro('mL'), ro('mR'), ro('bal')) == ('30.0 N m', '30.0 N m', '⚖️ Balanced!'), lambda: (ro('mL'), ro('mR'), ro('bal')))
            missions = lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')]
            check('See-saw lab: a Try that balances it does not do the missions for the student', lambda: missions() == [False, False, False], missions)
            pg.locator('#lab .lg-try').nth(2).click()                    # 20 N m against 40 N m
            check('See-saw lab: the bigger right moment tips it right', lambda: (ro('mL'), ro('mR'), ro('bal')) == ('20.0 N m', '40.0 N m', '↘️ Tips right'), lambda: (ro('mL'), ro('mR'), ro('bal')))
            pg.locator('#dLSlider').fill('4')
            check('See-saw lab: a slider rebalances it', lambda: ro('bal') == '⚖️ Balanced!', lambda: ro('bal'))
            check('...and balancing it yourself completes mission 1, with a line on what it showed', lambda: missions() == [True, False, False] and pg.inner_text('#lab .ls-note').startswith('Mission done.'), missions)
            pg.locator('#fLSlider').fill('20')
            pg.locator('#dLSlider').fill('2')                            # 20 N at 2 m against 10 N at 4 m
            check('See-saw lab: a heavy weight at a different distance completes missions 2 and 3', lambda: missions() == [True, True, True], missions)
            # ------------------------------------------------------------ Equilibrium: the lab, rebuilt (labs/physics/EquilibriumLab.tsx)
            pg.goto(BASE + EQUILIBRIUM + '#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            check('Equilibrium lab: rebuilt, not a frame', lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('Equilibrium lab: the stage draws', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_c12_' + i))")
            pg.locator('#lab .lg-try').nth(2).click()                    # 20 + 20 up against 60 down
            check('Equilibrium lab: 40 N up against 60 N down moves down', lambda: (ro('net'), ro('eq')) == ('-20 N', '⬇️ Moves down'), lambda: (ro('net'), ro('eq')))
            pg.locator('#lab .lg-try').nth(0).click()                    # one rope, 60 N
            check('Equilibrium lab: one rope holding the weight is in equilibrium', lambda: (ro('net'), ro('eq')) == ('0 N', '⚖️ In equilibrium!'), lambda: (ro('net'), ro('eq')))
            missions = lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')]
            check('Equilibrium lab: the Try buttons do not do the missions', lambda: missions() == [False, False, False], missions)
            pg.locator('#lab .lg-try').nth(1).click()                    # 30 + 40 = 70
            pg.locator('#f1Slider').fill('60')
            check('Equilibrium lab: more pull than weight moves up', lambda: (ro('net'), ro('eq')) == ('+30 N', '⬆️ Moves up'), lambda: (ro('net'), ro('eq')))
            pg.locator('#f1Slider').fill('30')                           # 30 + 40 = 70 again
            pg.locator('#f2Slider').fill('0')
            pg.locator('#wSlider').fill('30')                            # one rope, 30 N
            check('Equilibrium lab: flying, two ropes and one rope, done with the sliders, complete all three missions', lambda: missions() == [True, True, True], missions)
            # ------------------------------------------------------------ the slider labs, lifted from their pages (tools/slider_labs.py, labs/SliderLab.tsx)
            warns = []
            pg.on('console', lambda m: warns.append(m.text[:150]) if m.type == 'warning' and m.text.startswith('lab ') else None)
            for page in sorted(glob.glob(os.path.join(ROOT, 'site', 'lessons', '*.html'))):
                src = open(page, encoding='utf-8').read()
                if 'INTERACTIVE LAB (sliders + live drawing)' not in src:
                    continue
                url = LESSON_URL[os.path.basename(page)]
                name = url.rstrip('/').split('/')[-1]
                guide = src[src.index('GUIDED LAB'):]
                tries = [dict((k, v) for k, v in re.findall(r'(\w+)Slider:\s*([-\d.]+)', t)) for t in re.findall(r'set:\{([^}]*)\}', guide[:guide.index('live:')])]
                pg.goto(BASE + url + '#lab')
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                check('%s lab: rebuilt, not a frame' % name, lambda: pg.locator('#lab .lab-card').count() == 1 and pg.locator('#lab iframe').count() == 0)
                pg.locator('#lab .ls-pic > svg').scroll_into_view_if_needed()
                check('%s lab: the stage draws' % name, lambda: pg.locator('#lab .ls-pic > svg > *').count() > 10)
                check('%s lab: the sliders come right after the picture, 44 px tall, with - and +' % name,
                      lambda: pg.evaluate("(() => { const p = document.querySelector('#lab .ls-pic'), c = document.querySelector('#lab .lab-controls'), r = c.querySelector('input[type=range]');"
                                          " return p.nextElementSibling === c && r.getBoundingClientRect().height >= 44 && c.querySelectorAll('.sl-step').length === 2 * c.querySelectorAll('input[type=range]').length; })()"))
                pg.locator('#lab .ls-switch button').nth(1).click()
                check('%s lab: "Diagram" shows the diagram in the same place, and it draws' % name,
                      lambda: pg.locator('#lab .lab-svg-wrap svg > *').count() > 3 and pg.locator('#lab .lab-svg-wrap svg').is_visible() and not pg.locator('#lab .ls-pic > svg').is_visible())
                pg.locator('#lab .ls-switch button').nth(0).click()
                check('%s lab: the readout is one line, no stray "·" before "="' % name, lambda: ' · =' not in pg.inner_text('#lab .a-readout'), lambda: pg.inner_text('#lab .a-readout'))
                for i, want in enumerate(tries):
                    pg.locator('#lab .lg-try').nth(i).click()
                    js = lambda x: str(int(float(x))) if float(x) == int(float(x)) else str(float(x))
                    check('%s lab: try %d sets its sliders and the readout' % (name, i + 1),
                          lambda: all(ro(k) == js(x) for k, x in want.items()) and ro('a') != '' and ro('b') != '' and pg.locator('#lab .lg-see b').count() == 1,
                          lambda: ([(k, ro(k), js(x)) for k, x in want.items()], ro('a'), ro('b')))
            check('slider labs: nothing failed to draw', lambda: not warns, lambda: warns)
            # hydrostatic pressure: 1 m of mercury
            pg.goto(BASE + '/learn/physics/g10/hydrostatic-pressure/#lab')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.evaluate("[0,1,2].forEach(i => localStorage.removeItem('scx_lab_g10c15_' + i))")   # the loop above did them: start again
            pg.reload()
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.locator('#lab .lg-try').nth(3).click()
            check('Pressure lab: 1 m of mercury is 136 000 Pa', lambda: (ro('a'), ro('b')) == ('P = hρg = 1 × 13 600 × 10', '= 136 000 Pa'), lambda: (ro('a'), ro('b')))
            missions = lambda: [c == 'ls-m ok' for c in pg.eval_on_selector_all('#lab .ls-m', 'ms => ms.map(m => m.className)')]
            check('Pressure lab: the "Mercury, 1 m" try does not do the missions for the student', lambda: missions() == [False, False, False], missions)
            pg.locator('#hSlider').fill('0.5')
            pg.locator('#rhoSlider').fill('1000')
            pg.locator('#rhoSlider').fill('13600')                       # mercury, 0.5 m: 68 000 Pa
            pg.locator('#hSlider').fill('2')                             # 272 000 Pa
            check('Pressure lab: mercury and over 100 000 Pa, done with the sliders, complete missions 2 and 3', lambda: missions() == [False, True, True], missions)
            check('Pressure lab: missions kept under the page key', lambda: pg.evaluate("localStorage.getItem('scx_lab_g10c15_1')") == '1')
            pg.locator('#lab .sl-step').nth(1).click()
            check('Pressure lab: "+" moves the depth one step (2 -> 2.5 m)', lambda: pg.locator('#hSlider').input_value() == '2.5' and pg.locator('#hSlider').get_attribute('aria-valuetext') == '2.5 m',
                  lambda: (pg.locator('#hSlider').input_value(), pg.locator('#hSlider').get_attribute('aria-valuetext')))
            check('Pressure lab: the picture is named by what it shows', lambda: pg.locator('#lab .ls-pic > svg').get_attribute('aria-label') == 'P = hρg = 2.5 × 13 600 × 10 = 340 000 Pa',
                  lambda: pg.locator('#lab .ls-pic > svg').get_attribute('aria-label'))
            set_lang(pg, 'ta')
            check('Pressure lab: in Tamil', lambda: pg.locator('#lab .lg-try').nth(0).inner_text().startswith('நீர்'))
            check('Pressure lab: in Tamil a lab is ஆய்வகம் and a mission பணி', lambda: 'லேப்' not in pg.inner_text('#lab') and 'மிஷன்' not in pg.inner_text('#lab'))
            set_lang(pg, 'si')
            check('Pressure lab: in Sinhala (the try, the slider, the mission)', lambda: pg.locator('#lab .lg-try').nth(0).inner_text() == 'ජලය, 2 m ගැඹුර'
                  and pg.locator('#lab .control label span').first.inner_text() == 'ගැඹුර' and pg.locator('#lab .ls-m').first.inner_text().endswith('මෙහෙයුම 1: රාජා ජලයේ (ඝනත්වය 1000) හරියටම 5 m ට කිමිදවන්න.'),
                  lambda: (pg.locator('#lab .lg-try').nth(0).inner_text(), pg.locator('#lab .control label span').first.inner_text(), pg.locator('#lab .ls-m').first.inner_text()))
            set_lang(pg, 'en')
            # ------------------------------------------------------------ the sort games, rebuilt (games/SortGame.tsx, data from tools/sort_games.py)
            for gf in sorted(glob.glob(os.path.join(ROOT, 'web', 'src', 'games', 'sort', '*.json'))):
                game = json.load(open(gf, encoding='utf-8'))
                slug = os.path.basename(gf)[:-5]
                url = next(u for u in LESSON_URL.values() if u.rstrip('/').endswith('/' + slug))
                pg.goto(BASE + url + '#sort')
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                g = pg.locator('#sort .lab-card')
                check('%s sort: rebuilt, not a frame' % slug, lambda: g.count() == 1 and pg.locator('#sort iframe').count() == 0)
                g.scroll_into_view_if_needed()
                check('%s sort: every term, meaning and chip is there' % slug, lambda: g.locator('.match-col').nth(0).locator('.match-tile').count() == len(game['terms'])
                      and g.locator('.match-col').nth(1).locator('.match-tile').count() == len(game['terms']) and g.locator('.sort-pool .sort-chip').count() == len(game['items']))
                # a wrong meaning first, then every right one
                t0, t1 = game['terms'][0]['id'], game['terms'][1]['id']
                g.locator('.match-col').nth(0).locator('[data-id=%s]' % t0).click()
                g.locator('.match-col').nth(1).locator('[data-id=%s]' % t1).click()
                check('%s sort: a wrong meaning is not matched' % slug, lambda: g.locator('.match-tile.matched').count() == 0)
                for t in game['terms']:
                    g.locator('.match-col').nth(0).locator('[data-id=%s]' % t['id']).click()
                    g.locator('.match-col').nth(1).locator('[data-id=%s]' % t['id']).click()
                check('%s sort: all matched' % slug, lambda: g.locator('.match-tile.matched').count() == 2 * len(game['terms']) and g.locator('[data-result=match]').inner_text() == '🎉 All matched!',
                      lambda: (g.locator('.match-tile.matched').count(), g.locator('[data-result=match]').inner_text(), g.locator('.match-col').nth(0).inner_html()[:300]))
                # a chip in the wrong bin stays, then every chip in its bin
                it = game['items'][0]
                other = next(b['id'] for b in game['bins'] if b['id'] != it['bin'])
                g.locator('.sort-pool [data-id=%s]' % it['id']).click()
                g.locator('[data-bin=%s]' % other).click()
                check('%s sort: a chip in the wrong bin stays in the pool' % slug, lambda: g.locator('.sort-pool .sort-chip').count() == len(game['items']))
                for it in game['items']:
                    g.locator('.sort-pool [data-id=%s]' % it['id']).click()
                    g.locator('[data-bin=%s]' % it['bin']).click()
                check('%s sort: every chip sorted into its bin' % slug, lambda: g.locator('.sort-pool .sort-chip').count() == 0
                      and all(g.locator('[data-bin=%s] .schip' % b['id']).count() == sum(1 for i in game['items'] if i['bin'] == b['id']) for b in game['bins'])
                      and g.locator('[data-result=sort]').inner_text() == '🎉 All chips sorted correctly!')
            # the step and the badge reach the account (motion's game)
            pg.goto(BASE + MOTION + '#sort')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            # the outbox sends in batches: give it time to reach the server (slow on CI)
            for _ in range(30):
                if (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g10.motion-in-a-straight-line').then(r => r.json())").get('steps', {}).get('sort') or {}).get('done'):
                    break
                pg.wait_for_timeout(500)
            check('sort: finishing the game marks the sort step done on the server', lambda: (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g10.motion-in-a-straight-line').then(r => r.json())").get('steps', {}).get('sort') or {}).get('done') is not None,
                  lambda: (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g10.motion-in-a-straight-line').then(r => r.json())").get('steps', {}).get('sort'), OUTBOX(pg)))
            set_lang(pg, 'ta')
            check('sort: in Tamil', lambda: pg.locator('#sort .mtitle').first.inner_text() == 'வார்த்தைகள்')
            set_lang(pg, 'en')
            # ------------------------------------------------------------ the challenge games, rebuilt (games/ChallengeGame.tsx, lifted by tools/challenge_games.py)
            gwarns = []
            pg.on('console', lambda m: gwarns.append(m.text[:150]) if m.type == 'warning' and m.text.startswith('game ') else None)
            for gf in sorted(glob.glob(os.path.join(ROOT, 'web', 'src', 'games', 'challenge', '*.js'))):
                src = open(gf, encoding='utf-8').read()
                slug = os.path.basename(gf)[:-3]
                key = re.search(r'"starsKey": "([^"]+)"', src).group(1)
                answers = [float(x) for x in re.findall(r'"correct": ([-\d.]+)', src)]
                url = next(u for u in LESSON_URL.values() if u.rstrip('/').endswith('/' + slug))
                pg.goto(BASE + url + '#challenge')
                pg.evaluate("localStorage.removeItem('%s')" % key)
                pg.reload()
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                g = pg.locator('#challenge .lab-card')
                check('%s challenge: rebuilt, not a frame' % slug, lambda: g.count() == 1 and pg.locator('#challenge iframe').count() == 0 and g.locator('.level-btn').count() == len(answers))
                g.scroll_into_view_if_needed()
                check('%s challenge: the picture draws' % slug, lambda: g.locator('.game-scene svg > *').count() > 2)
                # a far-off answer first: no stars
                g.locator('#gameGuessSlider').fill(g.locator('#gameGuessSlider').get_attribute('max'))
                g.locator('.lab-buttons .btn').click()
                far = abs(float(g.locator('#gameGuessSlider').input_value()) - answers[0]) > 10
                check('%s challenge: a far-off answer gets no stars' % slug, lambda: not far or ('lose' in g.locator('[data-ro=result]').get_attribute('class') and g.locator('[data-ro=stars]').inner_text() == ''),
                      lambda: (g.locator('[data-ro=result]').inner_text(), g.locator('[data-ro=stars]').inner_text()))
                for i, ans in enumerate(answers):
                    g.locator('.level-btn').nth(i).click()
                    sl = g.locator('#gameGuessSlider')
                    lo, step = float(sl.get_attribute('min')), float(sl.get_attribute('step'))
                    near = round(lo + round((ans - lo) / step) * step, 6)          # the nearest value the slider can take
                    sl.fill(str(int(near)) if near == int(near) else str(near))
                    g.locator('.lab-buttons .btn').click()
                    check('%s challenge: level %d, the nearest answer wins stars' % (slug, i + 1), lambda: g.locator('[data-ro=stars]').inner_text().startswith('★') and 'win' in g.locator('[data-ro=result]').get_attribute('class'),
                          lambda: (g.locator('[data-ro=guess]').inner_text(), ans, g.locator('[data-ro=result]').inner_text()))
                check('%s challenge: the best stars are kept on this device under the page key' % slug, lambda: all(n > 0 for n in json.loads(pg.evaluate("localStorage.getItem('%s')" % key) or '[0]')) and len(json.loads(pg.evaluate("localStorage.getItem('%s')" % key) or '[]')) == len(answers),
                      lambda: pg.evaluate("localStorage.getItem('%s')" % key))
            check('challenge games: nothing failed to draw', lambda: not gwarns, lambda: gwarns)
            pg.goto(BASE + '/learn/physics/g11/waves/#challenge')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            for _ in range(30):
                if (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g11.waves').then(r => r.json())").get('steps', {}).get('challenge') or {}).get('done'):
                    break
                pg.wait_for_timeout(500)
            check('challenge: the stars and the step reach the account', lambda: (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g11.waves').then(r => r.json())").get('steps', {}).get('challenge') or {}).get('done') is not None,
                  lambda: pg.evaluate("fetch('/api/v2/progress?lesson=physics.g11.waves').then(r => r.json())"))
            set_lang(pg, 'ta')
            check('challenge: in Tamil', lambda: pg.locator('#challenge .lab-buttons .btn').inner_text() == '🔍 சரிபார்!')
            set_lang(pg, 'en')
            # ------------------------------------------------------------ the one-off level games: each page's own script on its own markup (games/LevelGame.tsx)
            def answers(src):
                """Each level's answer, from the page's own levels in the generated module."""
                lv = src[src.index('const levels = '):src.index('];', src.index('const levels = '))]
                if 'mu:' in lv:          # push-it: at least mu x N, the nearest whole newton above
                    return [int(-(-round(float(m) * float(n), 6) // 1)) for m, n in re.findall(r'mu:([\d.]+), N:([\d.]+)', lv)]
                if 'fA:' in lv:          # tug of war: the resultant
                    return [int(a) + int(b) if s == 'true' else abs(int(a) - int(b)) for a, b, s in re.findall(r'fA:(\d+), fB:(\d+), sameDir:(true|false)', lv)]
                if 'fL:' in lv:          # balance: the right force fL x dL / dR
                    return [round(int(f) * int(d) / int(r)) for f, d, r in re.findall(r'fL:(\d+), dL:(\d+), dR:(\d+)', lv)]
                return [round(float(c)) for c in re.findall(r'"?correct"?:\s*([\d.]+)', lv)]
            for gf in sorted(glob.glob(os.path.join(ROOT, 'web', 'src', 'games', 'levels', '*.js'))):
                src = open(gf, encoding='utf-8').read()
                slug = os.path.basename(gf)[:-3]
                meta = json.loads(src[src.index('export const META = ') + 20:src.index(';\n', src.index('export const META = '))])
                url = next(u for u in LESSON_URL.values() if u.rstrip('/').endswith('/' + slug))
                pg.goto(BASE + url + '#' + meta['step'])
                pg.evaluate("localStorage.removeItem('%s')" % meta['starsKey'])
                pg.reload()
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                g = pg.locator('#%s .level-game' % meta['step'])
                ans = answers(src)
                check('%s %s: its own game, not a frame' % (slug, meta['step']), lambda: g.count() == 1 and pg.locator('#%s iframe' % meta['step']).count() == 0 and g.locator('.level-btn').count() == len(ans) == 5)
                g.scroll_into_view_if_needed()
                check('%s %s: the picture draws' % (slug, meta['step']), lambda: g.locator('svg > *').count() > 0)
                sl, btn = g.locator('input[type=range]'), g.locator('.lab-buttons .btn')
                for i, a in enumerate(ans):
                    g.locator('.level-btn').nth(i).click()
                    sl.fill(str(a))
                    btn.click()
                    check('%s %s: level %d, the answer %s wins stars' % (slug, meta['step'], i + 1, a), lambda: g.locator('.star-row').inner_text().startswith('★') and 'win' in g.locator('.game-result').get_attribute('class'),
                          lambda: (sl.input_value(), g.locator('.game-result').inner_text()))
                lo, hi = float(sl.get_attribute('min')), float(sl.get_attribute('max'))
                sl.fill(sl.get_attribute('max') if ans[-1] - lo < hi - ans[-1] else sl.get_attribute('min'))   # the end farthest from the answer
                btn.click()
                check('%s %s: a far-off answer does not win' % (slug, meta['step']), lambda: 'lose' in g.locator('.game-result').get_attribute('class'),
                      lambda: (sl.input_value(), g.locator('.game-result').inner_text()))
                check('%s %s: the best stars are kept under the page key' % (slug, meta['step']), lambda: [n > 0 for n in json.loads(pg.evaluate("localStorage.getItem('%s')" % meta['starsKey']) or '[]')] == [True] * 5,
                      lambda: pg.evaluate("localStorage.getItem('%s')" % meta['starsKey']))
                set_lang(pg, 'ta')
                g.scroll_into_view_if_needed()
                check('%s %s: in Tamil' % (slug, meta['step']), lambda: re.search('[\u0B80-\u0BFF]', g.locator('.lab-buttons .btn').inner_text() + g.locator('.lab-hint').inner_text()) is not None)
                set_lang(pg, 'en')
            pg.goto(BASE + '/learn/physics/g10/friction/#pushit')
            pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
            for _ in range(30):
                if (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g10.friction').then(r => r.json())").get('steps', {}).get('pushit') or {}).get('done'):
                    break
                pg.wait_for_timeout(500)
            set_lang(pg, 'si')
            g = pg.locator('#pushit .level-game')
            g.scroll_into_view_if_needed()
            check('level games: in Sinhala, the markup and what the script writes', lambda: g.locator('.lab-buttons .btn').inner_text() == '💥 තල්ලු කරන්න!'
                  and g.locator('#levelDesc').inner_text() == 'ලී පෙට්ටිය, සුමට බිම' and 'ඔබේ අනුමානය — බලය' in g.locator('label').inner_text(),
                  lambda: (g.locator('.lab-buttons .btn').inner_text(), g.locator('#levelDesc').inner_text(), g.locator('label').inner_text()))
            g.locator('.level-btn').nth(1).click()      # (no Sinhala for this level's name yet: it stays English, as on the page)
            g.locator('.level-btn').nth(0).click()
            check('...and as the script rewrites it (back to level 1)', lambda: g.locator('#levelDesc').inner_text() == 'ලී පෙට්ටිය, සුමට බිම', lambda: g.locator('#levelDesc').inner_text())
            set_lang(pg, 'en')
            check('level games: the step reaches the account', lambda: (pg.evaluate("fetch('/api/v2/progress?lesson=physics.g10.friction').then(r => r.json())").get('steps', {}).get('pushit') or {}).get('done') is not None)
            # ------------------------------------------------------------ the Watch animations: each page's own card and player (watch/WatchAnim.tsx)
            wwarns = []
            pg.on('console', lambda m: wwarns.append(m.text[:150]) if m.type == 'warning' and m.text.startswith('watch ') else None)
            for card in sorted(glob.glob(os.path.join(ROOT, 'web', 'src', 'watch', '*.card.js'))):
                slug = os.path.basename(card)[:-len('.card.js')]
                url = next(u for u in LESSON_URL.values() if u.rstrip('/').endswith('/' + slug))
                pg.goto(BASE + url + '#watch')
                pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                w = pg.locator('#watch .watch-anim')
                check('%s watch: its own animation, not a frame' % slug, lambda: w.count() == 1 and pg.locator('#watch iframe').count() == 0)
                w.scroll_into_view_if_needed()
                check('%s watch: the cartoon draws, with a caption' % slug, lambda: w.locator('#fw_svg > *').count() > 5 and w.locator('#fw_cap').inner_text().strip() != '',
                      lambda: (w.locator('#fw_svg > *').count(), w.locator('#fw_cap').inner_text()))
                first = w.locator('#fw_cap').inner_text()
                w.locator('#fw_scrub').fill('1000')
                check('%s watch: the time slider goes to the end (the last caption)' % slug, lambda: w.locator('#fw_n').inner_text() != '1' or w.locator('#fw_cap').inner_text() != first,
                      lambda: (w.locator('#fw_n').inner_text(), w.locator('#fw_cap').inner_text()))
            check('Watch: nothing failed', lambda: not wwarns, lambda: wwarns)
            # the end counts as watching it; Tamil
            L2 = 'physics.g11.waves'
            for _ in range(30):
                if (pg.evaluate("fetch('/api/v2/progress?lesson=%s').then(r => r.json())" % L2).get('steps', {}).get('watch') or {}).get('done'):
                    break
                pg.goto(BASE + '/learn/physics/g11/waves/#watch') if _ == 0 else pg.wait_for_timeout(500)
                if _ == 0:
                    pg.wait_for_function("!document.querySelector('astro-island[ssr]:not([client=visible])')")
                    pg.locator('#watch .watch-anim').scroll_into_view_if_needed()
                    pg.locator('#watch #fw_scrub').fill('1000')
            check('Watch: reaching the end marks the step watched on the server', lambda: (pg.evaluate("fetch('/api/v2/progress?lesson=%s').then(r => r.json())" % L2).get('steps', {}).get('watch') or {}).get('done') is not None)
            set_lang(pg, 'ta')
            pg.locator('#watch .watch-anim').scroll_into_view_if_needed()
            check('Watch: in Tamil', lambda: re.search('[\u0B80-\u0BFF]', pg.locator('#watch #fw_play').inner_text() + pg.locator('#watch #fw_cap').inner_text()) is not None,
                  lambda: pg.locator('#watch #fw_play').inner_text())
            set_lang(pg, 'en')

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
            check('progress: XP is switched off (none earned, none in the header)', lambda: summary()['xp'] == 0 and pg.locator('.xp-chip').count() == 0, lambda: summary())
            right = [int(i) for i in pg.eval_on_selector_all('.quiz.nojs .qz-ans > p:first-of-type b', "bs => bs.map(b => 'ABCDEF'.indexOf(b.textContent))")]
            pg.locator('.qz .qz-card').nth(0).locator('.qz-opt').nth(right[0]).click()       # the same question right again, after a reload
            pg.keyboard.press('Escape')
            check('progress: a repeated answer leaves nothing in the outbox', lambda: outbox() == 0, lambda: outbox())
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

            # ------------------------------------------------------------ past papers (the PastPapers island)
            r = visitor.request.get(BASE + '/past-papers/', max_redirects=0)
            check('past papers: a visitor is sent to the login page', r.status == 302 and r.headers.get('location', '').startswith('/login?next=/past-papers/'), r.status)
            ctx = context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
            # the answers, from the question banks themselves (to answer right on purpose)
            PP = {q['id']: q for f in glob.glob(os.path.join(ROOT, 'content', 'past-papers', 'physics', '20*.json')) for q in json.load(open(f, encoding='utf-8')).get('questions', [])}
            pp_state = lambda: pg.evaluate("fetch('/api/past-papers/state').then(r => r.json())")
            xp = lambda: pg.evaluate("fetch('/api/v2/progress/summary').then(r => r.json())")['xp']
            pg.goto(BASE + '/past-papers/')
            pg.wait_for_selector('.pp-chapter', timeout=20000)
            cards = pg.eval_on_selector_all('.pp-chapter', 'cs => cs.map(c => c.dataset.chapter)')
            check('past papers: the home lists the chapters (and the questions no chapter teaches)', len(cards) >= 15 and 'other' in cards, cards)
            check('past papers: no progress on the home (no bars, no "done" counts, no continue card)', lambda: pg.locator('.pp-progress, .pp-bar, .pp-continue').count() == 0 and ' done' not in pg.locator('.pp-chapter').first.inner_text(), lambda: pg.locator('.pp-chapter').first.inner_text())
            check('past papers: every question is in a chapter but two (diffusion, burette)', sum(1 for q in PP.values() if not (q.get('lessons') or any(p.get('lessons') for p in q.get('parts') or []))) == 2)
            pg.locator('.pp-chapter[data-chapter=g11-chapter-11-electronics]').click()
            pg.wait_for_selector('#pp-list .pp-qitem')
            listed = lambda: pg.eval_on_selector_all('#pp-list .pp-qitem', 'bs => bs.map(b => b.dataset.q)')
            check('past papers: a chapter lists its questions from every year', lambda: len(listed()) >= 10 and 'Electronics' in pg.locator('h1').inner_text(), lambda: pg.locator('h1').inner_text())
            check('past papers: there is no paper (exam) mode', lambda: pg.locator('.pp-exam-actions, .pp-exam-bar, dialog').count() == 0)
            first = next(i for i in listed() if PP[i]['type'] == 'mcq')
            pg.locator('#pp-list .pp-qitem[data-q="%s"]' % first).click()
            check('past papers: a question opens on its own screen', lambda: pg.locator('.pp-qscreen .pp-opt').count() >= 2 and pg.locator('#pp-list').count() == 0 and first in pg.url, lambda: pg.url)
            wrong = (PP[first]['correct'] + 1) % len(PP[first]['options'])
            pg.locator('.pp-opt').nth(wrong).click()
            pg.click('.pp-check')
            check('past papers: a wrong answer is marked, with the reasons for the chosen and the right option only',
                  lambda: pg.locator('.pp-verdict.is-wrong').is_visible() and pg.locator('.pp-opt.is-right').count() == 1 and pg.locator('.pp-opt.is-wrong').count() == 1 and pg.locator('.pp-opt-why').count() == 2)
            check('past papers: after a wrong answer the step-by-step explanation is open', lambda: pg.locator('details.pp-more[open] .pp-explain .pp-x').count() >= 3)
            pg.locator('.pp-feedback .pp-link').click()           # "why not the others?"
            check('past papers: "why not the others?" shows every option\'s reason', lambda: pg.locator('.pp-opt-why').count() == len(PP[first]['options']))
            check('past papers: an answer is not kept on the account', lambda: not any(a['question'] == first for a in pp_state()['attempts']), lambda: pp_state())
            pg.locator('.pp-feedback .btn').first.click()         # "try again"
            pg.locator('.pp-opt').nth(PP[first]['correct']).click()
            pg.click('.pp-check')
            check('past papers: try again, then the right answer', lambda: pg.locator('.pp-verdict.is-right').is_visible() and pg.locator('details.pp-more[open]').count() == 0)
            check('past papers: no XP is awarded', lambda: xp() == 0, xp)
            pg.click('.pp-bookmark')
            check('past papers: a bookmark is saved to the account', lambda: len(pp_state()['bookmarks']) == 1, lambda: pp_state()['bookmarks'])
            pg.click('.pp-back')
            pg.wait_for_selector('#pp-list .pp-qitem')
            check('past papers: the list shows no status (nothing is marked done)', lambda: pg.locator('.pp-qitem-status, .pp-dot').count() == 0 and pg.locator('.pp-qitem.is-right, .pp-qitem.is-revisit').count() == 0)
            pg.locator('#pp-list .pp-qitem[data-q="%s"]' % first).click()
            check('past papers: a question answered a moment ago opens fresh again (no verdict, nothing chosen)', lambda: pg.locator('.pp-verdict').count() == 0 and pg.locator('.pp-opt.is-right, .pp-opt.is-wrong').count() == 0 and pg.locator('.pp-opt input:checked').count() == 0)
            pg.click('.pp-back')
            pg.wait_for_selector('#pp-list .pp-qitem')
            pg.locator('.pp-chip', has_text='Saved').click()
            check('past papers: the "saved" filter', lambda: listed() == [first], lambda: listed())
            pg.locator('.pp-chip').first.click()                  # all
            written = next(i for i in listed() if PP[i]['type'] == 'written')
            pg.locator('#pp-list .pp-qitem[data-q="%s"]' % written).click()
            check('past papers: a written question shows only this chapter\'s parts first', lambda: pg.locator('.pp-q > .pp-part').count() == sum(1 for p in PP[written]['parts'] if 'g11-chapter-11-electronics' in (p.get('lessons') or [])))
            pg.locator('.pp-show').first.click()
            check('past papers: "show the model answer" shows it', lambda: pg.locator('.pp-model').count() == 1)
            check('past papers: a written question has no self-check (nothing is marked)', lambda: pg.locator('.pp-selfcheck').count() == 0)
            pg.reload()
            pg.wait_for_selector('.pp-qscreen')
            check('past papers: a reload stays on the question, with nothing answered', lambda: written in pg.url and pg.locator('.pp-model').count() == 0)
            problems = pg.evaluate("() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1 ? ['scrolls sideways ' + d.scrollWidth] : []; }")
            check('past papers: no sideways scroll at 375 px', not problems, problems)
            small = pg.evaluate("[...document.querySelectorAll('.pp-app button, .pp-app select, .pp-app input, .pp-app summary, .pp-app a.btn')].filter(e => e.offsetParent && !e.closest('label') && e.getBoundingClientRect().height < 43.5).map(e => e.tagName + ' ' + (e.innerText || '').slice(0, 30))")   # a radio's target is its whole option
            check('past papers: controls are at least 44 px', not small, small[:5])
            pg.click('.pp-back')
            pg.locator('.pp-start').click()
            check('past papers: "Practise 10" starts a set of 10', lambda: pg.locator('.pp-set-head').is_visible() and '1 of 10' in pg.locator('.pp-set-head p').inner_text(), lambda: pg.locator('.pp-set-head').all_inner_texts())
            for _ in range(10):
                pg.locator('.pp-nav .btn').last.click()
            check('past papers: ...and ends with a finish screen (no score)', lambda: pg.locator('.pp-summary').is_visible() and pg.locator('.pp-score, .pp-summary-list').count() == 0)
            pg.goto(BASE + '/past-papers/#years')                  # an old link: the home
            pg.wait_for_selector('.pp-year[data-year]')
            check('past papers: there is no "continue" card', lambda: pg.locator('.pp-continue').count() == 0)
            pg.locator('.pp-year[data-year="2015"]').click()
            check('past papers: a year lists its questions', lambda: '2015' in pg.locator('h1').inner_text() and len(listed()) == sum(1 for q in PP.values() if q['id'].startswith('ol2015-')))
            pg.goto(BASE + '/past-papers/')
            pg.wait_for_selector('.pp-chapter')
            set_lang(pg, 'ta')
            check('past papers: Tamil', lambda: pg.locator('h1').inner_text() == 'கடந்த பரீட்சை வினாத்தாள்கள்', lambda: pg.locator('h1').inner_text())
            set_lang(pg, 'si')
            check('past papers: Sinhala', lambda: pg.locator('h1').inner_text() == 'අතීත ප්‍රශ්න පත්‍ර' and 'පරිච්ඡේදය' in pg.locator('.pp-chapter-no').first.inner_text(), lambda: pg.locator('h1').inner_text())
            set_lang(pg, 'en')
            tabs = lambda: pg.eval_on_selector_all('.bnav a', "as => as.map(a => a.getAttribute('href') + (a.getAttribute('aria-current') ? ' (here)' : ''))")
            check('past papers: the bottom bar is Learn / Practice / Past papers / Me', lambda: tabs() == ['/lessons/index.html', '/feed/', '/past-papers/ (here)', '/account'], tabs)
            check('past papers: one language button, in the header', lambda: pg.locator('.langsw-btn').count() == 1 and pg.locator('.pp-lang').count() == 0)
            check('past papers: no script errors', not errs, errs)
            # ------------------------------------------------------------ "Me": progress first, then the settings
            pg.goto(BASE + '/account')
            pg.wait_for_function("document.querySelectorAll('.stat b').length === 3 && ![...document.querySelectorAll('.stat b')].some(b => b.textContent.includes('…'))")
            check('Me: progress first (streak, chapters finished, badges; no XP), then the settings',
                  lambda: pg.locator('#prog-h').count() == 1 and pg.locator('.settings-h').count() == 1 and 'Continue learning' in pg.inner_text('.next-row'), lambda: pg.inner_text('.stats'))
            check('Me: nothing about past-paper marks or XP', lambda: 'revisit' not in pg.inner_text('.next-row') and 'XP' not in pg.inner_text('.stats'), lambda: pg.inner_text('.stats'))
            check('Me: the bottom bar marks Me', lambda: tabs() == ['/lessons/index.html', '/feed/', '/past-papers/', '/account (here)'], tabs)
            # ------------------------------------------------------------ the formula cards (islands/FormulaCards.tsx)
            r = visitor.request.get(BASE + '/formulas/', max_redirects=0)
            check('formula cards: a visitor is sent to the login page', r.status == 302 and r.headers.get('location', '').startswith('/login?next=/formulas/'), r.status)
            FC = json.load(open(os.path.join(ROOT, 'content', 'formulas', 'physics.json'), encoding='utf-8'))['cards']
            pressure = sum(1 for c in FC if c['lesson'] == 'physics.g10.hydrostatic-pressure')
            pg.goto(BASE + '/learn/physics/g10/hydrostatic-pressure/')
            pg.wait_for_selector('.lbar .lb-formulas')
            check("formula cards: the lesson's step bar opens its chapter's cards", lambda: pg.locator('.lbar .lb-formulas').get_attribute('href') == '/formulas/#hydrostatic-pressure')
            pg.click('.lbar .lb-formulas')
            pg.wait_for_selector('.fc-deck .fc-card')
            count = lambda: pg.inner_text('.fc-count')
            check('formula cards: the chapter, one card at a time', lambda: pg.locator('.fc-deck .fc-card').count() == pressure and count() == '1 of %d' % pressure, count)
            pg.click('.fc-pager .btn.primary')
            check('...Next goes to the next card', lambda: count() == '2 of %d' % pressure, count)
            pg.click('.fc-test')
            check('formula cards: "Test me" hides every formula', lambda: pg.locator('.fc-deck .fc-math').count() == 0 and pg.locator('.fc-reveal').count() == pressure)
            pg.locator('.fc-reveal').nth(1).click()
            check('...and a tap shows one', lambda: pg.locator('.fc-deck .fc-math').count() == 1)
            pg.locator('.fc-seg button').nth(1).click()
            pg.locator('.fc-chips button').first.click()
            check('formula cards: the list of every formula', lambda: pg.locator('.fc-list .fc-row').count() == len(FC), lambda: pg.locator('.fc-list .fc-row').count())
            set_lang(pg, 'ta')
            check('formula cards: in Tamil, with the textbook terms', lambda: pg.locator('h1').inner_text() == 'சூத்திர அட்டைகள்' and 'கதி' in pg.inner_text('.fc-list'))
            sideways = "() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1 ? ['scrolls sideways ' + d.scrollWidth] : []; }"
            check('formula cards: no sideways scroll at 375 px in Tamil (longer labels)', lambda: not pg.evaluate(sideways), lambda: pg.evaluate(sideways))
            set_lang(pg, 'si')
            check('formula cards: no sideways scroll at 375 px in Sinhala', lambda: not pg.evaluate(sideways), lambda: pg.evaluate(sideways))
            set_lang(pg, 'en')
            problems = pg.evaluate("() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1 ? ['scrolls sideways ' + d.scrollWidth] : []; }")
            check('formula cards: no sideways scroll at 375 px', not problems, problems)
            small = pg.evaluate("[...document.querySelectorAll('.fc button, .fc a')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => e.tagName + ' ' + (e.innerText || '').slice(0, 30))")
            check('formula cards: controls are at least 44 px', not small, small[:5])
            # ------------------------------------------------------------ Practice (islands/LearningFeed.tsx), the Practice tab
            POOLS = sorted(glob.glob(os.path.join(ROOT, 'content', 'practice', '*', '*.json')))
            sideways = "() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1 ? ['scrolls sideways ' + d.scrollWidth] : []; }"
            pg.goto(BASE + '/feed/')
            pg.wait_for_selector('.fd-pools')
            check('practice: the tab opens the chapter list, with no mixed questions before it', lambda: pg.locator('.fd-card').count() == 0 and pg.locator('.fd-hud').count() == 0)
            check('practice: the bottom bar marks Practice', lambda: tabs() == ['/lessons/index.html', '/feed/ (here)', '/past-papers/', '/account'], tabs)
            check('practice: every chapter with practice questions, by grade, with how many questions it has',
                  lambda: pg.locator('.fd-pools .fd-pool:not(.fd-savedlink)').count() == len(POOLS)
                  and pg.locator('.fd-pools h3').count() >= 2 and re.search(r'100 questions', pg.inner_text('.fd-pools a[href="#hydrostatic-pressure"]')) and '✓' not in pg.inner_text('.fd-pools a[href="#hydrostatic-pressure"]'),
                  lambda: pg.inner_text('.fd-pools'))
            check('practice: the chapter list has no sideways scroll at 375 px', not pg.evaluate(sideways), pg.evaluate(sideways))
            pg.evaluate("localStorage.removeItem('stem_saved_v1')")
            # tap a chapter: its 100 questions, one per screen like a reel, in a random order
            pg.click('.fd-pools a[href="#hydrostatic-pressure"]')
            pg.wait_for_selector('.fd-card[data-card]')
            round1 = pg.eval_on_selector_all('.fd-card[data-card]', 'cs => cs.map(c => c.dataset.card)')
            check('practice: a chapter opens straight into its 100 questions, nothing else among them', lambda: len(round1) == 100 and len(set(round1)) == 100
                  and all(i.startswith('hp-') for i in round1) and pg.locator('.fd-card').count() == 101, lambda: len(round1))
            check('practice: the question number (no score, no streak, no progress bar), and a cue to swipe up', lambda: '1 / 100' in pg.inner_text('.fd-pos') and pg.locator('.fd-progress').count() == 0
                  and '✓' not in pg.inner_text('.fd-score') and '🔥' not in pg.inner_text('.fd-score') and pg.locator('.fd-cue').count() == 1, lambda: pg.inner_text('.fd-score'))
            FITS = "() => { const f = document.querySelector('.fd').clientHeight; return [...document.querySelectorAll('.fd-card[data-card]')].slice(0, 6).filter(c => Math.abs(c.offsetHeight - f) > 1 || c.querySelector('.fd-inner').scrollHeight > c.querySelector('.fd-inner').clientHeight + 1).map(c => c.dataset.card); }"
            check('practice: each question is exactly one screen, and nothing in it scrolls', lambda: not pg.evaluate(FITS), lambda: pg.evaluate(FITS))
            check('practice: the reel snaps to one question at a time', lambda: pg.evaluate("() => { const cs = getComputedStyle(document.querySelector('.fd')), c = getComputedStyle(document.querySelector('.fd-card')); return cs.scrollSnapType.includes('y') && cs.scrollSnapType.includes('mandatory') && c.scrollSnapStop === 'always'; }"))
            card = pg.locator('.fd-card[data-card="%s"]' % round1[0])
            card.locator('.fd-opt').first.click()
            check('practice: an answer is checked, with the share of students who got it right', lambda: card.locator('.fd-result').count() == 1 and card.locator('.fd-poll').count() == 1
                  and 'got this right' in card.locator('.fd-poll').inner_text(), lambda: card.inner_text())
            check('practice: the answered question still fits its screen', lambda: not pg.evaluate(FITS), lambda: pg.evaluate(FITS))
            # the bookmark in the corner
            save = pg.locator('.fd-save')
            check('practice: a bookmark in the corner of the question (at least 44 px, off at first)', lambda: save.count() == 1 and save.get_attribute('aria-pressed') == 'false'
                  and save.bounding_box()['height'] >= 44 and save.bounding_box()['width'] >= 44 and save.bounding_box()['x'] > 375 - 80)
            save.click()
            check('practice: tapping it saves the question (kept on this device)', lambda: save.get_attribute('aria-pressed') == 'true'
                  and json.loads(pg.evaluate("localStorage.getItem('stem_saved_v1')")) == [round1[0]])
            pg.locator('.fd-card[data-i="1"]').scroll_into_view_if_needed()
            pg.wait_for_function("document.querySelector('.fd-pos').innerText.includes('2 / 100')", timeout=5000)
            check('practice: swiping on shows the next question number, and its bookmark is its own', lambda: '2 / 100' in pg.inner_text('.fd-pos') and save.get_attribute('aria-pressed') == 'false', lambda: pg.inner_text('.fd-pos'))
            pg.reload()
            pg.wait_for_selector('.fd-card[data-card]')
            check('practice: nothing is kept: after a reload no question is answered or marked', lambda: pg.locator('.fd-result').count() == 0 and pg.locator('.fd-opt:disabled').count() == 0
                  and pg.evaluate("localStorage.getItem('stem_feed_v1')") is None)
            pg.goto(BASE + '/feed/#saved')
            pg.wait_for_selector('.fd-card[data-card]')
            check('practice: Saved opens the bookmarked questions', lambda: pg.eval_on_selector_all('.fd-card[data-card]', 'cs => cs.map(c => c.dataset.card)') == [round1[0]]
                  and pg.locator('.fd-save').get_attribute('aria-pressed') == 'true')
            pg.locator('.fd-save').click()
            check('...and the bookmark takes one out again', lambda: pg.locator('.fd-save').get_attribute('aria-pressed') == 'false' and json.loads(pg.evaluate("localStorage.getItem('stem_saved_v1')")) == [])
            pg.goto(BASE + '/feed/#hydrostatic-pressure')
            pg.wait_for_selector('.fd-card[data-card]')
            pg.locator('.fd-end').scroll_into_view_if_needed()
            pg.locator('.fd-end .btn.primary').click()
            round2 = pg.eval_on_selector_all('.fd-card[data-card]', 'cs => cs.map(c => c.dataset.card)')
            check('practice: "Practise this chapter again" deals all 100 afresh, none answered', lambda: len(round2) == 100 and pg.locator('.fd-result').count() == 0
                  and '1 / 100' in pg.inner_text('.fd-pos'), lambda: pg.inner_text('.fd-score'))
            pg.goto(BASE + '/feed/#chapters')
            pg.wait_for_selector('.fd-pools')
            check('practice: #chapters (the header button) is the chapter list', lambda: pg.locator('.fd-card[data-card]').count() == 0)
            pg.goto(BASE + '/learn/physics/g10/hydrostatic-pressure/')
            check("practice: a lesson's finish step offers its chapter's practice", lambda: pg.locator('#finish .btn.primary').get_attribute('href') == '/feed/#hydrostatic-pressure')
            pg.goto(BASE + '/feed/#hydrostatic-pressure')
            pg.wait_for_selector('.fd-card[data-card]')
            figs = pg.locator('.fd-figure').count()
            check('practice: no sideways scroll at 375 px (%d pictures in this round)' % figs, not pg.evaluate(sideways), pg.evaluate(sideways))
            small = pg.evaluate("[...document.querySelectorAll('.fd button:not(:disabled), .fd a')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => e.tagName + ' ' + (e.innerText || '').slice(0, 30))")
            check('practice: controls are at least 44 px', not small, small[:5])
            # ------------------------------------------------------------ an address that is not there
            r = pg.request.get(BASE + '/no-such-page', headers={'accept': 'text/html'})
            check('a page that is not there: a page with a way back, not {"detail": "Not Found"}', r.status == 404 and 'Go to my lessons' in r.text(), r.status)
            r = pg.request.get(BASE + '/api/no-such-thing')
            check('...the API still answers in JSON', r.status == 404 and r.json().get('detail') == 'Not Found', r.status)
            r = pg.request.get(BASE + '/learn/', max_redirects=0)
            check('/learn/ opens the course home', r.status == 302 and r.headers.get('location') == '/lessons/index.html', r.status)
            ctx.close()

            # ------------------------------------------------------------ offline: the service worker keeps the new pages (public/static/sw.js)
            ctx = browser.new_context(storage_state=state, service_workers='allow')
            pg = ctx.new_page()
            pg.goto(BASE + FRICTION)
            pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true)")
            pg.reload()                                   # now under the service worker: the page and its scripts are kept
            pg.wait_for_function("!!navigator.serviceWorker.controller && !document.querySelector('astro-island[ssr]:not([client=visible])')")
            pg.wait_for_timeout(800)
            ctx.set_offline(True)
            pg.goto(BASE + FRICTION + '#lab')
            check('offline, a new lesson page opens from the device', lambda: pg.locator('section.lstep').count() >= 10 and 'Friction' in pg.title(), lambda: pg.title())
            pg.locator('#lab .ls svg').scroll_into_view_if_needed()
            check('...and its lab still works (its scripts are kept too)', lambda: pg.locator('#lab .ls svg > *').count() > 10)
            ctx.set_offline(False)
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
