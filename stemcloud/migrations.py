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


MIGRATIONS = [
    (1, 'baseline', _baseline),
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
