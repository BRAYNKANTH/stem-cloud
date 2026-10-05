# -*- coding: utf-8 -*-
"""Real-browser checks for the lesson player, story swipe, read-aloud voice and textbook-question layout.

    python tests/test_player.py
Speech is replaced by a recording stub, so the test checks exactly what would be spoken.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8767
BASE = 'http://localhost:%d' % PORT
LESSONS = ['chapter-04-newtons-laws', 'chapter-05-friction', 'chapter-09-resultant-force', 'chapter-11-turning-effect', 'chapter-12-equilibrium', 'unit-02-motion-in-a-straight-line',
           'g10-chapter-15-hydrostatic-pressure', 'g10-chapter-18-work-energy-power', 'g10-chapter-19-current-electricity', 'g11-chapter-04-waves', 'g11-chapter-05-geometrical-optics',
           'g11-chapter-09-heat', 'g11-chapter-10-electric-appliances', 'g11-chapter-11-electronics', 'g11-chapter-13-electromagnetism']
fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)


STUB = """
window.__spoken = [];
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: function (t) { this.text = t; }, configurable: true, writable: true });
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speak: function (u) { window.__spoken.push(u.text); setTimeout(function () { u.onend && u.onend(); }, 700); },
  cancel: function () {}, pause: function () {}, resume: function () {},
  getVoices: function () { return [{ name: 'Test Tamil', lang: 'ta-IN' }, { name: 'Test Tamil 2', lang: 'ta-LK' }, { name: 'Test English', lang: 'en-IN' }]; }, addEventListener: function () {} } });
"""

VISIBLE = "[...document.querySelector('.wrap').children].filter(e => !e.classList.contains('stem-hide')).map(e => e.id || e.className.split(' ')[0])"


def run():
    tmp = tempfile.mkdtemp()
    env = dict(os.environ, DB_PATH=os.path.join(tmp, 't.db'))
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'], cwd=os.path.join(ROOT, 'api'), env=env)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1); break
            except Exception:
                time.sleep(0.3)
        H = {'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'}
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)

            def phone(user, lang='en'):
                ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True)
                ctx.add_init_script(STUB)
                if lang != 'en':
                    ctx.add_init_script("try{localStorage.setItem('lessonLang','%s')}catch(e){}" % lang)
                ctx.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': user, 'password': 'LocalTest-2468'}))
                return ctx

            def open_lesson(ctx, name, hash_=''):
                pg = ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
                pg.goto(BASE + '/lessons/%s.html%s' % (name, hash_), wait_until='domcontentloaded'); pg.wait_for_timeout(1400)
                return pg, errs

            # ------------------------------------------------------------ one step at a time
            ctx = phone('pl1')
            pg, errs = open_lesson(ctx, 'chapter-05-friction')
            check('lesson player is on', pg.evaluate("document.documentElement.classList.contains('stem-player')"))
            check('start screen shows only the start group', pg.evaluate(VISIBLE) == ['hero', 'stem-welcome-banner', 'fw_path'], pg.evaluate(VISIBLE))
            check('the old "Next" bars and floating pill are hidden', pg.evaluate("[...document.querySelectorAll('.fw-next,.fw-pill')].every(e => getComputedStyle(e).display === 'none')"))
            pg.click('.sb-next'); pg.wait_for_timeout(500)
            check('Next opens the story alone', pg.evaluate(VISIBLE) == ['story'] and pg.url.endswith('#story'), (pg.evaluate(VISIBLE), pg.url))
            pg.click('.sb-back'); pg.wait_for_timeout(400)
            check('Back returns to the start', pg.evaluate("StemPlayer.current()") == 0)
            pg.go_back(); pg.wait_for_timeout(300)
            check('browser back button also works', pg.evaluate("StemPlayer.current()") in (0, 1))
            pg.evaluate("StemPlayer.go(5)"); pg.wait_for_timeout(300)
            check('bar says where you are', '5 / 12' in pg.evaluate("document.querySelector('.sb-title').textContent"), pg.evaluate("document.querySelector('.sb-title').textContent"))
            pg.click('.sb-mid'); pg.wait_for_timeout(300)
            check('lesson map lists all steps', pg.locator('.sm-item').count() == 14, pg.locator('.sm-item').count())
            pg.click('.sm-item[data-i="12"]'); pg.wait_for_timeout(300)
            check('map jumps to a step', pg.evaluate("StemPlayer.current()") == 12)
            pg.evaluate("StemPlayer.go(13)"); pg.wait_for_timeout(300)
            check('finish step shows the footer and finish card', 'fw_finish' in pg.evaluate(VISIBLE))
            # deep link
            pg2, _ = open_lesson(ctx, 'chapter-05-friction', '#quiz')
            check('deep link #quiz opens the quiz step', pg2.evaluate(VISIBLE) == ['quiz'], pg2.evaluate(VISIBLE))
            # whole-lesson-on-one-page setting
            pg3 = ctx.new_page(); pg3.add_init_script("try{localStorage.setItem('stem_view','scroll')}catch(e){}")
            pg3.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded'); pg3.wait_for_timeout(900)
            check('"whole lesson on one page" turns the player off', not pg3.evaluate("document.documentElement.classList.contains('stem-player')") and pg3.locator('#stem-bar').count() == 0)
            check('no script errors in the player', not errs, errs[:3])
            ctx.close()

            # ------------------------------------------------------------ every step of every lesson fits the phone
            ctx = phone('pl2')
            for name in LESSONS:
                pg, errs = open_lesson(ctx, name)
                n = pg.evaluate('StemPlayer.count + 2'); bad = []
                for i in range(n):
                    pg.evaluate('StemPlayer.go(%d)' % i); pg.wait_for_timeout(220)
                    w = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
                    if w[0] > w[1] + 1: bad.append((i, w))
                check('%s: all %d steps fit the phone width' % (name, n), not bad and not errs, (bad[:3], errs[:2]))
                pg.close()
            ctx.close()

            # ------------------------------------------------------------ story: swipe, tap, voice
            ctx = phone('pl3')
            pg, _ = open_lesson(ctx, 'chapter-05-friction', '#story')
            dot = "[...document.querySelectorAll('.so-dots i')].findIndex(i => i.classList.contains('now'))"
            check('story starts on the first line', pg.evaluate(dot) == 0, pg.evaluate(dot))
            box = pg.locator('.so-stage').bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2

            def swipe(dx):
                pg.mouse.move(cx - dx / 2, cy); pg.mouse.down(); pg.mouse.move(cx - dx / 4, cy, steps=3); pg.mouse.move(cx + dx / 2, cy, steps=5); pg.mouse.up(); pg.wait_for_timeout(700)
            swipe(-180)
            check('swipe left goes to the next line', pg.evaluate(dot) == 1, pg.evaluate(dot))
            swipe(-180)
            swipe(180)
            check('swipe right goes back a line', pg.evaluate(dot) == 1, pg.evaluate(dot))
            before = pg.evaluate(dot)
            pg.mouse.click(cx, box['y'] + box['height'] * 0.62); pg.wait_for_timeout(2400)       # first tap finishes the typing
            pg.mouse.click(cx, box['y'] + box['height'] * 0.62); pg.wait_for_timeout(500)        # second tap reads on
            check('tapping the speech bubble reads on', pg.evaluate(dot) == before + 1, (before, pg.evaluate(dot)))
            check('the big Next / Back buttons are gone on a touch phone', not pg.is_visible('#so_next') and not pg.is_visible('#so_prev'))
            check('a swipe hint is shown', pg.is_visible('.so-hint'))
            pg.click('.so-voice'); pg.wait_for_timeout(500)
            check('story voice (English) speaks the current line', len(pg.evaluate('window.__spoken')) >= 1, pg.evaluate('window.__spoken'))
            swipe(-180)
            check('story voice speaks the next line too', len(pg.evaluate('window.__spoken')) >= 2)
            lbl = lambda: pg.evaluate("document.querySelector('.so-voice span').textContent")
            check('story voice button says Recorded voices first', lbl() == 'Recorded voices', lbl())
            pg.click('.so-voice'); pg.wait_for_timeout(300)
            check('a second tap switches to the phone voice', lbl() == 'Phone voice', lbl())
            pg.click('.so-voice'); pg.wait_for_timeout(300)
            check('a third tap turns the voices off', lbl() == 'Voices off', lbl())
            ctx.close()

            ctx = phone('pl4', 'ta')
            pg, _ = open_lesson(ctx, 'chapter-05-friction', '#story')
            reqs = []
            pg.on('request', lambda r: reqs.append(r.url) if '/static/audio/story/' in r.url else None)
            pg.click('.so-voice'); pg.wait_for_timeout(1200)
            check('Tamil story voice plays the neural recording', any('/static/audio/story/c5/line' in u for u in reqs), reqs)
            r = ctx.request.get(BASE + '/static/audio/story/c5/line00.mp3')
            check('the recording is served as audio', r.ok and 'audio' in r.headers.get('content-type', ''), (r.status, r.headers.get('content-type')))
            ctx.close()

            # ------------------------------------------------------------ read aloud for any step
            ctx = phone('pl5')
            pg, _ = open_lesson(ctx, 'chapter-05-friction')
            pg.evaluate('StemPlayer.go(3)'); pg.wait_for_timeout(500)
            pg.click('.sb-listen'); pg.wait_for_timeout(900)
            check('listen reads the step aloud', len(pg.evaluate('window.__spoken')) >= 1 and pg.is_visible('#stem-vp'), pg.evaluate('window.__spoken'))
            spoken = pg.evaluate('window.__spoken')
            check('the heading is read first, then the lesson text (no buttons or menus)', spoken[0] == 'Notes' and any(len(x) > 25 for x in spoken) and not any('Next' in x or 'Lv' in x for x in spoken), spoken)
            check('the sentence being read is highlighted', pg.locator('.stem-reading').count() == 1)
            pg.click('#stem-vp [data-a="next"]'); pg.wait_for_timeout(500)
            check('skip moves to the next sentence', len(pg.evaluate('window.__spoken')) >= 2)
            pg.click('#stem-vp [data-a="rate"]'); pg.wait_for_timeout(200)
            check('speed button changes the speed', pg.evaluate("document.querySelector('#stem-vp [data-a=rate]').textContent") != '1×')
            pg.click('#stem-vp [data-a="stop"]'); pg.wait_for_timeout(300)
            check('stop closes the reading controls and clears the highlight', not pg.is_visible('#stem-vp') and pg.locator('.stem-reading').count() == 0)
            pg.click('.sb-listen'); pg.wait_for_timeout(500)
            pg.evaluate('StemPlayer.go(4)'); pg.wait_for_timeout(400)
            check('changing step stops the reading', not pg.is_visible('#stem-vp'))
            symb = pg.evaluate("StemVoice._speakable('A 5 N force moves it 3 m in 2 s: v = 6 m s-1, a = 2 m/s²', 'en')")
            check('units and symbols are spoken as words', 'newtons' in symb and 'metres per second squared' in symb and 'equals' in symb, symb)
            ta = pg.evaluate("StemVoice._speakable('சீசாவ (see-saw) எப்படி 300 N வைக்கறது?', 'ta')")
            check('Tamil speech skips English glosses like (see-saw) and speaks units in Tamil', 'see-saw' not in ta and 'நியூட்டன்' in ta, ta)
            ctx.close()

            # Tamil: natural pace and a choice of voices
            ctx = phone('pl5b', 'ta')
            pg, _ = open_lesson(ctx, 'chapter-05-friction')
            pg.evaluate('StemPlayer.go(3)'); pg.wait_for_timeout(500)
            pg.click('.sb-listen'); pg.wait_for_timeout(600)
            check('Tamil reading starts at a brisk 1.1x, not slowed down', pg.evaluate("document.querySelector('#stem-vp [data-a=rate]').textContent") == '1.1×')
            pg.click('#stem-vp [data-a="voice"]'); pg.wait_for_timeout(400)
            saved = pg.evaluate("localStorage.getItem('stem_voice_ta')")
            check('the voice button switches to another installed Tamil voice and remembers it', saved in ('Test Tamil', 'Test Tamil 2') and pg.locator('.stem-toast').count() >= 1, saved)
            pg.click('#stem-vp [data-a="voice"]'); pg.wait_for_timeout(300)
            check('pressing it again cycles to the next voice', pg.evaluate("localStorage.getItem('stem_voice_ta')") != saved)
            ctx.close()

            # ------------------------------------------------------------ textbook questions
            ctx = phone('pl6')
            pg, _ = open_lesson(ctx, 'unit-02-motion-in-a-straight-line', '#exercises')
            check('multi-part exercise questions are split into aligned parts', pg.locator('#exercises .qpart').count() >= 4, pg.locator('#exercises .qpart').count())
            lefts = pg.evaluate("[...document.querySelectorAll('#exercises .exq')].slice(0, 8).map(e => Math.round((e.querySelector('.qlead,.qpart,span:not(.exnum)') || e).getBoundingClientRect().left))")
            check('question text starts at the same left edge', len(set(lefts)) == 1, lefts)
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('practice') + 1)"); pg.wait_for_timeout(700)
            check('worked-example parts are split', pg.locator('#practice .qtext .qpart').count() >= 2, pg.locator('#practice .qtext .qpart').count())
            pg.locator('#practice .qdiagram').first.scroll_into_view_if_needed(); pg.locator('#practice .qdiagram').first.click(position={'x': 30, 'y': 30}); pg.wait_for_timeout(400)
            check('tapping a diagram opens it full screen', pg.is_visible('.stem-lightbox svg'))
            check('the enlarged diagram is wide enough to read', pg.evaluate("document.querySelector('.stem-lightbox svg').getBoundingClientRect().width") >= 600)
            pg.click('.stem-lightbox .lb-bar button'); pg.wait_for_timeout(300)
            check('the diagram closes again', pg.locator('.stem-lightbox').count() == 0)
            # language switch keeps the parts
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('exercises') + 1)"); pg.wait_for_timeout(300)
            pg.evaluate("document.getElementById('langToggle').click()"); pg.wait_for_timeout(900)
            check('parts are re-formatted after switching to Tamil', pg.locator('#exercises .qpart').count() >= 4, pg.locator('#exercises .qpart').count())
            ctx.close()

            # ------------------------------------------------------------ the lab cartoon stays pinned and clear of the missions
            ctx = phone('pl7')
            pg, _ = open_lesson(ctx, 'unit-02-motion-in-a-straight-line', '#lab')
            g = pg.evaluate("(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return [r('#ls_svg').bottom, r('#ls_miss').top]; })()")
            check('lab missions do not sit under the cartoon', g[1] >= g[0] - 1, g)
            pg.evaluate('window.scrollTo(0, 320)'); pg.wait_for_timeout(500)
            top = pg.evaluate("document.getElementById('ls_svg').getBoundingClientRect().top")
            check('lab cartoon stays pinned while scrolling the sliders', 90 <= top <= 130, top)
            ctx.close()
            browser.close()
    finally:
        srv.terminate()
        try:
            srv.wait(8)
        except Exception:
            srv.kill()


if __name__ == '__main__':
    run()
    print('\n%s' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails)))
    sys.exit(1 if fails else 0)
