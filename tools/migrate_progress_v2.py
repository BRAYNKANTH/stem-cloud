# -*- coding: utf-8 -*-
"""Migrate every student's saved progress (v1 keys) to progress v2, and check the result.

Uses the database the app uses: DATABASE_URL (Postgres) when set, else the local SQLite file (DB_PATH).
Run it on a Neon branch copy of production first (docs/owner-tasks.md), check, and only then on production.

    python tools/migrate_progress_v2.py --check     # compare only (changes nothing); exit 1 if anything is missing
    python tools/migrate_progress_v2.py --run       # write v2 rows from v1, then compare

The rules are those of the dual-write (stemcloud/progress_bridge.py) and only ever add, so a second run, or a run
after students have used the new pages, changes nothing that is already there. --check rebuilds what each student's
v2 should contain from their v1 keys alone (in a scratch SQLite database) and verifies the real v2 rows have at
least that: XP, badges, days, steps, best stars, question attempts and preferences.
"""
import os, sqlite3, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from stemcloud import db as dbmod, migrations  # noqa: E402
from stemcloud.progress_bridge import apply_all  # noqa: E402

# what has to be there, per table: the key columns, and how a value compares ("ge": at least, "le": at most / earlier)
COMPARE = {
    'xp_events': (('event_id',), {'amount': 'ge'}),
    'badges': (('badge_id',), {}),
    'activity_days': (('day',), {}),
    'step_progress': (('lesson_id', 'step_id'), {'opened_at': 'le', 'done_at': 'le'}),
    'game_scores': (('game_id', 'level'), {'best_stars': 'ge'}),
    'question_attempts': (('question_id',), {'attempts': 'ge', 'ever_correct': 'ge', 'first_try_correct': 'ge'}),
}


def users_with_progress(con):
    out = {}
    for r in con.execute('SELECT user_id,k,v,updated_at FROM progress ORDER BY user_id').fetchall():
        out.setdefault(r['user_id'], {})[r['k']] = (r['v'], r['updated_at'])
    return out


def scratch():
    """An empty SQLite database with the app's schema, to rebuild one student's expected v2 rows in."""
    raw = sqlite3.connect(os.path.join(tempfile.mkdtemp(), 'expected.db'))
    raw.row_factory = sqlite3.Row
    pg, dbmod.PG = dbmod.PG, False
    migrations.PG = False
    try:
        migrations.ensure(raw)
    finally:
        dbmod.PG = migrations.PG = pg
    return raw


def expected(uid, keys):
    raw = scratch()
    c = dbmod.Conn.__new__(dbmod.Conn)
    c.raw = raw
    c.execute = lambda sql, params=(): raw.execute(sql, params)          # SQLite placeholders, whatever the real database is
    c.execute("INSERT INTO users(id,username,display_name,pw,role,created_at,last_seen) VALUES(?,?,?,?,?,0,0)", (uid, 'u%d' % uid, 'x', 'x', 'student'))
    apply_all(c, uid, {k: v for k, (v, _) in keys.items()}, lambda k: keys[k][1])
    return raw


def compare(con, uid, exp) -> list:
    problems = []
    for table, (key, vals) in COMPARE.items():
        cols = list(key) + list(vals)
        want = exp.execute('SELECT %s FROM %s WHERE user_id=?' % (','.join(cols), table), (uid,)).fetchall()
        have = {tuple(r[k] for k in key): r for r in con.execute('SELECT %s FROM %s WHERE user_id=?' % (','.join(cols), table), (uid,)).fetchall()}
        for w in want:
            k = tuple(w[c] for c in key)
            h = have.get(k)
            if h is None:
                problems.append('%s %s missing' % (table, k))
                continue
            for c, how in vals.items():
                if w[c] is None:
                    continue
                if h[c] is None or (how == 'ge' and h[c] < w[c]) or (how == 'le' and h[c] > w[c]):
                    problems.append('%s %s: %s is %r, v1 says %r' % (table, k, c, h[c], w[c]))
    xp_want = exp.execute('SELECT xp_total FROM users WHERE id=?', (uid,)).fetchone()['xp_total']
    xp_have = con.execute('SELECT xp_total FROM users WHERE id=?', (uid,)).fetchone()
    if xp_have is None or xp_have['xp_total'] < xp_want:
        problems.append('xp_total %r < %r' % (xp_have and xp_have['xp_total'], xp_want))
    prefs = exp.execute('SELECT lang,theme FROM user_prefs WHERE user_id=?', (uid,)).fetchone()
    if prefs:
        have = con.execute('SELECT lang,theme FROM user_prefs WHERE user_id=?', (uid,)).fetchone()
        for f in ('lang', 'theme'):
            if prefs[f] and not (have and have[f]):
                problems.append('user_prefs %s missing' % f)
    return problems


def main():
    run = '--run' in sys.argv
    if not run and '--check' not in sys.argv:
        sys.exit(__doc__)
    print('Database: %s' % ('Postgres (DATABASE_URL)' if dbmod.PG else 'SQLite ' + dbmod.DB_PATH))
    with dbmod.db() as con:
        students = users_with_progress(con)
    skipped = {}
    if run:
        for uid, keys in students.items():
            with dbmod.db() as con:                 # one transaction per student
                for k in apply_all(con, uid, {k: v for k, (v, _) in keys.items()}, lambda k, keys=keys: keys[k][1]):
                    skipped[k] = skipped.get(k, 0) + 1
        print('migrated %d student(s)' % len(students))
    bad = 0
    with dbmod.db() as con:
        for uid, keys in students.items():
            problems = compare(con, uid, expected(uid, keys))
            if problems:
                bad += 1
                print('student %d: %d difference(s), e.g. %s' % (uid, len(problems), '; '.join(problems[:3])))
    if skipped:
        print('v1 keys kept in v1 only (not part of progress v2): %s' % ', '.join(sorted({k.rstrip('0123456789_') for k in skipped})[:20]))
    print('%d of %d student(s) with v1 progress have everything in v2' % (len(students) - bad, len(students)))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
