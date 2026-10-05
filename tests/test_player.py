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
                ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
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
            check('start screen shows only the start group', pg.evaluate(VISIBLE) == ['hero', 'fw_path'], pg.evaluate(VISIBLE))
            check('the old "Next" bars and floating pill are hidden', pg.evaluate("[...document.querySelectorAll('.fw-next,.fw-pill')].every(e => getComputedStyle(e).display === 'none')"))
            pg.click('.sb-next'); pg.wait_for_timeout(500)
            check('Next opens the story alone', pg.evaluate(VISIBLE) == ['story'] and pg.url.endswith('#story'), (pg.evaluate(VISIBLE), pg.url))
            pg.click('.sb-back'); pg.wait_for_timeout(400)
            check('Back returns to the start', pg.evaluate("StemPlayer.current()") == 0)
            pg.go_back(); pg.wait_for_timeout(300)
            check('browser back button also works', pg.evaluate("StemPlayer.current()") in (0, 1))
            pg.evaluate("StemPlayer.go(5)"); pg.wait_for_timeout(300)
            check('bar says where you are', '5 / 13' in pg.evaluate("document.querySelector('.sb-title').textContent"), pg.evaluate("document.querySelector('.sb-title').textContent"))
            pg.click('.sb-mid'); pg.wait_for_timeout(300)
            check('lesson map lists all steps', pg.locator('.sm-item').count() == 15, pg.locator('.sm-item').count())
            pg.click('.sm-item[data-i="12"]'); pg.wait_for_timeout(300)
            check('map jumps to a step', pg.evaluate("StemPlayer.current()") == 12)
            pg.evaluate("StemPlayer.go(14)"); pg.wait_for_timeout(300)
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
                check('%s: has the "start from zero" step with 4+ picture cards' % name, 'basics' in pg.evaluate('StemPlayer.stepIds') and pg.evaluate("document.querySelectorAll('#basics .bs-card').length") >= 4, pg.evaluate('StemPlayer.stepIds'))
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
            check('the swipe hint is a picture, not words', pg.evaluate("document.querySelector('.so-hint-t').getBoundingClientRect().width") <= 2)
            pg.click('.so-voice'); pg.wait_for_timeout(500)
            check('story voice (English) speaks the current line', len(pg.evaluate('window.__spoken')) >= 1, pg.evaluate('window.__spoken'))
            swipe(-180)
            check('story voice speaks the next line too', len(pg.evaluate('window.__spoken')) >= 2)
            lbl = lambda: pg.evaluate("document.querySelector('.so-voice').getAttribute('aria-label')")
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
            pg.evaluate('StemPlayer.go(StemPlayer.stepIds.indexOf("notes") + 1)'); pg.wait_for_timeout(500)
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
            pg.evaluate('StemPlayer.go(StemPlayer.stepIds.indexOf("quiz") + 1)'); pg.wait_for_timeout(400)
            check('changing step stops the reading', not pg.is_visible('#stem-vp'))
            symb = pg.evaluate("StemVoice._speakable('A 5 N force moves it 3 m in 2 s: v = 6 m s-1, a = 2 m/s²', 'en')")
            check('units and symbols are spoken as words', 'newtons' in symb and 'metres per second squared' in symb and 'equals' in symb, symb)
            ta = pg.evaluate("StemVoice._speakable('சீசாவ (see-saw) எப்படி 300 N வைக்கறது?', 'ta')")
            check('Tamil speech skips English glosses like (see-saw) and speaks units in Tamil', 'see-saw' not in ta and 'நியூட்டன்' in ta, ta)
            ctx.close()

            # Tamil: natural pace and a choice of voices
            ctx = phone('pl5b', 'ta')
            pg, _ = open_lesson(ctx, 'chapter-05-friction')
            pg.evaluate('StemPlayer.go(StemPlayer.stepIds.indexOf("notes") + 1)'); pg.wait_for_timeout(500)
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
            state = ctx.storage_state()          # signups are rate-limited (8 an hour): later contexts reuse this login
            pg, _ = open_lesson(ctx, 'unit-02-motion-in-a-straight-line', '#lab')
            g = pg.evaluate("(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return [r('#ls_svg').bottom, r('.stem-fold-miss').top]; })()")
            check('lab missions do not sit under the cartoon', g[1] >= g[0] - 1, g)
            pg.evaluate('window.scrollTo(0, 320)'); pg.wait_for_timeout(500)
            top = pg.evaluate("document.getElementById('ls_svg').getBoundingClientRect().top")
            check('lab cartoon stays pinned just under the header (the XP strip is hidden mid-lesson)', 55 <= top <= 85, top)
            ctx.close()

            # ------------------------------------------------------------ design-critique fixes
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(STUB)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            vis = "(() => { const e = document.querySelector('.xpbar'); return !!e && getComputedStyle(e).display !== 'none'; })()"
            check('XP strip shows on the Start step', pg.evaluate(vis))
            pg.click('.sb-next'); pg.wait_for_timeout(500)
            check('XP strip is hidden on a middle step', not pg.evaluate(vis))
            check('no text welcome banner any more', pg.locator('.stem-welcome-banner').count() == 0)
            letters = "(e => /\\p{L}/u.test(e.textContent))"
            check('the Next button is an icon, not a word', not pg.evaluate("(" + letters + ")(document.querySelector('.sb-next'))"))
            check('the bar shows an icon and "n / N", the step name stays hidden', pg.evaluate("getComputedStyle(document.querySelector('.sb-w')).display") == 'none')
            check('the Next button still has a spoken name', len(pg.get_attribute('.sb-next', 'aria-label') or '') > 3, pg.get_attribute('.sb-next', 'aria-label'))
            pg.click('.sb-mid'); pg.wait_for_timeout(300)
            check('the lesson map carries level, XP, streak and badges', pg.locator('.sm-stats').count() == 1 and '⭐' in pg.inner_text('.sm-stats') and '🔥' in pg.inner_text('.sm-stats'), pg.inner_text('.sm-sheet')[:80])
            pg.keyboard.press('Escape')
            check('the language button names its target', 'Tamil' in (pg.get_attribute('#langToggle', 'aria-label') or ''), pg.get_attribute('#langToggle', 'aria-label'))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('watch') + 1)"); pg.wait_for_timeout(700)
            ctl = pg.evaluate("['fw_play','fw_rep','fw_slow','fw_snd'].map(id => { const b = document.getElementById(id); return [b.textContent.trim(), /\\p{L}/u.test(b.textContent), (b.getAttribute('aria-label') || '').length > 2]; })")
            check('animation controls are icons with spoken names', all((not c[1]) and c[2] for c in ctl), ctl)
            pg.click('#fw_snd'); pg.wait_for_timeout(300)
            check('the sound button shows its state as an icon', pg.get_attribute('#fw_snd', 'aria-pressed') == 'true' and pg.evaluate("document.getElementById('fw_snd').textContent.trim()") == '🔊', pg.evaluate("document.getElementById('fw_snd').textContent"))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('lab') + 1)"); pg.wait_for_timeout(600)
            r = pg.evaluate("(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return {svg: r('#ls_svg').bottom, slider: r('.lab-controls').top, miss: r('.stem-fold-miss').top, lab: r('#labSvg').top, guide: r('.stem-fold-guide').top, gopen: document.querySelector('.stem-fold-guide').open, label: document.querySelector('.stem-fold-miss summary').innerText}; })()")
            check('sliders sit directly under the cartoon', r['slider'] >= r['svg'] - 1 and r['slider'] < r['miss'], r)
            check('missions are folded with a count', 'Missions' in r['label'] and '0 / ' in r['label'], r)
            check('the how-to guide is last and closed on a phone', r['guide'] > r['lab'] and not r['gopen'], r)
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(500)
            f = pg.evaluate("(() => { const f = document.querySelector('#notes .fig'); const s = f.querySelector('svg'); return {w: s.getBoundingClientRect().width, zoom: f.classList.contains('zoomable')}; })()")
            check('figures keep a readable width on a phone', f['w'] >= 440 and f['zoom'], f)
            pg.locator('#notes .fig').first.scroll_into_view_if_needed(); pg.locator('#notes .fig').first.click(position={'x': 20, 'y': 20}); pg.wait_for_timeout(400)
            check('tapping a figure opens it full screen', pg.is_visible('.stem-lightbox svg'))
            pg.click('.stem-lightbox .lb-bar button'); pg.wait_for_timeout(200)
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('practice') + 1)"); pg.wait_for_timeout(500)
            b = pg.evaluate("(() => { const e = document.querySelector('#practice .ex-toggle'); const c = getComputedStyle(e); return {w: c.borderTopWidth, bg: c.backgroundColor}; })()")
            check('"Show answer" looks like a button', b['w'] not in ('0px', '1px'), b)
            ctx.close()

            # first visit: the picture coach shows once, one big tick closes it for good
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power'); pg.wait_for_timeout(500)
            check('first visit: the picture coach opens', pg.locator('.stem-coach .co-tile').count() == 6, pg.locator('.stem-coach .co-tile').count())
            pg.click('.co-ok'); pg.wait_for_timeout(300)
            check('the big tick closes the coach', pg.locator('.stem-coach').count() == 0)
            pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(1400)
            check('the coach does not come back', pg.locator('.stem-coach').count() == 0)
            pg.click('.sb-mid'); pg.wait_for_timeout(300); pg.click('.sm-help'); pg.wait_for_timeout(300)
            check('the ? button in the lesson map shows it again', pg.locator('.stem-coach').count() == 1)
            pg.click('.co-ok'); pg.wait_for_timeout(200)
            # Tamil text in the start-from-zero step
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('basics') + 1)"); pg.wait_for_timeout(300)
            pg.evaluate("document.getElementById('langToggle').click()"); pg.wait_for_timeout(900)
            check('the start-from-zero step switches to Tamil', pg.evaluate("/[\\u0B80-\\u0BFF]/.test(document.querySelector('#basics .bs-card h3').textContent)"))
            pg.evaluate("document.getElementById('langToggle').click()"); pg.wait_for_timeout(900)      # back to English: the language is saved to the account
            ctx.close()

            ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            d = pg.evaluate("[getComputedStyle(document.querySelector('.navlinks')).display, getComputedStyle(document.querySelector('.stem-menu-btn')).display]")
            check('desktop: one navigation (menu button), no second link strip', d[0] == 'none' and d[1] != 'none', d)
            ctx.close()

            # hub: grade chips, grade on every card, continue card
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_last_lesson','g11-chapter-04-waves.html')}catch(e){}")
            pg, errs = open_lesson(ctx, 'index')
            check('hub has four grade chips', pg.locator('.gchip').count() == 4)
            labels = pg.evaluate("[...document.querySelectorAll('.lesson-card .lnum')].map(e => e.textContent)")
            check('every card names its grade and chapter, no duplicates', len(labels) == 15 and len(set(labels)) == 15 and all('Ch' in x for x in labels), labels)
            check('the continue card resumes the last lesson', 'Continue' in pg.inner_text('#nextTxt') and 'Waves' in pg.inner_text('#nextTxt'), pg.inner_text('#nextTxt'))
            pg.click('.gchip[data-g="g10"]'); pg.wait_for_timeout(300)
            shown = pg.evaluate("[...document.querySelectorAll('.lesson-card')].filter(e => e.offsetParent !== null).length")
            check('the Grade 10 chip shows only Grade 10 lessons', shown == 3, shown)
            pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(600)
            check('the chosen grade is remembered', pg.get_attribute('.gchip[data-g="g10"]', 'aria-pressed') == 'true')
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
