# -*- coding: utf-8 -*-
"""Backend units added by the split: schema migrations and the lesson gate cookie.

    python tests/test_backend.py
"""
import os, sqlite3, sys, tempfile, time, unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP = tempfile.mkdtemp()
# stemcloud reads its settings once, at import
for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
    os.environ.pop(k, None)
os.environ['DB_PATH'] = os.path.join(TMP, 'fresh.db')
os.environ['GATE_SECRET'] = 'test-gate-secret'

from fastapi.testclient import TestClient  # noqa: E402
from stemcloud import db as dbmod, migrations, security  # noqa: E402
from stemcloud.routers import lessons, pages, past_papers  # noqa: E402
from stemcloud.main import app  # noqa: E402

H = {'X-Requested-With': 'stemcloud'}

# The tables exactly as the single-file backend first created them, before device_name and schema_migrations existed.
OLD_SCHEMA = [
    "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, pw TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)",
    'CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires INTEGER NOT NULL)',
    'CREATE TABLE progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, k TEXT NOT NULL, v TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, k))',
    'CREATE TABLE ratelimit(name TEXT NOT NULL, ip TEXT NOT NULL, ts INTEGER NOT NULL)',
]


def gate_cookie(resp):
    for header in resp.headers.get_list('set-cookie'):
        if header.startswith(security.GATE_COOKIE + '='):
            return header
    return None


class Migrations(unittest.TestCase):
    def use_db(self, path):
        patcher = patch.object(dbmod, 'DB_PATH', path)
        patcher.start(); self.addCleanup(patcher.stop)
        migrations._ready = False

    def test_fresh_database_gets_every_migration(self):
        self.use_db(os.path.join(TMP, 'm-fresh.db'))
        with dbmod.db() as con:
            versions = migrations.applied(con.raw)
            tables = {r['name'] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        self.assertEqual(versions, [v for v, _, _ in migrations.MIGRATIONS])
        self.assertTrue({'users', 'sessions', 'progress', 'ratelimit', 'past_attempts', 'past_bookmarks', 'schema_migrations'} <= tables)
        self.assertTrue({'progress_events', 'step_progress', 'question_attempts', 'game_scores', 'xp_events', 'badges', 'activity_days', 'user_prefs'} <= tables)

    def test_existing_production_style_database_is_upgraded_in_place(self):
        path = os.path.join(TMP, 'm-old.db')
        raw = sqlite3.connect(path)
        for stmt in OLD_SCHEMA:
            raw.execute(stmt)
        raw.execute("INSERT INTO users(username,display_name,pw,role,created_at,last_seen) VALUES('ann','Ann','x','admin',1,1)")
        raw.execute("INSERT INTO progress(user_id,k,v,updated_at) VALUES(1,'scx_xp_total','120',1)")
        raw.commit(); raw.close()
        self.use_db(path)
        with dbmod.db() as con:
            self.assertEqual(migrations.applied(con.raw), [1, 2])
            self.assertEqual(con.execute('SELECT xp_total FROM users').fetchone()['xp_total'], 0)      # progress v2's XP total, empty until migrated
            cols = [r['name'] for r in con.execute('PRAGMA table_info(sessions)').fetchall()]
            self.assertIn('device_name', cols)
            self.assertEqual(con.execute("SELECT v FROM progress WHERE k='scx_xp_total'").fetchone()['v'], '120')
        migrations._ready = False          # a second cold start applies nothing again
        with dbmod.db() as con:
            self.assertEqual(migrations.applied(con.raw), [1, 2])


class GateCookie(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dbmod.DB_PATH = os.path.join(TMP, 'gate.db')
        migrations._ready = False
        cls.client = TestClient(app)
        cls.client.__enter__()
        r = cls.client.post('/api/signup', headers=H, json={'username': 'gate_admin', 'password': 'gate-password-1'})
        assert r.status_code == 200, r.text
        cls.uid = r.json()['user']['id']
        cls.signup = r

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_login_sets_a_valid_short_lived_gate(self):
        header = gate_cookie(self.signup)
        self.assertIsNotNone(header)
        self.assertIn('HttpOnly', header); self.assertIn('Path=/', header); self.assertIn('Max-Age=86400', header)
        value = self.client.cookies.get(security.GATE_COOKIE)
        self.assertEqual(security.check_gate(value), self.uid)

    def test_forged_tampered_and_expired_gates_are_rejected(self):
        good = security.gate_value(self.uid)
        v, uid, exp, sig = good.split('.')
        self.assertIsNone(security.check_gate('.'.join([v, str(self.uid + 1), exp, sig])))      # someone else's id
        self.assertIsNone(security.check_gate('.'.join([v, uid, str(int(exp) + 999), sig])))   # extended expiry
        self.assertIsNone(security.check_gate(good[:-2] + 'xx'))
        self.assertIsNone(security.check_gate('v1.1.2'))
        self.assertIsNone(security.check_gate(''))
        self.assertIsNone(security.check_gate(good, now=int(exp)))                              # expired
        with patch.object(security, 'GATE_SECRET', 'another-secret'):
            self.assertIsNone(security.check_gate(good))

    def test_me_refreshes_and_logout_clears_the_gate(self):
        old = security.gate_value(self.uid, now=int(time.time()) - 3600)
        me = self.client.get('/api/me')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['user']['id'], self.uid)
        header = gate_cookie(me)
        self.assertIsNotNone(header, 'GET /api/me must refresh the gate')
        fresh = header.split(';', 1)[0].split('=', 1)[1]
        self.assertNotEqual(fresh, old)
        self.assertEqual(security.check_gate(fresh), self.uid)

        r = self.client.post('/api/login', headers=H, json={'username': 'gate_admin', 'password': 'gate-password-1'})
        self.assertEqual(r.status_code, 200, r.text)
        out = self.client.post('/api/logout', headers=H)
        header = gate_cookie(out)
        self.assertIsNotNone(header)
        self.assertTrue('Max-Age=0' in header or 'expires=Thu, 01 Jan 1970' in header, header)
        self.assertIsNone(self.client.cookies.get(security.GATE_COOKIE))
        r = self.client.post('/api/login', headers=H, json={'username': 'gate_admin', 'password': 'gate-password-1'})
        self.assertEqual(r.status_code, 200, r.text)

    def test_no_gate_cookie_without_a_secret(self):
        with patch.object(security, 'GATE_SECRET', ''):
            fresh = TestClient(app)
            r = fresh.post('/api/login', headers=H, json={'username': 'gate_admin', 'password': 'gate-password-1', 'kick_device': 'all'})
            self.assertEqual(r.status_code, 200, r.text)
            self.assertIsNone(gate_cookie(r))
            self.assertIsNone(security.check_gate(security.gate_value(self.uid)))


class HomeRoute(unittest.TestCase):
    """/ sends signed-in students to their lessons (the installed app opens /) and shows everyone else the Home page:
    the Astro build when it is bundled, the original page otherwise."""

    def setUp(self):
        dbmod.DB_PATH = os.path.join(TMP, 'home.db')
        migrations._ready = False
        self.built = Path(TMP) / 'web-home.html'
        self.built.write_text('<!doctype html><meta name="generator" content="Astro test"><title>Astro home</title>', encoding='utf-8')

    def get_root(self, client, path='/'):
        return client.get(path, follow_redirects=False)

    def test_visitor_gets_the_astro_home_when_built(self):
        with patch.object(pages, 'WEB_HOME', self.built):
            r = self.get_root(TestClient(app))
        self.assertEqual(r.status_code, 200)
        self.assertIn('Astro home', r.text)
        self.assertEqual(r.headers['cache-control'], 'no-cache')
        self.assertTrue(r.headers['content-type'].startswith('text/html'))

    def test_visitor_gets_the_original_home_without_a_build(self):
        with patch.object(pages, 'WEB_HOME', Path(TMP) / 'missing.html'):
            r = self.get_root(TestClient(app))
        self.assertEqual(r.status_code, 200)
        self.assertIn('STEM Cloud', r.text)
        self.assertNotIn('Astro home', r.text)

    def test_signed_in_student_goes_to_lessons_unless_asking_for_home(self):
        client = TestClient(app)
        r = client.post('/api/signup', headers=H, json={'username': 'home_admin', 'password': 'home-password-1'})
        if r.status_code != 200:            # an earlier test class created the first account in this database
            r = client.post('/api/login', headers=H, json={'username': 'home_admin', 'password': 'home-password-1'})
        self.assertEqual(r.status_code, 200, r.text)
        with patch.object(pages, 'WEB_HOME', self.built):
            r = self.get_root(client)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/lessons/index.html'))
            r = self.get_root(client, '/?home=1')
            self.assertEqual(r.status_code, 200)
            self.assertIn('Astro home', r.text)


class LoginRoute(unittest.TestCase):
    """/login: a signed-in visitor goes on to a safe ?next=; everyone else gets the login page (Astro build when bundled)."""

    def setUp(self):
        dbmod.DB_PATH = os.path.join(TMP, 'login.db')
        migrations._ready = False
        self.shell = Path(TMP) / 'shell'
        (self.shell / 'login').mkdir(parents=True, exist_ok=True)
        (self.shell / 'login' / 'index.html').write_text('<!doctype html><title>Astro login</title>', encoding='utf-8')

    def test_visitor_gets_the_astro_login_when_built_and_the_original_otherwise(self):
        with patch.object(pages, 'WEB_SHELL', self.shell):
            r = TestClient(app).get('/login?next=/account', follow_redirects=False)
        self.assertEqual(r.status_code, 200)
        self.assertIn('Astro login', r.text)
        self.assertEqual(r.headers['cache-control'], 'no-cache')
        with patch.object(pages, 'WEB_SHELL', Path(TMP) / 'no-shell'):
            r = TestClient(app).get('/login', follow_redirects=False)
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('Astro login', r.text)

    def test_signed_in_visitor_goes_to_a_safe_next_only(self):
        client = TestClient(app)
        r = client.post('/api/signup', headers=H, json={'username': 'login_admin', 'password': 'login-password-1'})
        if r.status_code != 200:
            r = client.post('/api/login', headers=H, json={'username': 'login_admin', 'password': 'login-password-1', 'kick_device': 'all'})
        self.assertEqual(r.status_code, 200, r.text)
        with patch.object(pages, 'WEB_SHELL', self.shell):
            for nxt, where in (('/account', '/account'), ('//evil.example', '/lessons/index.html'), ('https://evil.example', '/lessons/index.html')):
                r = client.get('/login', params={'next': nxt}, follow_redirects=False)
                self.assertEqual((r.status_code, r.headers['location']), (302, where), nxt)


class AccountRoute(unittest.TestCase):
    """/account: not signed in -> the login page (and back afterwards); signed in -> the account page."""

    def test_visitor_is_sent_to_login_and_student_gets_the_page(self):
        dbmod.DB_PATH = os.path.join(TMP, 'account.db')
        migrations._ready = False
        shell = Path(TMP) / 'shell-account'
        (shell / 'account').mkdir(parents=True, exist_ok=True)
        (shell / 'account' / 'index.html').write_text('<!doctype html><title>Astro account</title>', encoding='utf-8')
        client = TestClient(app)
        with patch.object(pages, 'WEB_SHELL', shell):
            r = client.get('/account', follow_redirects=False)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=/account'))
            r = client.post('/api/signup', headers=H, json={'username': 'acct_admin', 'password': 'acct-password-1'})
            self.assertEqual(r.status_code, 200, r.text)
            r = client.get('/account', follow_redirects=False)
            self.assertEqual(r.status_code, 200)
            self.assertIn('Astro account', r.text)
            self.assertEqual(r.headers['cache-control'], 'no-store')     # the security middleware: personal pages are never stored


class AdminRoute(unittest.TestCase):
    """/admin: visitor -> login page; student -> 403; admin -> the admin page."""

    def test_only_admins_get_the_page(self):
        dbmod.DB_PATH = os.path.join(TMP, 'admin.db')
        migrations._ready = False
        shell = Path(TMP) / 'shell-admin'
        (shell / 'admin').mkdir(parents=True, exist_ok=True)
        (shell / 'admin' / 'index.html').write_text('<!doctype html><title>Astro admin</title>', encoding='utf-8')
        admin, student = TestClient(app), TestClient(app)
        with patch.object(pages, 'WEB_SHELL', shell):
            r = admin.get('/admin', follow_redirects=False)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=/admin'))
            self.assertEqual(admin.post('/api/signup', headers=H, json={'username': 'adm_one', 'password': 'admin-password-1'}).status_code, 200)
            r = admin.post('/api/admin/create-user', headers=H, json={'username': 'stu_one', 'password': 'student-password-1', 'role': 'student'})
            self.assertEqual(r.status_code, 200, r.text)
            self.assertEqual(student.post('/api/login', headers=H, json={'username': 'stu_one', 'password': 'student-password-1'}).status_code, 200)
            r = student.get('/admin', follow_redirects=False)
            self.assertEqual(r.status_code, 403)
            self.assertNotIn('Astro admin', r.text)
            r = admin.get('/admin', follow_redirects=False)
            self.assertEqual(r.status_code, 200)
            self.assertIn('Astro admin', r.text)
            self.assertEqual(r.headers['cache-control'], 'no-store')


class LearnRoute(unittest.TestCase):
    """/learn/<subject>/g<grade>/<chapter>/: the lessons built from content/, signed-in students only."""
    URL = '/learn/physics/g10/motion-in-a-straight-line/'

    @classmethod
    def setUpClass(cls):
        dbmod.DB_PATH = os.path.join(TMP, 'learn.db')
        migrations._ready = False
        cls.shell = Path(TMP) / 'private-learn'
        page = cls.shell / 'physics' / 'g10' / 'motion-in-a-straight-line'
        page.mkdir(parents=True, exist_ok=True)
        (page / 'index.html').write_text('<!doctype html><title>Astro lesson</title>', encoding='utf-8')
        topic = page / 'topics' / 'acceleration'
        topic.mkdir(parents=True, exist_ok=True)
        (page / 'topics' / 'index.html').write_text('<!doctype html><title>Astro topics</title>', encoding='utf-8')
        (topic / 'index.html').write_text('<!doctype html><title>Astro topic</title>', encoding='utf-8')
        cls.signed_in = TestClient(app)          # the first account on a fresh database may sign itself up
        r = cls.signed_in.post('/api/signup', headers=H, json={'username': 'learn_one', 'password': 'learn-password-1'})
        assert r.status_code == 200, r.text

    def test_visitor_is_sent_to_login_and_back(self):
        with patch.object(lessons, 'WEB_LEARN', self.shell):
            for url in (self.URL, self.URL.rstrip('/')):
                r = TestClient(app).get(url, follow_redirects=False)
                self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=' + self.URL))
                self.assertNotIn('Astro lesson', r.text)

    def test_student_gets_the_built_lesson_never_stored(self):
        client = self.signed_in
        with patch.object(lessons, 'WEB_LEARN', self.shell):
            r = client.get(self.URL, follow_redirects=False)
        self.assertEqual(r.status_code, 200)
        self.assertIn('Astro lesson', r.text)
        self.assertEqual(r.headers['cache-control'], 'no-store')

    def test_without_a_build_the_current_lesson_page(self):
        client = self.signed_in
        with patch.object(lessons, 'WEB_LEARN', Path(TMP) / 'no-shell'):
            r = client.get(self.URL, follow_redirects=False)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/lessons/unit-02-motion-in-a-straight-line.html'))
            self.assertEqual(client.get('/learn/physics/g10/no-such-chapter/', follow_redirects=False).status_code, 404)

    def test_bad_paths_are_not_found(self):
        client = self.signed_in
        with patch.object(lessons, 'WEB_LEARN', self.shell):
            for url in ('/learn/physics/10/motion-in-a-straight-line/', '/learn/Physics/g10/x/', '/learn/physics/g10/a_b/'):
                self.assertEqual(client.get(url, follow_redirects=False).status_code, 404, url)

    def test_only_listed_current_lessons_offer_the_new_one(self):
        r = self.signed_in.get('/lessons/unit-02-motion-in-a-straight-line.html')
        self.assertEqual(r.status_code, 200)
        self.assertIn('stem-try-new', r.text)
        self.assertIn('"/learn/physics/g10/motion-in-a-straight-line/"', r.text)
        r = self.signed_in.get('/lessons/chapter-05-friction.html')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('stem-try-new', r.text)

    def test_topic_pages_are_login_only_too(self):
        with patch.object(lessons, 'WEB_LEARN', self.shell):
            for url, text in ((self.URL + 'topics/', 'Astro topics'), (self.URL + 'topics/acceleration/', 'Astro topic')):
                r = TestClient(app).get(url, follow_redirects=False)
                self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=' + url))
                r = self.signed_in.get(url.rstrip('/'), follow_redirects=False)
                self.assertEqual(r.status_code, 200, url)
                self.assertIn(text, r.text)
                self.assertEqual(r.headers['cache-control'], 'no-store')
            self.assertEqual(self.signed_in.get(self.URL + 'topics/no-such-topic/', follow_redirects=False).status_code, 404)
            self.assertEqual(self.signed_in.get(self.URL + 'topics/Bad_Topic/', follow_redirects=False).status_code, 404)

    def test_past_paper_banks_come_from_content_behind_login(self):
        self.assertEqual(TestClient(app).get('/lessons/past-papers/2015.json').status_code, 401)
        r = self.signed_in.get('/lessons/past-papers/2015.json')
        self.assertEqual((r.status_code, r.json()['year']), (200, 2015))
        self.assertEqual(self.signed_in.get('/lessons/past-papers/catalog.json').json()['schemaVersion'], 1)
        for bad in ('/lessons/past-papers/1999.json', '/lessons/past-papers/2015x.json'):
            self.assertEqual(self.signed_in.get(bad).status_code, 404, bad)
        self.assertEqual(self.signed_in.get('/lessons/past-papers/2015/page-01.jpg').status_code, 200)      # scans stay where they were

    def test_the_new_past_papers_page_is_login_only(self):
        built = Path(TMP) / 'private-papers' / 'index.html'
        built.parent.mkdir(parents=True, exist_ok=True)
        built.write_text('<!doctype html><title>Astro papers</title>', encoding='utf-8')
        with patch.object(past_papers, 'WEB_PAPERS', built):
            r = TestClient(app).get('/past-papers/', follow_redirects=False)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=/past-papers/'))
            r = self.signed_in.get('/past-papers', follow_redirects=False)
            self.assertEqual(r.status_code, 200)
            self.assertIn('Astro papers', r.text)
            self.assertEqual(r.headers['cache-control'], 'no-store')
        with patch.object(past_papers, 'WEB_PAPERS', Path(TMP) / 'no-papers.html'):
            r = self.signed_in.get('/past-papers/', follow_redirects=False)
            self.assertEqual((r.status_code, r.headers['location']), (302, '/lessons/past-papers.html'))
        r = self.signed_in.get('/lessons/past-papers.html')
        self.assertIn('/past-papers/', r.text)                 # the current page offers the new one
        self.assertIn('Try the new past papers', r.text)

    def test_the_build_path_goes_through_the_check(self):
        r = TestClient(app).get('/shell/learn/physics/g10/motion-in-a-straight-line/', follow_redirects=False)
        self.assertEqual((r.status_code, r.headers['location']), (302, self.URL))


class ProgressV2Deletion(unittest.TestCase):
    """Deleting an account removes its v2 progress too (child privacy: nothing is kept)."""

    def test_account_delete_removes_v2_rows(self):
        dbmod.DB_PATH = os.path.join(TMP, 'v2-delete.db')
        migrations._ready = False
        c = TestClient(app)
        self.assertEqual(c.post('/api/signup', headers=H, json={'username': 'del_me', 'password': 'delete-me-123'}).status_code, 200)
        t = int(time.time()) - 60
        ev = [{'id': 'del-%04d' % i, 'type': k, 'at': t, **x} for i, (k, x) in enumerate([
            ('step_done', {'lesson': 'physics.g10.friction', 'step': 'notes'}), ('answer', {'question': 'physics.g10.friction/q1', 'correct': True}),
            ('xp', {'source': 'q1', 'amount': 5}), ('badge', {'badge': 'b1'}), ('day', {'day': '2026-10-12'}), ('prefs', {'lang': 'ta'}),
            ('game', {'game': 'physics.g10.friction/pushit', 'level': 1, 'stars': 3})])]
        self.assertEqual(c.post('/api/v2/events', headers=H, json={'events': ev}).json()['applied'], 7)
        r = c.post('/api/account/delete', headers=H, json={'password': 'delete-me-123'})
        self.assertEqual(r.status_code, 200, r.text)
        with dbmod.db() as con:
            for table in ('progress_events', 'step_progress', 'question_attempts', 'game_scores', 'xp_events', 'badges', 'activity_days', 'user_prefs'):
                self.assertEqual(con.execute('SELECT COUNT(*) AS n FROM %s' % table).fetchone()['n'], 0, table)


V1 = {'scx_xp_total': '135', 'scx_badges': '["quiz_ace","u2_examples_master"]', 'scx_visit_dates': '["2026-10-10","2026-10-11"]',
      'scx_path_u2': '{"story":1,"practice":1,"sortgame":1,"nope":1}', 'scx_story_u2': '1', 'scx_done_c5': '1',
      'scx_speed_stars': '[3,1,0]', 'scx_pushit_stars': '[2]', 'lessonLang': 'ta', 'scx_position_u2': '{"note":2}',
      'scx_topics_u2': '{"distance-displacement":{"v":{"understand":1,"watch":1},"d":{"understand":1},"q":{"m1":{"n":2,"ok":1,"f":0},"xc_1i":{"n":1,"ok":1,"f":1}}}}'}
U2 = 'physics.g10.motion-in-a-straight-line'


class ProgressBridge(unittest.TestCase):
    """v1 -> v2: the dual-write of every v1 save, and the one-off migration with its check."""

    def rows(self, con, uid):
        q = lambda sql: [tuple(r) for r in con.execute(sql, (uid,)).fetchall()]
        return {
            'steps': sorted(q('SELECT lesson_id,step_id,done_at IS NOT NULL FROM step_progress WHERE user_id=?')),
            'badges': sorted(q('SELECT badge_id FROM badges WHERE user_id=?')),
            'days': sorted(q('SELECT day FROM activity_days WHERE user_id=?')),
            'games': sorted(q('SELECT game_id,level,best_stars FROM game_scores WHERE user_id=?')),
            'questions': sorted(q('SELECT question_id,attempts,ever_correct,first_try_correct FROM question_attempts WHERE user_id=?')),
            'xp': con.execute('SELECT xp_total FROM users WHERE id=?', (uid,)).fetchone()['xp_total'],
            'lang': (con.execute('SELECT lang FROM user_prefs WHERE user_id=?', (uid,)).fetchone() or {'lang': None})['lang'],
        }

    def test_a_v1_save_also_writes_v2(self):
        dbmod.DB_PATH = os.path.join(TMP, 'bridge-dual.db')
        migrations._ready = False
        c = TestClient(app)
        self.assertEqual(c.post('/api/signup', headers=H, json={'username': 'dual_one', 'password': 'dual-write-123'}).status_code, 200)
        self.assertEqual(c.put('/api/progress', headers=H, json=V1).status_code, 200)
        with dbmod.db() as con:
            uid = con.execute("SELECT id FROM users WHERE username='dual_one'").fetchone()['id']
            r = self.rows(con, uid)
        self.assertEqual(r['xp'], 135)
        self.assertEqual(r['badges'], [('quiz_ace',), ('u2_examples_master',)])
        self.assertEqual(r['days'], [('2026-10-10',), ('2026-10-11',)])
        self.assertEqual(r['lang'], 'ta')
        steps = set(r['steps'])
        # the page's own section ids, mapped per lesson: in unit 2 "practice" is the worked examples
        for step in ('story', 'worked', 'sort'):
            self.assertIn((U2, step, 1), steps)
        self.assertIn(('physics.g10.friction', 'finish', 1), steps)
        self.assertIn((U2, 'topic:distance-displacement:understand', 1), steps)
        self.assertIn((U2, 'topic:distance-displacement:watch', 0), steps)          # opened, not done
        self.assertNotIn('nope', {s for _, s, _ in steps})
        self.assertIn((U2 + '/holdgame', 0, 3), r['games'])
        self.assertIn(('physics.g10.friction/pushit', 0, 2), r['games'])
        self.assertEqual(r['questions'], [(U2 + '/q1', 2, 1, 0), (U2 + '/xc-1i', 1, 1, 1)])
        # more v1 XP later: the legacy total follows it; v2 XP from the new pages adds on top, once
        c.put('/api/progress', headers=H, json={'scx_xp_total': '150'})
        c.post('/api/v2/events', headers=H, json={'events': [{'id': 'dual-xp-0001', 'type': 'xp', 'at': int(time.time()) - 5, 'source': 'q1', 'amount': 10}]})
        c.put('/api/progress', headers=H, json={'scx_xp_total': '150'})
        with dbmod.db() as con:
            self.assertEqual(self.rows(con, uid)['xp'], 160)

    def test_the_migration_fills_v2_and_checks_it(self):
        from tools import migrate_progress_v2 as mig
        dbmod.DB_PATH = os.path.join(TMP, 'bridge-mig.db')
        migrations._ready = False
        with dbmod.db() as con:       # progress saved before the dual-write existed: v1 rows only
            con.execute("INSERT INTO users(username,display_name,pw,role,created_at,last_seen) VALUES('old_one','Old','x','student',1,1)")
            uid = con.execute("SELECT id FROM users WHERE username='old_one'").fetchone()['id']
            for k, v in V1.items():
                con.execute('INSERT INTO progress(user_id,k,v,updated_at) VALUES(?,?,?,?)', (uid, k, v, 1760000000))
        run = lambda *a: patch.object(sys, 'argv', ['migrate'] + list(a))
        with run('--check'), self.assertRaises(SystemExit) as e:
            mig.main()
        self.assertEqual(e.exception.code, 1)                      # nothing in v2 yet
        with run('--run'), self.assertRaises(SystemExit) as e:
            mig.main()
        self.assertEqual(e.exception.code, 0)
        with dbmod.db() as con:
            first = self.rows(con, uid)
        self.assertEqual(first['xp'], 135)
        with run('--run'), self.assertRaises(SystemExit) as e:     # a second run changes nothing
            mig.main()
        with dbmod.db() as con:
            self.assertEqual(self.rows(con, uid), first)
            con.execute('DELETE FROM badges WHERE user_id=?', (uid,))
        with run('--check'), self.assertRaises(SystemExit) as e:   # and the check notices a gap
            mig.main()
        self.assertEqual(e.exception.code, 1)


class HealthMedia(unittest.TestCase):
    """/healthz says how media is served, so a deployment can be checked without logging in."""
    R2 = {'R2_MEDIA_ENABLED': '1', 'R2_ACCOUNT_ID': 'a' * 32, 'R2_ACCESS_KEY_ID': 'key-id-value',
          'R2_SECRET_ACCESS_KEY': 'secret-value', 'R2_BUCKET_PRIVATE': 'bucket-name'}

    def health(self, env):
        with patch.dict(os.environ, env):
            r = TestClient(app).get('/healthz')
        self.assertEqual(r.status_code, 200, r.text)
        for value in self.R2.values():
            if value != '1':
                self.assertNotIn(value, r.text)        # never echoes a setting
        return r.json()['media']

    def test_local_when_switched_off(self):
        self.assertEqual(self.health({'R2_MEDIA_ENABLED': '0'}), 'local')

    def test_r2_when_switched_on_and_complete(self):
        self.assertEqual(self.health(self.R2), 'r2')

    def test_incomplete_when_a_key_is_missing(self):
        self.assertEqual(self.health(dict(self.R2, R2_SECRET_ACCESS_KEY='')), 'r2-incomplete')
        self.assertEqual(self.health(dict(self.R2, R2_ACCOUNT_ID='not-an-account-id')), 'r2-incomplete')

    def test_incomplete_names_the_settings_to_fix(self):
        with patch.dict(os.environ, dict(self.R2, R2_SECRET_ACCESS_KEY='', R2_ACCOUNT_ID='not-an-account-id')):
            body = TestClient(app).get('/healthz').json()
        self.assertEqual(body['media_problems'], ['R2_SECRET_ACCESS_KEY is missing',
                                                  'R2_ACCOUNT_ID is not a 32-character account ID (17 characters)'])
        self.assertNotIn('not-an-account-id', str(body))
        with patch.dict(os.environ, self.R2):
            self.assertNotIn('media_problems', TestClient(app).get('/healthz').json())


class AssetLinks(unittest.TestCase):
    """/.well-known/assetlinks.json names the Play Store app (Phase 10) only once its package and fingerprint are set."""
    PRINT = ':'.join(['AB'] * 32)

    def get(self, env):
        with patch.dict(os.environ, env):
            return TestClient(app).get('/.well-known/assetlinks.json')

    def test_not_found_until_set(self):
        self.assertEqual(self.get({'ANDROID_PACKAGE': '', 'ANDROID_CERT_SHA256': ''}).status_code, 404)
        self.assertEqual(self.get({'ANDROID_PACKAGE': 'site.stemcloud.app', 'ANDROID_CERT_SHA256': ''}).status_code, 404)

    def test_bad_values_are_refused(self):
        self.assertEqual(self.get({'ANDROID_PACKAGE': 'site.stemcloud.app', 'ANDROID_CERT_SHA256': 'not-a-fingerprint'}).status_code, 404)
        self.assertEqual(self.get({'ANDROID_PACKAGE': 'Not A Package', 'ANDROID_CERT_SHA256': self.PRINT}).status_code, 404)

    def test_names_the_app(self):
        r = self.get({'ANDROID_PACKAGE': 'site.stemcloud.app', 'ANDROID_CERT_SHA256': self.PRINT.lower() + ' , ' + ':'.join(['CD'] * 32)})
        self.assertEqual(r.status_code, 200)
        target = r.json()[0]['target']
        self.assertEqual(r.json()[0]['relation'], ['delegate_permission/common.handle_all_urls'])
        self.assertEqual((target['namespace'], target['package_name']), ('android_app', 'site.stemcloud.app'))
        self.assertEqual(target['sha256_cert_fingerprints'], [self.PRINT, ':'.join(['CD'] * 32)])


if __name__ == '__main__':
    unittest.main()
