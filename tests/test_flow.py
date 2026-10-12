# -*- coding: utf-8 -*-
"""End-to-end test of every account flow, against SQLite and against a real (embedded) Postgres.

    python tests/test_flow.py            # both
    python tests/test_flow.py sqlite     # or: postgres
"""
import http.cookiejar, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8775
BASE = 'http://127.0.0.1:%d' % PORT


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)

    def call(self, method, path, body=None, csrf=True):
        h = {'Content-Type': 'application/json'}
        if csrf:
            h['X-Requested-With'] = 'stemcloud'
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            r = self.op.open(req)
        except urllib.error.HTTPError as e:
            r = e
        raw = r.read().decode('utf-8', 'replace')
        try:
            j = json.loads(raw)
        except Exception:
            j = None
        return r.status if hasattr(r, 'status') else r.code, j, raw, r.headers


fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)


def scenario(mode):
    check('healthz reports the right database and local media', Client().call('GET', '/healthz')[1] == {'ok': True, 'db': mode, 'media': 'local'}, Client().call('GET', '/healthz')[1])
    a, b, anon = Client(), Client(), Client()

    s, j, _, _ = a.call('POST', '/api/signup', {'username': 'Ann_1', 'password': 'secret123', 'display_name': 'Ann'})
    check('signup ok, first user is admin', s == 200 and j['user']['role'] == 'admin', (s, j))
    s, j, _, _ = a.call('POST', '/api/signup', {'username': 'ann_1', 'password': 'secret123'}, csrf=False)
    check('signup without CSRF header is refused', s == 403, s)
    s, j, _, _ = b.call('POST', '/api/signup', {'username': 'bob', 'password': 'secret456'})
    check('public signup blocked once admin exists', s == 403, (s, j))
    s, j, _, _ = b.call('POST', '/api/login', {'username': 'admin', 'password': 'AdminPass123'})
    check('no built-in admin: "admin" / "AdminPass123" is refused', s == 401, (s, j))
    s, j, _, _ = b.call('POST', '/api/login', {'username': 'brayn', 'password': 'AnyPassword99'})
    check('no admin account is created by logging in with a made-up name', s == 401, (s, j))
    s, j, _, _ = a.call('POST', '/api/admin/create-user', {'username': 'ann_1', 'password': 'secret123', 'role': 'student'})
    check('duplicate username refused on admin create', s == 409, (s, j))
    s, j, _, _ = a.call('POST', '/api/admin/create-user', {'username': 'bo', 'password': 'secret123', 'role': 'student'})
    check('short username refused on admin create', s == 400, s)
    s, j, _, _ = a.call('POST', '/api/admin/create-user', {'username': 'bob', 'password': 'short', 'role': 'student'})
    check('short password refused on admin create', s == 400, s)
    s, j, _, _ = a.call('POST', '/api/admin/create-user', {'username': 'bob', 'password': 'secret456', 'display_name': '<b>Bob</b>', 'role': 'student'})
    check('admin creates student account', s == 200 and j['user']['role'] == 'student', (s, j))
    s, j, _, _ = b.call('POST', '/api/login', {'username': 'bob', 'password': 'secret456'})
    check('student logs in with admin-created credentials', s == 200 and j['user']['role'] == 'student', (s, j))

    s, _, _, h = anon.call('GET', '/lessons/index.html')
    check('lessons redirect to login when logged out', s == 302 and '/login' in (h.get('location') or ''), (s, h.get('location')))
    s, _, _, _ = anon.call('GET', '/api/progress')
    check('progress needs login', s == 401, s)
    s, _, _, _ = anon.call('GET', '/lessons/chapter-05-friction.html')
    check('single lesson gated too', s == 302, s)

    s, _, raw, _ = a.call('GET', '/lessons/index.html')
    check('lesson served when logged in, with boot + account.js', s == 200 and 'window.SCX_USER' in raw and '/static/account.js' in raw, s)
    s, _, _, _ = a.call('GET', '/lessons/..%2f..%2fserver%2fapp.py')
    check('path traversal blocked', s in (404, 401, 400), s)
    s, _, _, _ = a.call('GET', '/lessons/../server/app.py')
    check('path traversal (raw) blocked', s in (404, 400), s)
    s, _, _, _ = a.call('GET', '/static/../app.py')
    check('static traversal blocked', s in (404, 400), s)

    s, j, _, _ = a.call('PUT', '/api/progress', {'scx_xp_total': '120', 'scx_badges': '["quiz_ace"]', 'scx_c5_stars': '[3,1,0]', 'evil': 'x', 'scx_done_c5': '1'})
    check('progress saved', s == 200 and j['progress']['scx_xp_total'] == '120' and 'evil' not in j['progress'], (s, j))
    s, j, _, _ = a.call('PUT', '/api/progress', {'scx_xp_total': '50', 'scx_badges': '["concept_master"]', 'scx_c5_stars': '[1,2,3,3]', 'scx_done_c5': '0'})
    p = j['progress']
    check('XP never goes down', p['scx_xp_total'] == '120', p)
    check('badges are unioned', json.loads(p['scx_badges']) == ['concept_master', 'quiz_ace'], p)
    check('stars take the max per level', json.loads(p['scx_c5_stars']) == [3, 2, 3, 3], p)
    check('completed flag sticks', p['scx_done_c5'] == '1', p)
    s, _, _, _ = a.call('PUT', '/api/progress', {'scx_xp_total': '1' * 30000})
    s, j, _, _ = a.call('GET', '/api/progress')
    check('oversized value ignored', j['progress']['scx_xp_total'] == '120', s)

    s, j, _, _ = b.call('GET', '/api/progress')
    check('other user progress is separate', s == 200 and j['progress'] == {}, j)
    s, _, raw, _ = a.call('GET', '/lessons/index.html')
    check('progress injected into page', '"scx_xp_total": "120"' in raw or '"scx_xp_total":"120"' in raw, raw[:0])
    s, _, raw, _ = b.call('GET', '/lessons/index.html')
    check("other user's page has no foreign progress", '120' not in raw.split('window.SCX_USER')[0][:3000], '')

    # ---------------------------------------------------------------- progress v2: idempotent events, forward only
    s, j, _, _ = a.call('GET', '/api/v2/progress/summary')
    check('v2: the v1 saves above were also written to v2 (dual-write)', s == 200 and j['xp'] == 120 and sorted(j['badges']) == ['concept_master', 'quiz_ace'], j)
    L = 'physics.g10.motion-in-a-straight-line'
    t0 = int(time.time()) - 3600
    ev = lambda i, kind, at, **k: dict(id='ev-%s-%04d' % (mode, i), type=kind, at=at, **k)
    batch = [ev(1, 'step_open', t0, lesson=L, step='story'),
             ev(2, 'step_done', t0 + 60, lesson=L, step='story'),
             ev(3, 'answer', t0 + 100, question=L + '/q1', correct=False),
             ev(4, 'answer', t0 + 110, question=L + '/q1', correct=True),
             ev(5, 'xp', t0 + 110, source=L + '/q1', amount=10),
             ev(6, 'game', t0 + 120, game=L + '/holdgame', level=1, stars=2),
             ev(7, 'badge', t0 + 130, badge='u2-quiz-ace'),
             ev(8, 'day', t0, day='2026-10-12'),
             ev(9, 'prefs', t0, lang='ta', theme='dark')]
    s, _, _, _ = anon.call('POST', '/api/v2/events', {'events': batch})
    check('v2: events need login', s == 401, s)
    s, _, _, _ = a.call('POST', '/api/v2/events', {'events': batch}, csrf=False)
    check('v2: events need the CSRF header', s == 403, s)
    s, j, _, _ = a.call('POST', '/api/v2/events', {'events': batch})
    check('v2: a batch is applied', s == 200 and j['applied'] == 9 and not j['duplicate'] and not j['refused'], (s, j))
    s, j, _, _ = a.call('POST', '/api/v2/events', {'events': batch})
    check('v2: replaying the same batch changes nothing', s == 200 and j['applied'] == 0 and len(j['duplicate']) == 9, j)
    # a second device, offline for a while: older and newer events, some already sent by the first device
    late = [ev(20, 'step_open', t0 - 600, lesson=L, step='story'),            # opened earlier on the other phone
            ev(21, 'answer', t0 - 500, question=L + '/q1', correct=True),       # its first answer, earlier and right
            ev(22, 'game', t0 + 200, game=L + '/holdgame', level=1, stars=1),   # a worse score later
            ev(23, 'step_open', t0 + 300, lesson=L, step='notes'),
            ev(24, 'prefs', t0 - 900, lang='si'),                               # an older preference
            ev(5, 'xp', t0 + 110, source=L + '/q1', amount=10)]                 # already counted
    s, j, _, _ = b.call('POST', '/api/v2/events', {'events': [ev(30, 'xp', t0, source='x', amount=5)]})
    check('v2: another student has their own events', s == 200 and j['applied'] == 1, j)
    s, j, _, _ = a.call('POST', '/api/v2/events', {'events': late})
    check('v2: the other device: new events applied, the repeated one ignored', j['applied'] == 5 and j['duplicate'] == ['ev-%s-0005' % mode], j)
    s, j, _, _ = a.call('GET', '/api/v2/progress?lesson=' + L)
    st, q = j['steps'], j['questions'][L + '/q1']
    check('v2: a step keeps its earliest opening and stays done', st['story'] == {'opened': t0 - 600, 'done': t0 + 60} and st['notes']['done'] is None, st)
    check('v2: attempts add up; "first try" comes from the earliest answer, whatever the order', q == {'attempts': 3, 'correct': True, 'first_try': True}, q)
    check('v2: best stars are kept', j['games'] == {L + '/holdgame': {'1': 2}}, j['games'])
    s, j, _, _ = a.call('GET', '/api/v2/progress/summary')
    check('v2: XP counted once per event, on top of the v1 total', j['xp'] == 130, j)
    check('v2: badges, days, lessons and the newest preferences', sorted(j['badges']) == ['concept_master', 'quiz_ace', 'u2-quiz-ace'] and j['days'] == ['2026-10-12']
          and j['lessons'] == {L: {'opened': 2, 'done': 1}, 'physics.g10.friction': {'opened': 1, 'done': 1}}   # Friction: v1 scx_done_c5, dual-written
          and j['prefs'] == {'lang': 'ta', 'theme': 'dark'}, j)
    s, j, _, _ = b.call('GET', '/api/v2/progress/summary')
    check("v2: another student's summary is their own", j['xp'] == 5 and j['lessons'] == {} and j['badges'] == [], j)
    bad = [{'id': 'x'}, ev(40, 'xp', t0, source='a', amount=10 ** 6), ev(41, 'teleport', t0), ev(42, 'answer', t0, question='Bad Id!', correct=True),
           ev(43, 'day', t0, day='2026-13-40'), ev(44, 'prefs', t0, lang='fr'), ev(45, 'step_done', 100, lesson=L, step='story'), 'not an event']
    s, j, _, _ = a.call('POST', '/api/v2/events', {'events': bad})
    check('v2: bad events are refused, each with a reason', s == 200 and j['applied'] == 0 and len(j['refused']) >= 7, j)
    s, j, _, _ = a.call('POST', '/api/v2/events', {'events': [ev(50, 'step_open', int(time.time()) + 10 ** 6, lesson=L, step='quiz')]})
    s, j, _, _ = a.call('GET', '/api/v2/progress?lesson=' + L)
    check('v2: a time in the future (a fast clock) is clamped to now', j['steps']['quiz']['opened'] <= int(time.time()) + 1, j['steps'].get('quiz'))
    s, _, _, _ = a.call('POST', '/api/v2/events', {'events': [ev(60 + i, 'day', t0, day='2026-10-12') for i in range(201)]})
    check('v2: a batch is limited in size', s == 400, s)
    s, _, _, _ = a.call('GET', '/api/v2/progress?lesson=../../etc')
    check('v2: a bad lesson id is refused', s == 400, s)

    s, _, _, _ = b.call('GET', '/admin')
    check('student blocked from /admin', s == 403, s)
    s, _, _, _ = b.call('GET', '/api/admin/users')
    check('student blocked from admin API', s == 403, s)
    s, j, _, _ = a.call('GET', '/api/admin/users')
    check('admin lists users with xp', s == 200 and len(j['users']) == 2 and any(u['xp'] == 120 for u in j['users']), (s, j))
    bob_id = [u['id'] for u in j['users'] if u['username'] == 'bob'][0]
    s, _, _, _ = a.call('POST', '/api/admin/reset', {'id': bob_id, 'password': 'Reset-9999'})
    s2, _, _, _ = b.call('GET', '/api/me')
    check('admin reset logs the user out', s == 200 and s2 == 401, (s, s2))
    s, j, _, _ = b.call('POST', '/api/login', {'username': 'bob', 'password': 'secret456'})
    check('old password rejected', s == 401, s)
    s, j, _, _ = b.call('POST', '/api/login', {'username': 'bob', 'password': 'Reset-9999'})
    check('new password works', s == 200, (s, j))

    s, j, _, _ = b.call('POST', '/api/account/password', {'old': 'wrong', 'new': 'another123'})
    check('change password needs current one', s == 401, s)
    s, j, _, _ = b.call('POST', '/api/account/password', {'old': 'Reset-9999', 'new': 'another123'})
    check('change password ok', s == 200, (s, j))
    s, j, _, _ = b.call('POST', '/api/account/name', {'display_name': 'Bobby'})
    s, j, _, _ = b.call('GET', '/api/me')
    check('rename works', j['user']['display_name'] == 'Bobby', j)

    s, _, _, _ = a.call('POST', '/api/admin/delete', {'id': 1})
    check('admin cannot delete self', s == 400, s)
    s, _, _, _ = b.call('POST', '/api/account/delete', {'password': 'nope'})
    check('delete account needs password', s == 401, s)
    s, _, _, _ = b.call('POST', '/api/account/delete', {'password': 'another123'})
    s2, _, _, _ = b.call('GET', '/api/me')
    check('account deleted and logged out', s == 200 and s2 == 401, (s, s2))
    s, j, _, _ = a.call('GET', '/api/admin/users')
    check('deleted user gone from admin list', len(j['users']) == 1, j)

    s, _, _, h = a.call('POST', '/api/logout')
    s2, _, _, _ = a.call('GET', '/api/me')
    check('logout ends session', s == 200 and s2 == 401, (s, s2))
    s, j, _, _ = a.call('POST', '/api/login', {'username': 'ann_1', 'password': 'secret123'})
    s2, j2, _, _ = a.call('GET', '/api/progress')
    check('progress survives logout and login', s == 200 and j2['progress']['scx_xp_total'] == '120', (s, s2))

    # Test 2-device limit and device kick flow
    dev1, dev2, dev3 = Client(), Client(), Client()
    s, _, _, _ = dev1.call('POST', '/api/login', {'username': 'ann_1', 'password': 'secret123', 'kick_device': 'all'})
    check('dev1 login ok with all previous cleared', s == 200, s)
    s, _, _, _ = dev2.call('POST', '/api/login', {'username': 'ann_1', 'password': 'secret123'})
    check('dev2 login ok (2nd device)', s == 200, s)
    s, j, _, _ = dev3.call('POST', '/api/login', {'username': 'ann_1', 'password': 'secret123'})
    check('dev3 blocked with 409 device limit', s == 409 and j.get('device_limit') and len(j.get('devices', [])) == 2, (s, j))
    first_dev_id = j['devices'][0]['id']
    s, j, _, _ = dev3.call('POST', '/api/login', {'username': 'ann_1', 'password': 'secret123', 'kick_device': first_dev_id})
    check('dev3 login ok after kicking dev1', s == 200, (s, j))
    s, _, _, _ = dev1.call('GET', '/api/me')
    check('kicked dev1 session is invalidated', s == 401, s)
    s, _, _, _ = dev2.call('GET', '/api/me')
    check('dev2 session still active', s == 200, s)
    s, _, _, _ = dev3.call('GET', '/api/me')
    check('dev3 session active', s == 200, s)

    codes = [Client().call('POST', '/api/login', {'username': 'ann_1', 'password': 'bad'})[0] for _ in range(14)]
    check('login is rate-limited', 429 in codes, codes)


def run(mode):
    tmp = tempfile.mkdtemp()
    env = dict(os.environ)
    env.pop('DATABASE_URL', None); env.pop('POSTGRES_URL', None); env.pop('VERCEL', None)
    pg = None
    if mode == 'postgres':
        import pgserver
        pg = pgserver.get_server(os.path.join(tmp, 'pg'), cleanup_mode='stop')
        env['DATABASE_URL'] = pg.get_uri()
    else:
        env['DB_PATH'] = os.path.join(tmp, 't.db')
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'],
                           cwd=os.path.join(ROOT, 'api'), env=env)
    print('\n=== %s ===' % mode)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1); break
            except urllib.error.HTTPError:
                break
            except Exception:
                time.sleep(0.3)
        scenario(mode)
    finally:
        srv.terminate()
        try:
            srv.wait(8)
        except Exception:
            srv.kill()
        if pg:
            pg.cleanup()


if __name__ == '__main__':
    modes = sys.argv[1:] or ['sqlite', 'postgres']
    for m in modes:
        run(m)
    print('\n%s' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails)))
    sys.exit(1 if fails else 0)
