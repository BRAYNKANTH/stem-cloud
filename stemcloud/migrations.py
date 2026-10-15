"""Versioned schema changes, applied on the first connection of each server instance.

Each migration runs once per database and is recorded in schema_migrations. Migrations must be safe on a
database that already has the tables (production was created before this runner existed), so they use
IF NOT EXISTS. Add new ones at the end of MIGRATIONS; never edit or reorder one that has shipped.
"""
import time

from .db import PG, Conn

_ready = False


def _baseline(c):
    """The schema as it was created by the single-file backend (api/index.py before the split)."""
    _id = 'BIGSERIAL PRIMARY KEY' if PG else 'INTEGER PRIMARY KEY AUTOINCREMENT'
    _int = 'BIGINT' if PG else 'INTEGER'
    for stmt in [
        'CREATE TABLE IF NOT EXISTS users(id %s, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, pw TEXT NOT NULL, '
        "role TEXT NOT NULL DEFAULT 'student', created_at %s NOT NULL, last_seen %s NOT NULL)" % (_id, _int, _int),
        'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
        'created_at %s NOT NULL, expires %s NOT NULL)' % (_int, _int, _int),
        'CREATE TABLE IF NOT EXISTS progress(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, k TEXT NOT NULL, v TEXT NOT NULL, '
        'updated_at %s NOT NULL, PRIMARY KEY(user_id, k))' % (_int, _int),
        'CREATE TABLE IF NOT EXISTS ratelimit(name TEXT NOT NULL, ip TEXT NOT NULL, ts %s NOT NULL)' % _int,
        'CREATE TABLE IF NOT EXISTS past_attempts(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
        'event_id TEXT NOT NULL, question_id TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, '
        'created_at %s NOT NULL, PRIMARY KEY(user_id,event_id))' % (_int, _int),
        'CREATE TABLE IF NOT EXISTS past_bookmarks(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
        'question_id TEXT NOT NULL, PRIMARY KEY(user_id,question_id))' % _int,
        'CREATE INDEX IF NOT EXISTS idx_past_attempts_user ON past_attempts(user_id,created_at)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_ratelimit ON ratelimit(name, ip, ts)',
    ]:
        c.execute(stmt)
    if PG:
        c.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT ''")
    elif 'device_name' not in [r['name'] for r in c.execute('PRAGMA table_info(sessions)').fetchall()]:
        c.execute("ALTER TABLE sessions ADD COLUMN device_name TEXT DEFAULT ''")


def _progress_v2(c):
    """Progress v2 (docs/migration-plan-astro.md, section 3.5): typed tables that only move forward, fed by idempotent
    events (stemcloud/progress_v2.py). The v1 key/value table stays until the cut-over."""
    _int = 'BIGINT' if PG else 'INTEGER'
    ref = '%s NOT NULL REFERENCES users(id) ON DELETE CASCADE' % _int
    for stmt in [
        # every event a device sent, so a repeated one (same event_id) is ignored
        'CREATE TABLE IF NOT EXISTS progress_events(user_id %s, event_id TEXT NOT NULL, kind TEXT NOT NULL, received_at %s NOT NULL, '
        'PRIMARY KEY(user_id, event_id))' % (ref, _int),
        'CREATE TABLE IF NOT EXISTS step_progress(user_id %s, lesson_id TEXT NOT NULL, step_id TEXT NOT NULL, opened_at %s, done_at %s, '
        'PRIMARY KEY(user_id, lesson_id, step_id))' % (ref, _int, _int),
        # first_at: the earliest answer seen, so "right at the first try" does not depend on the order events arrive in
        'CREATE TABLE IF NOT EXISTS question_attempts(user_id %s, question_id TEXT NOT NULL, attempts INTEGER NOT NULL, '
        'ever_correct INTEGER NOT NULL, first_try_correct INTEGER NOT NULL, first_at %s NOT NULL, last_at %s NOT NULL, '
        'PRIMARY KEY(user_id, question_id))' % (ref, _int, _int),
        'CREATE TABLE IF NOT EXISTS game_scores(user_id %s, game_id TEXT NOT NULL, level INTEGER NOT NULL, best_stars INTEGER NOT NULL, '
        'PRIMARY KEY(user_id, game_id, level))' % ref,
        'CREATE TABLE IF NOT EXISTS xp_events(user_id %s, event_id TEXT NOT NULL, source TEXT NOT NULL, amount INTEGER NOT NULL, '
        'created_at %s NOT NULL, PRIMARY KEY(user_id, event_id))' % (ref, _int),
        'CREATE TABLE IF NOT EXISTS badges(user_id %s, badge_id TEXT NOT NULL, earned_at %s NOT NULL, PRIMARY KEY(user_id, badge_id))' % (ref, _int),
        'CREATE TABLE IF NOT EXISTS activity_days(user_id %s, day TEXT NOT NULL, PRIMARY KEY(user_id, day))' % ref,
        'CREATE TABLE IF NOT EXISTS user_prefs(user_id %s PRIMARY KEY, lang TEXT, theme TEXT, motion TEXT, reading_mode TEXT, updated_at %s NOT NULL)' % (ref, _int),
        'CREATE INDEX IF NOT EXISTS idx_step_progress_lesson ON step_progress(user_id, lesson_id)',
    ]:
        c.execute(stmt)
    # the XP total, kept with the user so the home page and admin stay fast (the sum of xp_events)
    if PG:
        c.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_total BIGINT NOT NULL DEFAULT 0')
    elif 'xp_total' not in [r['name'] for r in c.execute('PRAGMA table_info(users)').fetchall()]:
        c.execute('ALTER TABLE users ADD COLUMN xp_total INTEGER NOT NULL DEFAULT 0')


def _learning_feed(c):
    """The learning feed (stemcloud/routers/feed.py): each student's first answer to a feed card, so a card can show
    how everyone answered ("62% chose B"). Only the first answer counts, so trying again cannot tip a poll."""
    _int = 'BIGINT' if PG else 'INTEGER'
    ref = '%s NOT NULL REFERENCES users(id) ON DELETE CASCADE' % _int
    c.execute('CREATE TABLE IF NOT EXISTS feed_answers(user_id %s, card_id TEXT NOT NULL, choice INTEGER NOT NULL, correct INTEGER NOT NULL, '
              'answered_at %s NOT NULL, PRIMARY KEY(user_id, card_id))' % (ref, _int))
    c.execute('CREATE INDEX IF NOT EXISTS idx_feed_answers_card ON feed_answers(card_id)')


MIGRATIONS = [
    (1, 'baseline', _baseline),
    (2, 'progress v2', _progress_v2),
    (3, 'learning feed', _learning_feed),
]


def ready():
    return _ready


def ensure(raw):
    """Apply missing migrations in order. Two cold starts at once wait on one Postgres advisory lock."""
    global _ready
    c = Conn(raw)
    if PG:
        c.execute('SELECT pg_advisory_xact_lock(7364201)')
    c.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at %s NOT NULL)'
              % ('BIGINT' if PG else 'INTEGER'))
    done = {r['version'] for r in c.execute('SELECT version FROM schema_migrations').fetchall()}
    for version, name, apply in MIGRATIONS:
        if version not in done:
            apply(c)
            c.execute('INSERT INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)', (version, name, int(time.time())))
    raw.commit()
    _ready = True


def applied(raw):
    """Versions recorded in this database (for tools and tests)."""
    return [r['version'] for r in Conn(raw).execute('SELECT version FROM schema_migrations ORDER BY version').fetchall()]
