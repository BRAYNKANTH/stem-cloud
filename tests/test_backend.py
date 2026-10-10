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
            self.assertEqual(migrations.applied(con.raw), [1])
            cols = [r['name'] for r in con.execute('PRAGMA table_info(sessions)').fetchall()]
            self.assertIn('device_name', cols)
            self.assertEqual(con.execute("SELECT v FROM progress WHERE k='scx_xp_total'").fetchone()['v'], '120')
        migrations._ready = False          # a second cold start applies nothing again
        with dbmod.db() as con:
            self.assertEqual(migrations.applied(con.raw), [1])


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


if __name__ == '__main__':
    unittest.main()
