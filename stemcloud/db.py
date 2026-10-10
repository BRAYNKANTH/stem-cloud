"""Database connections: Postgres on Vercel (DATABASE_URL), a SQLite file locally."""
import os, sqlite3
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


@contextmanager
def db():
    if ON_VERCEL and not PG:
        raise HTTPException(503, 'Database is not set up yet: add DATABASE_URL in the Vercel project settings.')
    from . import migrations
    raw = _connect()
    try:
        if not migrations.ready():
            migrations.ensure(raw)
        yield Conn(raw)
        raw.commit()
    except BaseException:
        raw.rollback()
        raise
    finally:
        raw.close()
