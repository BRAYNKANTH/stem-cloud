# -*- coding: utf-8 -*-
"""Topic-by-topic view of a chapter: server rules, content integrity and real-browser checks (desktop and phone).

    python tests/test_topics.py
Needs: pip install playwright   (uses Edge if present, otherwise the Playwright Chromium)
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8778
BASE = 'http://localhost:%d' % PORT
SLUG = 'unit-02-motion-in-a-straight-line'
PAGE = '/topics/' + SLUG
H = {'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'}
fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def raw(path, cookie=None):
    req = urllib.request.Request(BASE + path, headers={'Cookie': cookie} if cookie else {})
    try:
        r = urllib.request.build_opener(NoRedirect).open(req)
    except urllib.error.HTTPError as e:
        r = e
    return r.status if hasattr(r, 'status') else r.code, r.headers, r.read().decode('utf-8', 'replace')


def launch(p):
    """Edge when present (as the other browser tests), else the Playwright Chromium; STEM_BROWSER names an explicit browser executable."""
    exe = os.environ.get('STEM_BROWSER') or ('/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    if exe:
        return p.chromium.launch(executable_path=exe, headless=True)
    try:
        return p.chromium.launch(channel='msedge', headless=True)
    except Exception:
        return p.chromium.launch(headless=True)


def rec(page, key='scx_topics_u2'):
    return page.evaluate("k => JSON.parse(localStorage.getItem(k) || '{}')", key)


def content_checks():
    """The built topic data is complete and consistent (it is what students see)."""
    d = json.load(open(os.path.join(ROOT, 'site', 'lessons', 'topics', SLUG + '.json'), encoding='utf-8'))
    topics = d['topics']
    check('topics are in the Motion order', [t['id'] for t in topics] == ['distance-displacement', 'speed-velocity', 'acceleration', 'motion-graphs', 'free-fall'])
    check('every topic has Understand notes', all(t['understand']['notes'].strip() for t in topics))
    check('every topic lists only steps that have content', all(
        ('watch' in t['steps']) == bool(t['watch']) and ('explore' in t['steps']) == bool(t['explore']) and ('practice' in t['steps']) == bool(t['practice']['items'])
        for t in topics))
    ids = [i['id'] for t in topics for i in t['practice']['items']]
    check('practice question ids are unique across topics', len(ids) == len(set(ids)), ids)
    mcq = [i for t in topics for i in t['practice']['items'] if i['kind'] == 'mcq'] + d['revision']['quiz']
    check('every multiple-choice question has a valid answer and an explanation', all(0 <= q['correct'] < len(q['opts']['en']) and q['why']['en'].strip() for q in mcq))
    ex = [i for t in topics for i in t['practice']['items'] if i['kind'] == 'ex'] + d['revision']['mixed']
    check('every worked exercise has a question and a solution', all(e['q']['en'].strip() and e['a']['en'].strip() for e in ex))
    t1 = topics[0]
    check('Distance and displacement has the comparison table, scalar/vector and the misconception',
          t1['understand']['glance']['table'] and t1['understand']['glance']['misconception'] and 'scalar' in json.dumps(t1['understand']['glance']).lower())
    check('Distance and displacement story is 300 m there and back (600 m, displacement 0)',
          '300 m' in t1['explore']['scenario'] and t1['explore']['steps'][0]['options'][t1['explore']['steps'][0]['correct']] == '600 m'
          and t1['explore']['steps'][1]['options'][t1['explore']['steps'][1]['correct']] == '0 m')
    check('watch slices come from the lesson animation and do not overlap',
          [(t['watch']['from'], t['watch']['to']) for t in topics if t['watch']] == [(0, 11), (11, 20), (20, 30)])
    check('the notes shown here carry no ids or scripts that could clash with the page', not any(re.search(r'<script|\sid="', t['understand']['notes']) for t in topics))
    lesson = open(os.path.join(ROOT, 'site', 'lessons', 'unit-02-motion-in-a-straight-line.html'), encoding='utf-8').read()
    check('the original lesson page is untouched (still has its notes, story and exercises)', all(x in lesson for x in ('id="notesStage"', 'id="story"', 'id="exercises"', 'id="quiz"')))
    return d


def server_checks(admin):
    code, hd, body = raw(PAGE)
    check('topic page needs a login', code == 302 and '/login' in hd.get('Location', ''), (code, hd.get('Location')))
    code, hd, body = raw('/lessons/topics/%s.json' % SLUG)
    check('topic data needs a login', code == 401, code)
    cookie = admin
    code, hd, body = raw(PAGE, cookie)
    check('topic page opens when logged in', code == 200 and 'topics.js' in body and 'window.SCX_USER' in body, code)
    check('topic page cannot be framed, lesson pages can only be framed by this site',
          hd.get('X-Frame-Options') == 'DENY' and raw('/lessons/' + SLUG + '.html', cookie)[1].get('X-Frame-Options') == 'SAMEORIGIN')
    check('topic page is not cached by shared caches', hd.get('Cache-Control') == 'no-store', hd.get('Cache-Control'))
    check('unknown chapter is a 404', raw('/topics/nope', cookie)[0] == 404)
    check('path tricks are refused', raw('/topics/..%2f..%2fapi%2findex', cookie)[0] in (404, 422) and raw('/topics/%2e%2e', cookie)[0] in (404, 422, 307, 308))
    code, hd, body = raw('/lessons/topics/index.json', cookie)
    check('chapter list for the contents page', code == 200 and SLUG in body)


def api_merge_checks(ctx):
    def put(v):
        r = ctx.request.put(BASE + '/api/progress', headers=H, data=json.dumps({'scx_topics_u2': json.dumps(v)}))
        return json.loads(r.json()['progress']['scx_topics_u2'])
    first = put({'acceleration': {'v': {'understand': 1}, 'd': {'understand': 1}, 'q': {'m4': {'n': 3, 'ok': 1, 'f': 0}}}})
    merged = put({'acceleration': {'v': {'watch': 1}, 'd': {}, 'q': {'m4': {'n': 1, 'ok': 0, 'f': 1}, 'x22_1': {'n': 1, 'ok': 1, 'f': 1}}}})
    a = merged['acceleration']
    check('topic progress merges forward: opened and done flags are kept', a['v'] == {'understand': 1, 'watch': 1} and a['d'] == {'understand': 1}, a)
    check('topic progress merges forward: attempts keep the higher count, a correct answer stays correct',
          a['q']['m4'] == {'n': 3, 'ok': 1, 'f': 1} and a['q']['x22_1']['n'] == 1, a['q'])
    check('a stale device cannot erase topic progress', put({})['acceleration']['d'] == {'understand': 1})
    r = ctx.request.put(BASE + '/api/progress', headers=H, data=json.dumps({'scx_topics_u2': 'not json'}))
    check('garbage progress does not break saving', r.ok)


def browser_checks(p, make_student, size, label):
    b = launch(p)
    ctx, page = make_student(b, size)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    L = lambda s: '%s: %s' % (label, s)

    def goto(q=''):
        page.goto(BASE + PAGE + q)
        page.wait_for_selector('#tp-h1', state='attached', timeout=15000)

    def overflow():
        return page.evaluate('() => document.documentElement.scrollWidth - innerWidth')

    # ---- chapter overview
    goto()
    check(L('overview lists the topics in order'), page.locator('.tp-tt').all_inner_texts()[:5] ==
          ['Distance and displacement', 'Speed and velocity', 'Acceleration', 'Motion graphs', 'Gravitational acceleration and free fall'])
    check(L('overview offers Start learning, not Continue, for a new student'), 'Start learning' in page.locator('.tp-cta').inner_text())
    check(L('overview says which steps are coming soon'), '2 coming soon' in page.locator('.tp-topic').nth(1).inner_text())
    check(L('overview has a chapter revision entry'), page.locator('.tp-revlink').count() == 1)
    check(L('overview fits the screen'), overflow() <= 1, overflow())

    # ---- topic 1: Understand
    page.locator('.tp-cta').click()
    page.wait_for_selector('.tp-steps')
    check(L('Start learning opens Understand of topic 1'), page.url.endswith('t=distance-displacement&s=understand'), page.url)
    check(L('four learning steps are shown in order'), page.locator('.tp-step .tp-sl b').all_inner_texts() == ['Understand', 'Watch', 'Explore', 'Practice'])
    check(L('current step is marked'), page.locator('.tp-step.cur').count() == 1 and page.locator('.tp-step[aria-current="step"]').inner_text().startswith('1') or 'Understand' in page.locator('.tp-step[aria-current="step"]').inner_text())
    check(L('comparison table is shown'), page.locator('.tp-table').count() == 1 and page.locator('.tp-table th[scope="row"]').count() >= 4)
    check(L('detailed notes start collapsed'), page.locator('details.tp-details').first.get_attribute('open') is None)
    check(L('key formulas show'), page.locator('.tp-formulas .formula-box').count() >= 1)
    r = rec(page)['distance-displacement']
    check(L('opening a step records "opened", not "done"'), r['v'].get('understand') == 1 and not r['d'], r)
    check(L('understand fits the screen'), overflow() <= 1, overflow())
    page.locator('summary', has_text='Detailed notes').click()
    check(L('detailed notes open with the lesson text'), 'scalar' in page.locator('.tp-notes').inner_text().lower())
    page.locator('[data-act="done"]').click()
    check(L('"I have read this" marks Understand done'), rec(page)['distance-displacement']['d'].get('understand') == 1)
    check(L('the step chip shows it is done'), 'done' in page.locator('.tp-step').nth(0).get_attribute('class'))

    # ---- Watch (the lesson animation, only the first scene)
    page.locator('.tp-foot .next, .tp-foot .tp-next').click()
    page.wait_for_selector('#tp-iframe')
    check(L('Watch shows a title and a duration'), 'Distance vs displacement' in page.locator('.tp-vhead h3').inner_text() and '0:11' in page.locator('.tp-dur').inner_text())
    fr = page.frame_locator('#tp-iframe')
    fr.locator('#fw_svg').wait_for(state='attached', timeout=20000)
    check(L('the lesson header and step bar are hidden inside the frame'), not fr.locator('.topbar').is_visible() and not fr.locator('#stem-bar').is_visible())
    check(L('the notes stay reachable under the video'), page.locator('details.tp-ref > summary').is_visible())
    check(L('looking at a topic does not touch the lesson page progress'), page.evaluate("() => localStorage.getItem('stem_last_lesson') === null && localStorage.getItem('scx_path_u2') === null"))
    page.wait_for_function("() => { const f = document.getElementById('tp-iframe'); return f && f.getBoundingClientRect().height > 300 && f.getBoundingClientRect().height < 2300 }")
    check(L('watch fits the screen'), overflow() <= 1, overflow())
    # play the slice: the animation stops at its prediction question, then at the end of scene 1
    fr.locator('#fw_play').click()
    fr.locator('#fw_ask button').first.wait_for(timeout=12000)
    fr.locator('#fw_ask button').first.click()
    fr.locator('#fw_go').click()
    page.wait_for_function("() => document.querySelector('#tp-watchdone .tp-check')", timeout=20000)
    check(L('finishing the scene marks Watch done'), rec(page)['distance-displacement']['d'].get('watch') == 1)
    check(L('the animation stopped at the end of the slice, not at the end of the whole video'),
          fr.locator('#fw_scrub').input_value() != '' and 330 <= int(fr.locator('#fw_scrub').input_value()) <= 380, fr.locator('#fw_scrub').input_value())

    # ---- Explore: the story with predictions
    page.locator('.tp-step', has_text='Explore').click()
    page.wait_for_selector('.tp-story')
    check(L('story scenario is the 300 m walk'), '300 m' in page.locator('.tp-story').inner_text())
    page.locator('.tp-ask .tp-opt', has_text='300 m').first.click()
    check(L('a wrong prediction gets feedback'), 'Not quite' in page.locator('.tp-fb').inner_text())
    page.locator('[data-act="story-next"]').click()
    page.locator('.tp-ask').nth(1).locator('.tp-opt[data-k="2"]').click()
    check(L('the story ends by linking back to the concept'), 'scalar' in page.locator('.tp-callout.good').inner_text().lower())
    check(L('Explore is done after the last prediction'), rec(page)['distance-displacement']['d'].get('explore') == 1)

    # ---- Practice
    page.locator('.tp-step', has_text='Practice').click()
    page.wait_for_selector('.tp-qcard')
    check(L('practice shows 5 questions, basic to application'), page.locator('.tp-qcard').count() == 5)
    check(L('practice says results are not mastery'), 'do not mean you have mastered' in page.locator('.tp-pstats').inner_text())
    page.locator('.tp-qcard').nth(0).locator('[data-act="show"]').click()
    check(L('a worked solution is shown on request'), page.locator('.tp-qcard').nth(0).locator('.ex-answer').is_visible())
    page.locator('.tp-qcard').nth(0).locator('[data-act="grade"][data-v="no"]').click()
    check(L('"not yet" suggests revisiting a step and allows a retry'), page.locator('.tp-qcard').nth(0).get_by_text('Revisit Understand').is_visible() and page.locator('.tp-qcard').nth(0).locator('[data-act="again"]').is_visible())
    page.locator('.tp-qcard').nth(0).locator('[data-act="again"]').click()
    page.locator('.tp-qcard').nth(0).locator('[data-act="show"]').click()
    page.locator('.tp-qcard').nth(0).locator('[data-act="grade"][data-v="yes"]').click()
    q = rec(page)['distance-displacement']['q']['xc_1i']
    check(L('exercise attempts are counted, not just the last answer'), q['n'] == 2 and q['ok'] == 1 and q['f'] == 0, q)
    # the multiple-choice question: answer wrongly first
    card = page.locator('#q-m1')
    card.locator('.tp-opt').nth(0).click()
    check(L('Check answer becomes available once an option is chosen'), card.locator('[data-act="check"]').is_enabled())
    card.locator('[data-act="check"]').click()
    check(L('a wrong answer says so, explains, hints and offers a retry'), 'Not quite' in card.locator('.tp-result').inner_text() and 'Hint' in card.locator('.tp-result').inner_text()
          and card.locator('[data-act="retry"]').is_visible())
    card.locator('[data-act="retry"]').click()
    card.locator('.tp-opt').nth(1).click(); card.locator('[data-act="check"]').click()
    check(L('then the right answer is confirmed'), 'Correct' in card.locator('.tp-result').inner_text())
    m = rec(page)['distance-displacement']['q']['m1']
    check(L('multiple-choice records attempts, ever-correct and first-try separately'), m == {'n': 2, 'ok': 1, 'f': 0}, m)
    check(L('Practice is not done while questions are untried'), not rec(page)['distance-displacement']['d'].get('practice'))
    for i, sel in ((2, 'xc_2i'), (3, 'xc_2ii'), (4, 'x21_1')):
        page.locator('.tp-qcard').nth(i).locator('[data-act="show"]').click()
        page.locator('.tp-qcard').nth(i).locator('[data-act="grade"][data-v="yes"]').click()
    # question 3 is the multiple choice that sits at index 1 (already answered); every question tried now
    check(L('Practice is done once every question has been tried'), rec(page)['distance-displacement']['d'].get('practice') == 1)
    check(L('practice stats keep multiple choice and self-checked apart'), 'right first time' in page.locator('.tp-pstats').inner_text() and 'Self-checked' in page.locator('.tp-pstats').inner_text())
    check(L('practice fits the screen'), overflow() <= 1, overflow())
    check(L('after practice the student is guided to Speed and velocity'), 'Speed and velocity' in page.locator('.tp-upnext').inner_text())
    page.locator('.tp-upnext a').click()
    page.wait_for_selector('.tp-steps')
    check(L('Up next opens the next topic at Understand'), page.url.endswith('t=speed-velocity&s=understand') and 'Speed and velocity' in page.locator('#tp-h1').inner_text(), page.url)
    page.go_back(); page.wait_for_selector('.tp-qcard')
    check(L('the browser Back button returns to the previous step'), 'practice' in page.url)

    # ---- missing content is shown honestly
    goto('?t=speed-velocity&s=watch')
    check(L('a missing video shows "coming soon", no player'), 'coming soon' in page.locator('.tp-soon').inner_text().lower() and page.locator('iframe').count() == 0)
    check(L('the topic is not marked complete because of missing steps'), 'done' not in page.locator('.tp-step.soon').first.get_attribute('class').split())
    goto('?t=speed-velocity&s=understand'); page.locator('[data-act="done"]').click()
    goto()
    check(L('overview: a topic with missing steps shows how many are done and how many are coming'), '1 of 2 steps done' in page.locator('.tp-topic').nth(1).inner_text() and 'coming soon' in page.locator('.tp-topic').nth(1).inner_text())
    check(L('overview shows Continue learning once started'), 'Continue learning' in page.locator('.tp-cta').inner_text())
    check(L('topic 1 shows complete once all four steps are done'), 'Complete' in page.locator('.tp-topic').nth(0).inner_text())

    # ---- a lab as the Explore step
    goto('?t=acceleration&s=explore')
    page.frame_locator('#tp-iframe').locator('#lab').wait_for(state='attached', timeout=20000)
    check(L('the lab is framed without the lesson chrome'), not page.frame_locator('#tp-iframe').locator('.topbar').is_visible())

    # ---- revision
    goto('?r=1&s=summary')
    check(L('revision summary has key points and the glossary'), page.locator('.sumlist li').count() >= 6 and page.locator('table.gloss').count() >= 1)
    check(L('revision gathers the formulas of all topics'), page.locator('.tp-formulas .formula-box').count() >= 8)
    goto('?r=1&s=quiz')
    check(L('chapter quiz has every multiple-choice question'), page.locator('.tp-qcard').count() == 5)
    page.locator('#q-qz_m1 .tp-opt').nth(1).click(); page.locator('#q-qz_m1 [data-act="check"]').click()
    check(L('quiz answers are saved apart from topic practice'), rec(page)['revision']['q']['qz_m1']['n'] == 1 and 'qz_m1' not in rec(page)['distance-displacement']['q'])
    goto('?r=1&s=mixed')
    check(L('mixed practice has questions that join topics'), page.locator('.tp-qcard').count() == 3)
    check(L('revision fits the screen'), overflow() <= 1, overflow())

    # ---- Tamil: the lesson text follows the language button
    goto('?t=distance-displacement&s=understand')
    page.locator('#langToggle').click()
    page.locator('.stem-langpop button', has_text='தமிழ்').click()
    page.wait_for_timeout(300)
    check(L('Tamil shows the lesson notes and formulas in Tamil'), bool(re.search(r'[஀-௿]', page.locator('.tp-formulas').inner_text())))
    page.evaluate("() => localStorage.setItem('lessonLang','en')")

    # ---- the course contents page links to the topics
    page.goto(BASE + '/lessons/index.html')
    page.wait_for_selector('.tp-hub-link', timeout=15000)
    t = page.locator('.tp-hub-link').inner_text()
    check(L('course contents offers "Learn topic by topic" with topic progress'), 'Learn topic by topic' in t and '/ 5' in t, t)
    page.locator('.tp-hub-link').click()
    page.wait_for_selector('#tp-h1')
    check(L('that link opens the chapter overview'), page.url.endswith(PAGE), page.url)

    # ---- the topic page still works offline-free of errors
    check(L('no script or console errors'), not [e for e in errors if 'Failed to load resource' not in e and 'fonts.g' not in e], errors)
    ctx.close(); b.close()


def run():
    content_checks()
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
        with sync_playwright() as p:
            b0 = launch(p)
            adm = b0.new_context()
            adm.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'adm_root', 'password': 'LocalTest-2468'}))   # the first account is the admin
            cookie = '; '.join('%s=%s' % (c['name'], c['value']) for c in adm.cookies())
            server_checks(cookie)
            n = [0]

            def student(b, size):
                n[0] += 1
                name = 'stu_%d' % n[0]
                r = adm.request.post(BASE + '/api/admin/create-user', headers=H, data=json.dumps({'username': name, 'password': 'LocalTest-2468'}))
                assert r.ok, r.status
                ctx = b.new_context(viewport=size, has_touch=size['width'] < 600)
                ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
                assert ctx.request.post(BASE + '/api/login', headers=H, data=json.dumps({'username': name, 'password': 'LocalTest-2468'})).ok
                return ctx, ctx.new_page()

            api_ctx = student(b0, {'width': 1100, 'height': 900})[0]
            api_merge_checks(api_ctx)
            api_ctx.close()
            browser_checks(p, student, {'width': 1100, 'height': 900}, 'desktop')
            browser_checks(p, student, {'width': 390, 'height': 800}, 'phone')
            b0.close()
    finally:
        srv.terminate()
    print('\n%d check(s) failed' % len(fails) if fails else '\nall checks passed')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(run())
