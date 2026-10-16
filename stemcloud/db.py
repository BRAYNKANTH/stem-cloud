"""Database connections: Postgres on Vercel (DATABASE_URL), a SQLite file locally."""
import os, sqlite3, threading, time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException

from .config import ON_VERCEL, ROOT


def _pg_url():
    url = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or ''
    if not url:
        return ''
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    parts = urlsplit(url)   # Supabase adds a "supa" parameter that libpq rejects
    q = [(k, v) for k, v in parse_qsl(parts.query) if k != 'supa']
    return urlunsplit(parts._replace(query=urlencode(q)))

PG_URL = _pg_url()
PG = bool(PG_URL)
if PG:
    import psycopg
    from psycopg.rows import dict_row
    INTEGRITY = (psycopg.IntegrityError,)
else:
    INTEGRITY = (sqlite3.IntegrityError,)
DB_PATH = os.environ.get('DB_PATH', str(ROOT / 'data' / 'stemcloud.db'))


class Conn:
    """Thin wrapper so the rest of the code is written once, with ? placeholders."""
    def __init__(self, raw):
        self.raw = raw

    def execute(self, sql, params=()):
        return self.raw.execute(sql.replace('?', '%s') if PG else sql, params)


def _connect():
    if PG:
        # prepare_threshold=None: safe behind Neon / Supabase connection poolers
        return psycopg.connect(PG_URL, row_factory=dict_row, prepare_threshold=None, connect_timeout=10)
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON'); con.execute('PRAGMA journal_mode=WAL')
    return con


# ----------------------------------------------------------------------------- kept connections (Postgres)
# A new Postgres connection costs a TCP connection, TLS and a login: several round trips to the database, on every request.
# A few connections are therefore kept open on the server instance and used again. A connection is used by one request at
# a time (taken out of the list, put back when the request is done, always at a transaction boundary), so nothing of one
# request's session is left for the next. One that sat unused is checked (SELECT 1) before it is used, and one that sat
# unused for long is dropped: a serverless instance can be frozen between requests and its sockets die meanwhile.
MAX_IDLE = 4              # connections kept per server instance
TRUST_FOR = 10            # seconds: unused for less than this, used without a check
DROP_AFTER = 120          # seconds: unused for longer than this, closed instead of reused
_IDLE = []                # [(connection, time last put back)]
_IDLE_LOCK = threading.Lock()


def _close(raw):
    try:
        raw.close()
    except Exception:
        pass


def _checkout():
    """A kept connection that works, or a new one."""
    while True:
        with _IDLE_LOCK:
            item = _IDLE.pop() if _IDLE else None
        if item is None:
            return _connect()
        raw, since = item
        age = time.monotonic() - since
        if age > DROP_AFTER or getattr(raw, 'closed', False) or getattr(raw, 'broken', False):
            _close(raw)
            continue
        if age > TRUST_FOR:
            try:
                raw.execute('SELECT 1')
                raw.rollback()
            except Exception:
                _close(raw)
                continue
        return raw


def _checkin(raw, healthy):
    """Put a connection back for the next request, or close it (broken, or enough are kept already)."""
    if healthy and not getattr(raw, 'closed', False) and not getattr(raw, 'broken', False):
        with _IDLE_LOCK:
            if len(_IDLE) < MAX_IDLE:
                _IDLE.append((raw, time.monotonic()))
                return
    _close(raw)


@contextmanager
def db():
    if ON_VERCEL and not PG:
        raise HTTPException(503, 'Database is not set up yet: add DATABASE_URL in the Vercel project settings.')
    from . import migrations
    raw = _checkout() if PG else _connect()
    healthy = True
    try:
        if not migrations.ready():
            migrations.ensure(raw)
        yield Conn(raw)
        raw.commit()
    except BaseException:
        try:
            raw.rollback()
        except Exception:
            healthy = False
        raise
    finally:
        if PG:
            _checkin(raw, healthy)
        else:
            raw.close()
