# -*- coding: utf-8 -*-
"""The kept Postgres connections (stemcloud/db.py): reused between requests, checked or dropped when they sat unused, never
shared by two requests at once, and not kept when broken. Uses stand-in connections: no database is needed.

    python tests/test_db_pool.py
"""
import os, sys, tempfile, threading, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
    os.environ.pop(k, None)
os.environ['DB_PATH'] = os.path.join(tempfile.mkdtemp(), 'pool.db')

from fastapi import HTTPException  # noqa: E402
from stemcloud import db as dbm, migrations  # noqa: E402


class Fake:
    """A stand-in for a psycopg connection."""
    made = 0

    def __init__(self):
        Fake.made += 1
        self.closed = False
        self.sql = []
        self.commits = 0
        self.rollbacks = 0
        self.dead = False                 # the server has dropped it: any statement fails
        self.rollback_fails = False

    def execute(self, sql, params=()):
        if self.dead:
            raise RuntimeError('connection lost')
        self.sql.append(sql)

    def commit(self):
        self.commits += 1

    def rollback(self):
        if self.rollback_fails:
            raise RuntimeError('cannot roll back')
        self.rollbacks += 1

    def close(self):
        self.closed = True


class Pool(unittest.TestCase):
    def setUp(self):
        self.saved = (dbm.PG, dbm._connect, dbm.time.monotonic, migrations._ready)
        dbm.PG = True
        Fake.made = 0
        self.clock = [1000.0]
        dbm._connect = Fake
        dbm.time.monotonic = lambda: self.clock[0]
        migrations._ready = True
        dbm._IDLE.clear()

    def tearDown(self):
        dbm.PG, dbm._connect, dbm.time.monotonic, migrations._ready = self.saved
        dbm._IDLE.clear()

    def use(self):
        with dbm.db() as con:
            return con.raw

    def test_a_connection_is_used_again(self):
        a = self.use()
        self.assertEqual((self.use() is a, Fake.made, a.commits), (True, 1, 2))

    def test_an_error_rolls_back_and_the_connection_is_still_kept(self):
        with self.assertRaises(HTTPException):
            with dbm.db() as con:
                a = con.raw
                raise HTTPException(401, 'no')
        self.assertEqual((a.rollbacks, a.closed), (1, False))
        self.assertIs(self.use(), a)

    def test_a_connection_that_cannot_roll_back_is_not_kept(self):
        with self.assertRaises(ValueError):
            with dbm.db() as con:
                a = con.raw
                a.rollback_fails = True
                raise ValueError('boom')
        self.assertTrue(a.closed)
        self.assertIsNot(self.use(), a)

    def test_one_that_sat_unused_for_a_while_is_checked_first(self):
        a = self.use()
        self.clock[0] += dbm.TRUST_FOR + 1
        self.assertIs(self.use(), a)
        self.assertEqual(a.sql.count('SELECT 1'), 1)

    def test_a_dead_one_is_dropped_and_a_new_one_made(self):
        a = self.use()
        a.dead = True
        self.clock[0] += dbm.TRUST_FOR + 1
        b = self.use()
        self.assertEqual((b is a, a.closed, Fake.made), (False, True, 2))

    def test_one_unused_for_long_is_closed_without_a_check(self):
        a = self.use()
        self.clock[0] += dbm.DROP_AFTER + 1
        b = self.use()
        self.assertEqual((b is a, a.closed, 'SELECT 1' in a.sql), (False, True, False))

    def test_a_recently_used_one_is_not_checked(self):
        a = self.use()
        self.clock[0] += dbm.TRUST_FOR - 1
        self.use()
        self.assertNotIn('SELECT 1', a.sql)

    def test_two_requests_at_once_never_share_a_connection_and_only_a_few_are_kept(self):
        n = dbm.MAX_IDLE + 3
        inside, release = threading.Barrier(n), threading.Event()
        raws = []

        def request():
            with dbm.db() as con:
                raws.append(con.raw)
                inside.wait(timeout=10)
                release.wait(timeout=10)

        threads = [threading.Thread(target=request) for _ in range(n)]
        for t in threads:
            t.start()
        while len(raws) < n:
            pass
        release.set()
        for t in threads:
            t.join()
        self.assertEqual(len({id(r) for r in raws}), n)
        self.assertEqual(len(dbm._IDLE), dbm.MAX_IDLE)
        self.assertEqual(sum(r.closed for r in raws), n - dbm.MAX_IDLE)

    def test_sqlite_is_not_kept(self):
        dbm.PG = False
        dbm._connect = self.saved[1]
        with dbm.db() as con:
            self.assertFalse(isinstance(con.raw, Fake))
        self.assertEqual(len(dbm._IDLE), 0)


if __name__ == '__main__':
    unittest.main()
