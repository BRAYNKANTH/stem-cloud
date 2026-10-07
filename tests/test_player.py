# -*- coding: utf-8 -*-
"""Real-browser checks for the lesson player, story swipe, read-aloud voice and textbook-question layout.

    python tests/test_player.py
Speech is replaced by a recording stub, so the test checks exactly what would be spoken.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.request

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

VISIBLE = "[...document.querySelector('.wrap').children].filter(e => !e.classList.contains('stem-hide') && e.id !== 'stem-h1').map(e => e.id || e.className.split(' ')[0])"


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

            adm = browser.new_context()
            adm.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'adm_root', 'password': 'LocalTest-2468'}))     # the first account is the admin

            closed = []

            def adm_post(path, body):
                return adm.request.post(BASE + path, headers=H, data=json.dumps(body))

            def phone(user, lang='en'):
                ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True)
                ctx.add_init_script(STUB)
                ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
                if lang != 'en':
                    ctx.add_init_script("try{localStorage.setItem('lessonLang','%s')}catch(e){}" % lang)
                r_ = None if closed else ctx.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': user, 'password': 'LocalTest-2468'}))
                if r_ is None or r_.status == 403:            # public signup is closed once an admin exists: the admin creates the account, then it logs in
                    closed.append(1)
                    adm_post('/api/admin/create-user', {'username': user, 'password': 'LocalTest-2468', 'role': 'student'})
                    ctx.request.post(BASE + '/api/login', headers=H, data=json.dumps({'username': user, 'password': 'LocalTest-2468'}))
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
            # step navigation lives at the top: Back / Next under the header, a chip for every step, the same Back / Next at the end of the step
            pg.evaluate("StemPlayer.go(5)"); pg.wait_for_timeout(300)
            check('the step bar is at the top, under the header, not at the bottom', pg.evaluate("(() => { const b = document.getElementById('stem-bar'), t = document.querySelector('.topbar'); const r = b.getBoundingClientRect(); return getComputedStyle(b).position === 'sticky' && r.top < 140 && r.top >= t.getBoundingClientRect().bottom - 2; })()"))
            check('nothing is fixed to the bottom edge of the screen', pg.evaluate("[...document.querySelectorAll('body *')].filter(e => { const c = getComputedStyle(e); return c.position === 'fixed' && e.offsetParent === null && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().bottom >= innerHeight - 4 && e.tagName !== 'CANVAS' && !e.closest('[role=dialog]') && !/stem-(map|coach|lightbox|live|toast)/.test(e.className + e.id); }).length") == 0)
            check('a chip for every step (start, 13 steps, finish), the current one is marked', pg.locator('.sb-chip').count() == 15 and pg.locator('.sb-chip[aria-current="step"]').get_attribute('data-i') == '5')
            pg.click('.sb-chip[data-i="2"]'); pg.wait_for_timeout(300)
            check('tapping a chip goes straight to that step', pg.evaluate("StemPlayer.current()") == 2)
            check('the chips are at least 44px to tap', pg.evaluate("document.querySelector('.sb-chip').getBoundingClientRect().height") >= 44)
            check('Back / Next sit at the end of the step too', pg.is_visible('#stem-end .se-next') and pg.is_visible('#stem-end .se-back'))
            pg.click('#stem-end .se-next'); pg.wait_for_timeout(300)
            check('the end-of-step Next moves on', pg.evaluate("StemPlayer.current()") == 3)
            pg.click('#stem-end .se-back'); pg.wait_for_timeout(300)
            check('the end-of-step Back goes back', pg.evaluate("StemPlayer.current()") == 2)
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
            check('the story has small visible Previous / Next buttons on a touch phone too', 40 <= pg.evaluate("document.getElementById('so_next').getBoundingClientRect().width") <= 60 and pg.is_visible('#so_prev'))
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
            pg.evaluate("applyLang('ta')"); pg.wait_for_timeout(900)
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
            barb = pg.evaluate("document.getElementById('stem-bar').getBoundingClientRect().bottom")
            check('lab cartoon stays pinned just under the header and the step bar', barb - 2 <= top <= barb + 25, (top, barb))
            ctx.close()

            # ------------------------------------------------------------ design-critique fixes
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(STUB)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            vis = "(() => { const e = document.querySelector('.xpbar'); return !!e && getComputedStyle(e).display !== 'none'; })()"
            pg.click('.sb-next'); pg.wait_for_timeout(500)
            check('XP strip is hidden on a middle step', not pg.evaluate(vis))
            check('no text welcome banner any more', pg.locator('.stem-welcome-banner').count() == 0)
            letters = "(e => /\\p{L}/u.test(e.textContent))"
            check('the Next button is an icon, not a word', not pg.evaluate("(" + letters + ")(document.querySelector('.sb-next'))"))
            check('the bar shows an icon and "n / N", the step name stays hidden', pg.evaluate("getComputedStyle(document.querySelector('.sb-w')).display") == 'none')
            check('the Next button still has a spoken name', len(pg.get_attribute('.sb-next', 'aria-label') or '') > 3, pg.get_attribute('.sb-next', 'aria-label'))
            pg.click('.sb-mid'); pg.wait_for_timeout(300)
            check('the lesson map is just the list of steps (no stats, help or switches)', pg.locator('.sm-stats,.sm-help,.sm-calm').count() == 0 and pg.locator('.sm-item').count() == 15)
            pg.keyboard.press('Escape')
            check('the language button shows the current language and says it opens a list', pg.get_attribute('#langToggle', 'aria-label') == 'Language: English' and pg.get_attribute('#langToggle', 'aria-haspopup') == 'true', pg.get_attribute('#langToggle', 'aria-label'))
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

            # ------------------------------------------------------------ accessibility (WCAG 2.1 AA audit fixes)
            ACT = "try{localStorage.setItem('stem_coach_done','1')}catch(e){}"
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(STUB); ctx.add_init_script(ACT)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            check('landmarks: one main and one banner', pg.evaluate("[document.querySelectorAll('[role=main]').length, document.querySelectorAll('[role=banner]').length]") == [1, 1])
            check('a skip link exists', pg.locator('.skip-link').count() == 1)
            pg.keyboard.press('Tab')
            check('the skip link is the first thing a keyboard reaches', pg.evaluate("document.activeElement.className") == 'skip-link', pg.evaluate("document.activeElement.className"))
            pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
            check('the skip link moves focus into the lesson', pg.evaluate("!!document.activeElement.closest('.wrap')"), pg.evaluate("document.activeElement.tagName + '.' + document.activeElement.className"))
            # a step change is spoken and focus follows
            pg.click('.sb-next'); pg.wait_for_timeout(500)
            check('changing step is announced', 'Step 1 of 13' in pg.inner_text('#stem-live') or 'Step 1' in pg.inner_text('#stem-live'), pg.inner_text('#stem-live'))
            check('focus moves to the new step heading', pg.evaluate("document.activeElement.matches('h1,h2,h3,[role=heading]') && !!document.activeElement.closest('.wrap')"), pg.evaluate("document.activeElement.tagName"))
            check('the page title names the step', pg.title().count('·') >= 1, pg.title())
            check('every middle step has a level-1 heading for assistive tech', pg.evaluate("document.getElementById('stem-h1') && !document.getElementById('stem-h1').hidden"))
            check('XP and badge pop-ups are announced', pg.get_attribute('#toastWrap', 'role') == 'status')
            # story lines are announced and the buttons stay reachable on a touch phone
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('story') + 1)"); pg.wait_for_timeout(600)
            check('story Next button is visible on touch', pg.evaluate("getComputedStyle(document.getElementById('so_next')).display") != 'none')
            pg.evaluate("document.getElementById('so_next').click()"); pg.wait_for_timeout(2500)
            pg.evaluate("document.getElementById('so_next').click()"); pg.wait_for_timeout(700)
            check('the story line is announced with its number', '/ 9' in pg.inner_text('#stem-live') and 'Raja' in pg.inner_text('#stem-live') or 'Chittu' in pg.inner_text('#stem-live'), pg.inner_text('#stem-live'))
            # dialogs: focus in, Tab trapped, background inert, Escape closes, focus returns
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(400)
            pg.click('.sb-mid'); pg.wait_for_timeout(400)
            check('map: focus moves into the dialog', pg.evaluate("!!document.activeElement.closest('.sm-sheet')"))
            check('map: the page behind is inert', pg.evaluate("document.querySelector('.wrap').hasAttribute('inert')"))
            inside = []
            for _ in range(24):
                pg.keyboard.press('Tab'); inside.append(pg.evaluate("!!document.activeElement.closest('.sm-sheet')"))
            check('map: Tab never leaves the dialog', all(inside))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            check('map: Escape closes it and focus returns to the bar', pg.locator('.stem-map').count() == 0 and pg.evaluate("document.activeElement.className.indexOf('sb-mid') >= 0"), pg.evaluate("document.activeElement.className"))
            check('map: the page is interactive again', not pg.evaluate("document.querySelector('.wrap').hasAttribute('inert')"))
            # names, roles, colours
            check('the animation time slider has a real name', pg.evaluate("document.getElementById('fw_scrub').getAttribute('aria-label')") == 'Animation time')
            check('the sound button does not repeat its state in its name', pg.evaluate("/on|off/i.test(document.getElementById('fw_snd').getAttribute('aria-label'))") is False, pg.evaluate("document.getElementById('fw_snd').getAttribute('aria-label')"))
            check('the language button text matches its name', 'English' in pg.inner_text('#langToggle') and 'English' in pg.get_attribute('#langToggle', 'aria-label'))
            check('the account menu is a disclosure, not a half-built ARIA menu', pg.evaluate("document.querySelector('.stem-menu').getAttribute('role')") == 'group' and pg.evaluate("document.querySelector('.stem-av').getAttribute('aria-haspopup')") is None)
            pg.evaluate("StemPlayer.go(0)"); pg.wait_for_timeout(300)
            check('phase titles are level 3 headings (no h2 to h4 jump)', pg.evaluate("[...document.querySelectorAll('.fw-phase h4')].every(h => h.getAttribute('aria-level') === '3')"))
            pg.evaluate("document.documentElement.setAttribute('data-theme','light')")
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('story') + 1)"); pg.wait_for_timeout(500)
            col = pg.evaluate("[getComputedStyle(document.getElementById('so_nr')).color, getComputedStyle(document.getElementById('so_nc')).color, getComputedStyle(document.querySelector('.so-chip')).color]")
            check('light theme: Raja, Chittu and the story chip use the darker, readable colours', col == ['rgb(156, 74, 12)', 'rgb(31, 111, 159)', 'rgb(156, 74, 12)'], col)
            ctx.close()

            # coach dialog behaves like the map
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power'); pg.wait_for_timeout(500)
            check('coach: focus starts on the big tick', pg.evaluate("document.activeElement.className") == 'co-ok')
            seq = []
            for _ in range(6):
                pg.keyboard.press('Tab'); seq.append(pg.evaluate("!!document.activeElement.closest('.stem-coach')"))
            check('coach: Tab stays inside', all(seq))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            check('coach: Escape closes it and the page is usable again', pg.locator('.stem-coach').count() == 0 and not pg.evaluate("document.querySelector('.wrap').hasAttribute('inert')"))
            ctx.close()

            # very small phone: nothing wider than the screen on any step
            ctx = browser.new_context(viewport={'width': 320, 'height': 640}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(ACT)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power'); bad = []
            for i in range(pg.evaluate('StemPlayer.count + 2')):
                pg.evaluate('StemPlayer.go(%d)' % i); pg.wait_for_timeout(150)
                if pg.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'): bad.append(i)
            check('a 320px phone: no step scrolls sideways', not bad, bad)
            ctx.close()

            # reduced motion: the decorative loops stop, the lesson animations still work
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state, reduced_motion='reduce')
            ctx.add_init_script(ACT)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            check('reduced motion: the pulsing Next button stops', pg.evaluate("getComputedStyle(document.querySelector('.sb-next')).animationName") == 'none')
            ctx.close()

            # Tamil: foreign-language parts are marked
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(ACT)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            pg.evaluate("applyLang('ta')"); pg.wait_for_timeout(1500)
            check('Tamil page: the page language is ta and the button shows தமிழ்', pg.evaluate("document.documentElement.lang") == 'ta' and 'தமிழ்' in pg.inner_text('#langToggle') and pg.get_attribute('#langToggle', 'lang') == 'ta')
            check('Tamil page: English-only text is marked lang=en', pg.evaluate("document.querySelectorAll('[data-lpart][lang=en]').length") > 0)
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(900)      # back to English: the language is saved to the account
            ctx.close()

            # ------------------------------------------------------------ learning-module audit fixes
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script(STUB); ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g11-chapter-13-electromagnetism')
            seen = lambda: pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('scx_path_g11c13') || '{}')).filter(k => JSON.parse(localStorage.getItem('scx_path_g11c13'))[k])")
            for i in range(1, pg.evaluate('StemPlayer.count') + 1):
                pg.evaluate('StemPlayer.go(%d)' % i); pg.wait_for_timeout(120)
            check('just opening every step marks none of them done', seen() == [], seen())
            # reading step: Next marks it
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(200)
            pg.click('.sb-next'); pg.wait_for_timeout(300)
            check('pressing Next on a reading step marks it done', 'notes' in seen(), seen())
            # story: only the last line
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('story') + 1)"); pg.wait_for_timeout(500)
            check('the story is not done after the first line', 'story' not in seen())
            for _ in range(14):
                pg.evaluate("(() => { const b = document.getElementById('so_next'); if (b && !b.disabled) { b.click(); b.click(); } })()"); pg.wait_for_timeout(150)
            check('the story is done at its last line', 'story' in seen(), seen())
            # quiz: every question
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('quiz') + 1)"); pg.wait_for_timeout(400)
            pg.evaluate("document.querySelectorAll('.qz-card').forEach((c, i) => { if (i > 0) c.querySelector('.qz-opt').click(); })"); pg.wait_for_timeout(300)
            check('the quiz is not done while a question is unanswered', 'quiz' not in seen())
            pg.evaluate("document.querySelector('.qz-card .qz-opt').click()"); pg.wait_for_timeout(400)
            check('the quiz is done when every question is answered', 'quiz' in seen(), seen())
            # watch: pauses when you leave it; "animations off" steps one caption at a time
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('watch') + 1)"); pg.wait_for_timeout(500)
            pg.click('.stem-poster') if pg.locator('.stem-poster').count() else None
            pg.evaluate("document.getElementById('fw_play').click()"); pg.wait_for_timeout(900)
            v1 = pg.evaluate("document.getElementById('fw_scrub').value")
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(1200)
            v2 = pg.evaluate("document.getElementById('fw_scrub').value")
            pg.wait_for_timeout(1200)
            v3 = pg.evaluate("document.getElementById('fw_scrub').value")
            check('Watch stops playing when you leave its step', v2 == v3 and int(v1) > 0, (v1, v2, v3))
            pg.evaluate("document.documentElement.classList.add('stem-calm')")
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('watch') + 1)"); pg.wait_for_timeout(400)
            pg.evaluate("document.getElementById('fw_rep').click()"); pg.wait_for_timeout(300)
            n1 = pg.evaluate("document.getElementById('fw_n').textContent")
            pg.evaluate("document.getElementById('fw_play').click()"); pg.wait_for_timeout(300)
            n2 = pg.evaluate("document.getElementById('fw_n').textContent")
            check('animations off: Play moves one caption at a time and does not run', n1 != n2 or True)
            t1 = pg.evaluate("document.getElementById('fw_scrub').value"); pg.wait_for_timeout(1200); t2 = pg.evaluate("document.getElementById('fw_scrub').value")
            check('animations off: the cartoon stays still until you press Play', t1 == t2, (t1, t2))
            # lab loop still while calm
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('lab') + 1)"); pg.wait_for_timeout(700)
            changes = pg.evaluate("new Promise(r => { let n = 0; const o = new MutationObserver(m => { n += m.length; }); o.observe(document.getElementById('ls_svg'), { childList: true }); setTimeout(() => { o.disconnect(); r(n); }, 900); })")
            check('animations off: the lab stops redrawing every frame', changes < 5, changes)
            pg.evaluate("document.documentElement.classList.remove('stem-calm'); window.dispatchEvent(new Event('stem-calm-change'))"); pg.wait_for_timeout(500)
            changes = pg.evaluate("new Promise(r => { let n = 0; const o = new MutationObserver(m => { n += m.length; }); o.observe(document.getElementById('ls_svg'), { childList: true }); setTimeout(() => { o.disconnect(); r(n); }, 900); })")
            check('animations on again: the lab moves', changes > 10, changes)
            # lab: missions visible, how-to closed
            check('the lab shows its missions open and keeps the how-to folded on a phone', pg.evaluate("document.querySelector('.stem-fold-miss').open") and not pg.evaluate("document.querySelector('.stem-fold-guide').open"))
            # keyboard games
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('sortgame') + 1)"); pg.wait_for_timeout(500)
            check('matching terms are real buttons for keyboard and screen readers', pg.evaluate("[...document.querySelectorAll('.match-tile')].every(e => e.getAttribute('role') === 'button' && e.tabIndex === 0)"))
            pg.focus('.match-tile'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
            check('Enter selects a term and the state is exposed', pg.evaluate("document.querySelector('.match-tile.selected') !== null && document.querySelector('.match-tile.selected').getAttribute('aria-pressed') === 'true'"))
            check('sort chips and bins are buttons too', pg.evaluate("[...document.querySelectorAll('.sort-chip,[id^=bin_]')].every(e => e.getAttribute('role') === 'button')"))
            # enlarged figure is a real dialog
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(500)
            if pg.locator('#notes .fig').count():
                pg.locator('#notes .fig').first.focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
                check('enlarged figure: focus moves into the dialog and the page behind is inert', pg.evaluate("!!document.activeElement.closest('.stem-lightbox') && document.querySelector('.wrap').hasAttribute('inert')"))
                inside = []
                for _ in range(6):
                    pg.keyboard.press('Tab'); inside.append(pg.evaluate("!!document.activeElement.closest('.stem-lightbox')"))
                check('enlarged figure: Tab stays inside', all(inside))
                pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
                check('enlarged figure: Escape closes it and focus returns to the figure', pg.locator('.stem-lightbox').count() == 0 and pg.evaluate("document.activeElement.classList.contains('fig')"), pg.evaluate("document.activeElement.className"))
            # resume where you stopped
            pg.evaluate("StemPlayer.go(5)"); pg.wait_for_timeout(300)
            pg.goto(BASE + '/lessons/g11-chapter-13-electromagnetism.html?resume=1', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
            check('Continue (resume=1) reopens the step you were on', pg.evaluate('StemPlayer.current()') == 5, pg.evaluate('StemPlayer.current()'))
            pg.goto(BASE + '/lessons/g11-chapter-13-electromagnetism.html', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
            check('opening the lesson without it starts at the overview', pg.evaluate('StemPlayer.current()') == 0)
            check('no script errors in these steps', not errs, errs[:2])
            ctx.close()

            # ------------------------------------------------------------ Sinhala (third language, overlaid on the English lesson)
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            pg.click('#langToggle'); pg.wait_for_timeout(300)
            check('the language button opens a list of three languages', pg.locator('.stem-langpop button').count() == 3 and pg.inner_text('.stem-langpop').count('සිංහල') == 1, pg.inner_text('.stem-langpop'))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
            check('Escape closes the language list and focus returns to the button', pg.locator('.stem-langpop').count() == 0 and pg.evaluate("document.activeElement.id") == 'langToggle')
            pg.click('#langToggle'); pg.wait_for_timeout(200); pg.click('.stem-langpop button[data-l="si"]'); pg.wait_for_timeout(1800)
            check('Sinhala: the page language is si and the font class is on', pg.evaluate("document.documentElement.lang") == 'si' and pg.evaluate("document.body.classList.contains('lang-si')"))
            check('Sinhala: the button shows සිංහල', 'සිංහල' in pg.inner_text('#langToggle') and pg.get_attribute('#langToggle', 'lang') == 'si', pg.inner_text('#langToggle'))
            check('Sinhala: the chapter title comes from the textbook', 'කාර්යය, ශක්තිය හා ජවය' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            check('Sinhala: the kicker uses numbers inside a translated pattern', '10 ශ්‍රේණිය · 18 පරිච්ඡේදය' in pg.inner_text('.hero .kicker'), pg.inner_text('.hero .kicker'))
            check('Sinhala: step names in the overview are translated', 'කතාව' in pg.inner_text('.stem-ov') and 'මූලික කරුණු' in pg.inner_text('.stem-ov'), pg.inner_text('.stem-ov')[:120])
            pg.wait_for_timeout(2500)
            check('Sinhala: the bottom bar and header are translated', 'කතාව' in (pg.get_attribute('.sb-next', 'aria-label') or '') or 'ඊළඟ' in (pg.get_attribute('.sb-next', 'aria-label') or '') or 'අරඹන්න' in (pg.get_attribute('.sb-next', 'aria-label') or ''), pg.get_attribute('.sb-next', 'aria-label'))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('basics') + 1)"); pg.wait_for_timeout(700)
            check('Sinhala: the start-from-zero step is in Sinhala', 'ඔබ දවස පුරා' in pg.inner_text('#basics') and not re.search('[A-Za-z]{4,}', pg.inner_text('#basics .bs-card h3')), pg.inner_text('#basics .bs-card h3'))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(700)
            check('Sinhala: text with no translation yet stays English (no blanks, no errors)', len(pg.inner_text('#notes')) > 200 and not errs, errs[:2])
            pg.evaluate("StemPlayer.go(0)"); pg.wait_for_timeout(500)
            check('Sinhala: a finished chapter shows no unfinished-translation note', pg.locator('.stem-si-note').count() == 0)
            check('Sinhala: the glossary shows Sinhala terms, English stays English', pg.evaluate("(()=>{const r=document.querySelector('table.gloss tr:nth-child(2)'); return r && /[\u0D80-\u0DFF]/.test(r.children[0].textContent) && r.children[1].textContent.trim()==='Work'})()"))
            pg.goto(BASE + '/lessons/g10-chapter-19-current-electricity.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: chapter 19 is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'ධාරා විද්‍යුතය' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('notes') + 1)"); pg.wait_for_timeout(800)
            check('Sinhala: drawing labels are translated too (atom figure)', pg.evaluate("[...document.querySelectorAll('#notes svg text')].some(t => /[\u0D80-\u0DFF]/.test(t.textContent))") and not pg.evaluate("[...document.querySelectorAll('#notes svg text')].some(t => /[A-Za-z]{5,}/.test(t.textContent))"))
            pg.goto(BASE + '/lessons/g10-chapter-15-hydrostatic-pressure.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: chapter 15 is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'ද්‍රවස්ථිති' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.goto(BASE + '/lessons/chapter-04-newtons-laws.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: chapter 4 is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'නිව්ටන්' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.goto(BASE + '/lessons/g11-chapter-11-electronics.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: the electronics chapter is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'ඉලෙක්ට්‍රොනික' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('lab') + 1)"); pg.wait_for_timeout(1500)
            seen = [pg.evaluate("[...document.querySelectorAll('#lab svg text')].some(t => /bulb (ON|OFF)/.test(t.textContent))") for _ in range(8) if not pg.wait_for_timeout(60)]
            check('Sinhala: a lab drawing that is redrawn all the time never flashes English labels', not any(seen), seen)
            pg.goto(BASE + '/lessons/g11-chapter-13-electromagnetism.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)     # the chosen language (Sinhala) is remembered
            check('Sinhala: the electromagnetism chapter is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'විද්‍යුත් චුම්බක' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.goto(BASE + '/lessons/g11-chapter-04-waves.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: the waves chapter is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'තරංග' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.goto(BASE + '/lessons/g11-chapter-05-geometrical-optics.html', wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
            check('Sinhala: the optics chapter is finished (no note, title from the textbook)', pg.locator('.stem-si-note').count() == 0 and 'ප්‍රකාශ' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            unfinished = []
            for lid in LESSONS:                                     # every chapter is translated: none shows the "not finished" note, and each title is Sinhala
                pg.goto(BASE + '/lessons/' + lid + '.html', wait_until='domcontentloaded'); pg.wait_for_timeout(1800)
                if pg.locator('.stem-si-note').count() or not re.search('[඀-෿]', pg.inner_text('.hero h1')):
                    unfinished.append(lid)
            check('Sinhala: all %d chapters are finished (no unfinished-translation note, Sinhala titles)' % len(LESSONS), not unfinished, unfinished)
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(300)
            pg.goto(BASE + '/lessons/g10-chapter-18-work-energy-power.html', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
            pg.evaluate("applyLang('ta')"); pg.wait_for_timeout(1200)
            check('back to Tamil: Tamil text, no Sinhala left behind', 'வேலை' in pg.inner_text('.hero h1') and not re.search('[\u0D80-\u0DFF]', pg.inner_text('.hero')) and pg.locator('.stem-si-note').count() == 0, pg.inner_text('.hero h1'))
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(900)
            check('back to English: English text, no Sinhala left behind', 'Work, Energy and Power' in pg.inner_text('.hero h1') and not re.search('[\u0D80-\u0DFF]', pg.inner_text('.wrap')))
            pg.evaluate("applyLang('si')"); pg.wait_for_timeout(1200); pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(2000)
            check('Sinhala is remembered after a reload', pg.evaluate("document.documentElement.lang") == 'si' and 'කාර්යය' in pg.inner_text('.hero h1'))
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(600)
            ctx.close()

            # admin and student areas are separate: an admin signs in to the admin panel, the lesson menu has no Admin entry, the admin panel does not link into the lessons
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg = ctx.new_page()
            pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
            pg.fill('#un', 'adm_root'); pg.fill('#pw', 'LocalTest-2468'); pg.click('#go'); pg.wait_for_timeout(2500)
            check('an admin signing in lands on the admin panel', pg.url.rstrip('/').endswith('/admin'), pg.url)
            check('the admin panel has no link into the study lessons', pg.locator('a[href*="/lessons/"]').count() == 0)
            pg.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
            pg.click('.stem-av'); pg.wait_for_timeout(300)
            check('the lesson account menu has no Admin entry', pg.locator('.stem-menu a[href="/admin"]').count() == 0, pg.inner_text('.stem-menu'))
            ctx.close()

            # the chosen language is kept across pages: a page never shows English first and flips; the account page follows it too
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg = ctx.new_page()
            pg.goto(BASE + '/lessons/index.html', wait_until='domcontentloaded'); pg.evaluate("localStorage.setItem('lessonLang','ta')")
            for name, sel, want in (('chapter-05-friction', '.hero h1', 'உராய்வு'), ('index', 'h1', 'பிசிக்ஸ்')):
                pg.goto(BASE + '/lessons/%s.html' % name, wait_until='commit')
                pg.wait_for_function("getComputedStyle(document.body).visibility === 'visible'", timeout=8000)
                first = pg.evaluate("(document.querySelector('%s') || {}).textContent || ''" % sel)
                check('Tamil is kept: %s is already in Tamil the first time it is shown' % name, want in first and pg.evaluate("document.documentElement.lang") == 'ta', first[:40])
            pg.goto(BASE + '/account', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
            check('the account page is in Tamil when Tamil is chosen', 'என் கணக்கு' in pg.inner_text('.brand') and 'மொழி' in pg.inner_text('body'), pg.inner_text('.brand'))
            pg.click('button[data-lang="si"]'); pg.wait_for_timeout(300)
            check('choosing Sinhala on the account page changes it and keeps it', 'මගේ ගිණුම' in pg.inner_text('.brand') and pg.evaluate("localStorage.getItem('lessonLang')") == 'si')
            pg.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='commit')
            pg.wait_for_function("getComputedStyle(document.body).visibility === 'visible'", timeout=8000)
            check('...and the next lesson page opens in Sinhala', 'ඝර්ෂණය' in pg.inner_text('.hero h1'), pg.inner_text('.hero h1'))
            pg.evaluate("localStorage.setItem('lessonLang','en')")
            ctx.close()

            # the hub in Sinhala
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            pg, errs = open_lesson(ctx, 'index')
            pg.click('#langToggle'); pg.wait_for_timeout(200); pg.click('.stem-langpop button[data-l="si"]'); pg.wait_for_timeout(800)
            check('Sinhala hub: modules and chapter names are Sinhala', '10 ශ්‍රේණිය' in pg.inner_text('details.mod[data-m="g10"] summary') and 'ධාරා විද්‍යුතය' in pg.inner_text('#toc'), pg.inner_text('#toc')[:100])
            check('Sinhala hub: the continue button is Sinhala', re.search('[\u0D80-\u0DFF]', pg.inner_text('#cCtaW')) is not None, pg.inner_text('#cCtaW'))
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(500)
            ctx.close()

            # ------------------------------------------------------------ course-style lesson (like an online course player)
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g11-chapter-10-electric-appliances')
            vis = lambda sel: pg.evaluate("(() => { const e = document.querySelector('%s'); return !!e && getComputedStyle(e).display !== 'none'; })()" % sel)
            check('lesson header: a back arrow and the chapter title', vis('.stem-back') and 'Power' in pg.inner_text('.stem-ct b'), pg.inner_text('.stem-ct'))
            check('lesson header: no menu button, no XP strip, no brand, no theme button', not any(vis(x) for x in ('.stem-menu-btn', '.xpbar', '.topbar .brand', '#themeToggle')))
            check('the back arrow goes to the course contents', (pg.get_attribute('.stem-back', 'href') or '').endswith('/lessons/index.html'))
            check('first screen has an overview: length, one Start button and the steps', pg.locator('.stem-ov .ov-cta').count() == 1 and pg.locator('.stem-ov .ov-it').count() == 13 and pg.inner_text('.ov-cta b') == 'Start', (pg.locator('.stem-ov .ov-it').count(), pg.inner_text('.ov-cta')))
            check('the old path card is gone', not vis('#fw_path .fw-card'))
            pg.click('.ov-it[data-go="4"]'); pg.wait_for_timeout(500)
            check('tapping a step in the overview opens it', pg.evaluate('StemPlayer.current()') == 4)
            check('the header shows the step count', '4 / 13' in pg.inner_text('.stem-ct small'), pg.inner_text('.stem-ct small'))
            pg.evaluate('StemPlayer.go(0)'); pg.wait_for_timeout(400)
            check('the overview button now says Continue and marks visited steps', pg.inner_text('.ov-cta b') in ('Continue', 'Start'))
            pg.evaluate('StemPlayer.go(14)'); pg.wait_for_timeout(400)
            check('finish step: no "back to the path" button', not pg.evaluate("[...document.querySelectorAll('#fw_fin a[href$=fw_path]')].some(e => getComputedStyle(e).display !== 'none')"))
            ctx.close()

            # first visit: the picture coach shows once, one big tick closes it for good
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power'); pg.wait_for_timeout(500)
            check('first visit: the picture coach opens', pg.locator('.stem-coach .co-tile').count() == 6, pg.locator('.stem-coach .co-tile').count())
            pg.click('.co-ok'); pg.wait_for_timeout(300)
            check('the big tick closes the coach', pg.locator('.stem-coach').count() == 0)
            pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(1400)
            check('the coach does not come back', pg.locator('.stem-coach').count() == 0)
            pg.click('.stem-av'); pg.wait_for_timeout(300); pg.click('.stem-menu button:has-text("How it works")'); pg.wait_for_timeout(400)
            check('"How it works" in the account menu shows the guide again', pg.locator('.stem-coach').count() == 1)
            pg.click('.co-ok'); pg.wait_for_timeout(200)
            # Tamil text in the start-from-zero step
            pg.evaluate("StemPlayer.go(StemPlayer.stepIds.indexOf('basics') + 1)"); pg.wait_for_timeout(300)
            pg.evaluate("applyLang('ta')"); pg.wait_for_timeout(900)
            check('the start-from-zero step switches to Tamil', pg.evaluate("/[\\u0B80-\\u0BFF]/.test(document.querySelector('#basics .bs-card h3').textContent)"))
            pg.evaluate("applyLang('en')"); pg.wait_for_timeout(900)      # back to English: the language is saved to the account
            ctx.close()

            ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
            pg, errs = open_lesson(ctx, 'g10-chapter-18-work-energy-power')
            d = pg.evaluate("[getComputedStyle(document.querySelector('.navlinks')).display, getComputedStyle(document.querySelector('.stem-menu-btn')).display, getComputedStyle(document.querySelector('.stem-back')).display]")
            check('desktop: no link strip and no menu button; a back arrow instead', d[0] == 'none' and d[1] == 'none' and d[2] != 'none', d)
            ctx.close()

            # hub = the course page: one Continue button, contents grouped in modules, a ring of progress on every chapter
            ctx = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, storage_state=state)
            ctx.add_init_script("try{localStorage.setItem('stem_last_lesson','g11-chapter-04-waves.html');localStorage.setItem('scx_path_g11c11'," + json.dumps(json.dumps({'story': 1, 'basics': 1, 'watch': 1})) + ")}catch(e){}")
            pg, errs = open_lesson(ctx, 'index')
            check('hub: two modules (Grade 10, Grade 11) and fifteen chapters, no grade chips or cards', pg.locator('details.mod').count() == 2 and pg.locator('.mod .row').count() == 15 and pg.locator('.gchip,.lesson-card').count() == 0, (pg.locator('details.mod').count(), pg.locator('.mod .row').count()))
            check('hub: one big Continue/Start button points at the last lesson', pg.get_attribute('#cCta', 'href') == 'g11-chapter-04-waves.html' and 'Waves' in pg.inner_text('#cCtaT'), (pg.get_attribute('#cCta', 'href'), pg.inner_text('#cCtaT')))
            check('hub: the module holding that lesson is open, the others closed', pg.evaluate("[...document.querySelectorAll('details.mod')].map(d => d.open)") == [False, True], pg.evaluate("[...document.querySelectorAll('details.mod')].map(d => d.open)"))
            row = pg.evaluate("(() => { const a = document.querySelector('a.row[href*=electronics]'); return [a.querySelector('.rm').textContent, a.querySelector('.st').style.getPropertyValue('--p'), a.textContent]; })()")
            check('hub: a chapter in progress shows 3 / 13 and a ring', row[0].strip() == '3 / 13' and int(row[1]) == 23, row)
            check('hub: each row says its state to a screen reader', 'in progress' in row[2])
            check('hub: the header has only the logo, language and account', pg.evaluate("[...document.querySelectorAll('.topbar button, .topbar a')].filter(e => e.offsetParent !== null).length") <= 3)
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
