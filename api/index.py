# -*- coding: utf-8 -*-
"""STEM Cloud: O/L Physics lessons with accounts, login and saved progress.

Hosted on Vercel (serverless): set DATABASE_URL to a Postgres database (Neon / Vercel Postgres / Supabase).
Local development needs no database: without DATABASE_URL it uses a SQLite file.
    cd api && python -m uvicorn index:app --port 8000

Environment:  DATABASE_URL (Postgres)   ADMIN_USERS (comma separated usernames)   DB_PATH (local SQLite file)
"""
import base64, hashlib, hmac, json, os, re, secrets, sqlite3, time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
LESSONS = (SITE / 'lessons').resolve()
STATIC = ROOT / 'public' / 'static'      # Vercel serves public/ straight from its CDN; the app mounts the same folder for local use and the HTML pages
ON_VERCEL = bool(os.environ.get('VERCEL'))
ADMIN_USERS = {u.strip().lower() for u in os.environ.get('ADMIN_USERS', '').split(',') if u.strip()}      # no built-in admin names: admins are made with tools/manage_admin.py or by an admin
TRUST_PROXY = ON_VERCEL or os.environ.get('TRUST_PROXY') == '1'
SESSION_DAYS = 30
COOKIE = 'sid'
CSRF_VALUE = 'stemcloud'
KEY_RE = re.compile(r'^(scx_[a-z0-9_]{1,60}|lessonLang|lessonTheme)$')
USER_RE = re.compile(r'^[a-z0-9_]{3,20}$')
MAX_KEYS, MAX_VAL = 400, 20000

app = FastAPI(title='STEM Cloud', docs_url=None, redoc_url=None, openapi_url=None)

# ----------------------------------------------------------------------------- database (Postgres on Vercel, SQLite locally)
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

_ID = 'BIGSERIAL PRIMARY KEY' if PG else 'INTEGER PRIMARY KEY AUTOINCREMENT'
_INT = 'BIGINT' if PG else 'INTEGER'
SCHEMA = [
    'CREATE TABLE IF NOT EXISTS users(id %s, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, pw TEXT NOT NULL, '
    "role TEXT NOT NULL DEFAULT 'student', created_at %s NOT NULL, last_seen %s NOT NULL)" % (_ID, _INT, _INT),
    'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
    'created_at %s NOT NULL, expires %s NOT NULL)' % (_INT, _INT, _INT),
    'CREATE TABLE IF NOT EXISTS progress(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, k TEXT NOT NULL, v TEXT NOT NULL, '
    'updated_at %s NOT NULL, PRIMARY KEY(user_id, k))' % (_INT, _INT),
    'CREATE TABLE IF NOT EXISTS ratelimit(name TEXT NOT NULL, ip TEXT NOT NULL, ts %s NOT NULL)' % _INT,
    'CREATE TABLE IF NOT EXISTS past_attempts(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
    'event_id TEXT NOT NULL, question_id TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, '
    'created_at %s NOT NULL, PRIMARY KEY(user_id,event_id))' % (_INT, _INT),
    'CREATE TABLE IF NOT EXISTS past_bookmarks(user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE, '
    'question_id TEXT NOT NULL, PRIMARY KEY(user_id,question_id))' % _INT,
    'CREATE INDEX IF NOT EXISTS idx_past_attempts_user ON past_attempts(user_id,created_at)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ratelimit ON ratelimit(name, ip, ts)',
]
_ready = False


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


def _ensure_schema(raw):
    global _ready
    c = Conn(raw)
    if PG:
        c.execute('SELECT pg_advisory_xact_lock(7364201)')   # two cold starts creating tables at once
    for stmt in SCHEMA:
        c.execute(stmt)
    try:
        # Postgres: IF NOT EXISTS (a failed statement would abort the whole schema transaction); SQLite has no IF NOT EXISTS and raises when the column exists
        c.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT ''" if PG else "ALTER TABLE sessions ADD COLUMN device_name TEXT DEFAULT ''")
    except Exception:
        pass
    raw.commit()
    _ready = True


@contextmanager
def db():
    if ON_VERCEL and not PG:
        raise HTTPException(503, 'Database is not set up yet: add DATABASE_URL in the Vercel project settings.')
    raw = _connect()
    try:
        if not _ready:
            _ensure_schema(raw)
        yield Conn(raw)
        raw.commit()
    except BaseException:
        raw.rollback()
        raise
    finally:
        raw.close()


# ----------------------------------------------------------------------------- passwords and sessions
def hash_pw(pw: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return 'scrypt$%s$%s' % (base64.b64encode(salt).decode(), base64.b64encode(h).decode())

def check_pw(pw: str, stored: str) -> bool:
    try:
        _, s, h = stored.split('$')
        calc = hashlib.scrypt(pw.encode(), salt=base64.b64decode(s), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(calc, base64.b64decode(h))
    except Exception:
        return False

def sha(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()

def client_ip(req: Request) -> str:
    if TRUST_PROXY:
        for h in ('x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for'):
            v = req.headers.get(h)
            if v:
                return v.split(',')[0].strip()[:64]
    return req.client.host if req.client else 'unknown'

def is_secure(req: Request) -> bool:
    return req.url.scheme == 'https' or req.headers.get('x-forwarded-proto') == 'https'

MAX_DEVICES = 2

def parse_device_name(ua_str: str) -> str:
    ua = (ua_str or '').lower()
    os_name = 'Device'
    if 'android' in ua:
        os_name = 'Android Phone'
    elif 'iphone' in ua:
        os_name = 'iPhone'
    elif 'ipad' in ua:
        os_name = 'iPad'
    elif 'windows' in ua:
        os_name = 'Windows PC'
    elif 'macintosh' in ua or 'mac os' in ua:
        os_name = 'Mac'
    elif 'linux' in ua:
        os_name = 'Linux PC'

    browser = 'Browser'
    if 'edg' in ua:
        browser = 'Edge'
    elif 'chrome' in ua or 'crios' in ua:
        browser = 'Chrome'
    elif 'safari' in ua:
        browser = 'Safari'
    elif 'firefox' in ua or 'fxios' in ua:
        browser = 'Firefox'

    return f"{browser} ({os_name})"

def new_session(con, user_id: int, resp: Response, req: Request):
    tok = secrets.token_urlsafe(32)
    now = int(time.time())
    con.execute('DELETE FROM sessions WHERE user_id=? AND expires<?', (user_id, now))
    dev_name = parse_device_name(req.headers.get('user-agent', ''))
    try:
        con.execute('INSERT INTO sessions(token_hash,user_id,created_at,expires,device_name) VALUES(?,?,?,?,?)',
                    (sha(tok), user_id, now, now + SESSION_DAYS * 86400, dev_name))
    except Exception:
        con.execute('INSERT INTO sessions(token_hash,user_id,created_at,expires) VALUES(?,?,?,?)',
                    (sha(tok), user_id, now, now + SESSION_DAYS * 86400))
    resp.set_cookie(COOKIE, tok, max_age=SESSION_DAYS * 86400, httponly=True, samesite='lax', secure=is_secure(req), path='/')

def _user_on(con, tok: str):
    now = int(time.time())
    row = con.execute('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', (sha(tok), now)).fetchone()
    if not row:
        return None
    row = dict(row)
    if now - row['last_seen'] > 60:
        con.execute('UPDATE users SET last_seen=? WHERE id=?', (now, row['id']))
    return row

def current_user(req: Request, con=None):
    tok = req.cookies.get(COOKIE)
    if not tok:
        return None
    if con is not None:                 # caller already holds a connection: do not open (and TLS-handshake) a second one
        return _user_on(con, tok)
    with db() as con:
        return _user_on(con, tok)

def need_user(req: Request):
    u = current_user(req)
    if not u:
        raise HTTPException(401, 'Please log in.')
    return u

def need_admin(req: Request):
    u = need_user(req)
    if u['role'] != 'admin':
        raise HTTPException(403, 'Admins only.')
    return u

def need_csrf(req: Request):
    # Browsers cannot add this header on a cross-site request without a CORS preflight (which we never allow).
    if req.headers.get('x-requested-with') != CSRF_VALUE:
        raise HTTPException(403, 'Bad request origin.')

def rate(req: Request, name: str, limit: int, window: int):
    """Shared across all serverless instances because the counters live in the database."""
    ip, now = client_ip(req), int(time.time())
    with db() as con:
        n = con.execute('SELECT COUNT(*) AS c FROM ratelimit WHERE name=? AND ip=? AND ts>?', (name, ip, now - window)).fetchone()['c']
        if n >= limit:
            raise HTTPException(429, 'Too many tries. Please wait a few minutes and try again.')
        con.execute('INSERT INTO ratelimit(name,ip,ts) VALUES(?,?,?)', (name, ip, now))
        if secrets.randbelow(20) == 0:
            con.execute('DELETE FROM ratelimit WHERE ts<?', (now - 7200,))

def public(u):
    return {'id': u['id'], 'username': u['username'], 'display_name': u['display_name'], 'role': u['role']}

# ----------------------------------------------------------------------------- progress merge (progress only ever moves forward)
def _json(v, default):
    try:
        return json.loads(v)
    except Exception:
        return default

def merge(key: str, old, new: str) -> str:
    if old is None:
        return new
    try:
        if key == 'scx_xp_total':
            return str(max(int(old), int(new)))
        if key == 'scx_badges' or key.endswith('_activities'):
            return json.dumps(sorted(set(_json(old, [])) | set(_json(new, []))), ensure_ascii=False)
        if key == 'scx_visit_dates':
            return json.dumps(sorted(set(_json(old, [])) | set(_json(new, [])))[-400:])
        if key.endswith('_stars'):
            a, b = _json(old, []), _json(new, [])
            n = max(len(a), len(b)); a += [0] * (n - len(a)); b += [0] * (n - len(b))
            return json.dumps([max(int(x), int(y)) for x, y in zip(a, b)])
        if key.startswith('scx_path_'):
            d = _json(old, {}); d.update({k: v for k, v in _json(new, {}).items() if v}); return json.dumps(d)
        if key.endswith('_done') or key.startswith(('scx_done_', 'scx_story_', 'scx_lab_')):
            return '1' if '1' in (old, new) else new
    except Exception:
        pass
    return new

def load_progress(uid: int, con=None) -> dict:
    if con is None:
        with db() as con:
            return load_progress(uid, con)
    return {r['k']: r['v'] for r in con.execute('SELECT k,v FROM progress WHERE user_id=?', (uid,)).fetchall()}

def save_progress(uid: int, items: dict) -> dict:
    now = int(time.time())
    with db() as con:
        have = {r['k']: r['v'] for r in con.execute('SELECT k,v FROM progress WHERE user_id=?', (uid,)).fetchall()}
        for k, v in items.items():
            if not KEY_RE.match(k) or not isinstance(v, str) or len(v) > MAX_VAL:
                continue
            if k not in have and len(have) >= MAX_KEYS:
                continue
            merged = merge(k, have.get(k), v)
            if have.get(k) == merged:
                continue
            have[k] = merged
            con.execute('INSERT INTO progress(user_id,k,v,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at', (uid, k, merged, now))
    return have

# ----------------------------------------------------------------------------- security headers
@app.middleware('http')
async def headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'same-origin'
    if request.url.path.startswith(('/api', '/lessons', '/account', '/admin')):
        resp.headers['Cache-Control'] = 'no-store'
    return resp

# ----------------------------------------------------------------------------- API: accounts
def body_json(data):
    if not isinstance(data, dict):
        raise HTTPException(400, 'Bad request.')
    return data

@app.post('/api/signup')
async def api_signup(req: Request):
    need_csrf(req); rate(req, 'signup', 8, 3600)
    d = body_json(await req.json())
    username = str(d.get('username', '')).strip().lower(); pw = str(d.get('password', '')); name = str(d.get('display_name', '')).strip()[:30] or username
    if not USER_RE.match(username):
        raise HTTPException(400, 'Username: 3 to 20 letters, numbers or underscore.')
    if len(pw) < 8 or len(pw) > 200:
        raise HTTPException(400, 'Password must be at least 8 characters.')
    with db() as con:
        count = con.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
        if count > 0:
            raise HTTPException(403, 'Public account creation is disabled. Please contact the administrator on WhatsApp to get an account.')
        role = 'admin'
        pwh = hash_pw(pw)
        now = int(time.time())
        try:
            uid = con.execute('INSERT INTO users(username,display_name,pw,role,created_at,last_seen) VALUES(?,?,?,?,?,?) RETURNING id',
                              (username, name, pwh, role, now, now)).fetchone()['id']
        except INTEGRITY:
            raise HTTPException(409, 'That username is taken. Try another one.')
        resp = JSONResponse({'ok': True, 'user': {'id': uid, 'username': username, 'display_name': name, 'role': role}})
        new_session(con, uid, resp, req)
    return resp

@app.post('/api/login')
async def api_login(req: Request):
    need_csrf(req); rate(req, 'login', 12, 300)
    d = body_json(await req.json())
    username = str(d.get('username', '')).strip().lower(); pw = str(d.get('password', ''))
    kick_id = str(d.get('kick_device', '')).strip()
    with db() as con:
        row = con.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
        if not row:
            count = con.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
            if count == 0:                      # a brand-new empty database: the first login creates the first admin
                if not USER_RE.match(username):
                    raise HTTPException(400, 'Username: 3 to 20 letters, numbers or underscore.')
                if len(pw) < 8:
                    raise HTTPException(400, 'Password must be at least 8 characters.')
                pwh = hash_pw(pw)
                now = int(time.time())
                uid = con.execute('INSERT INTO users(username,display_name,pw,role,created_at,last_seen) VALUES(?,?,?,?,?,?) RETURNING id',
                                  (username, username.capitalize(), pwh, 'admin', now, now)).fetchone()['id']
                row = con.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
            else:
                check_pw(pw, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')   # keep timing similar
                raise HTTPException(401, 'Wrong username or password.')
        else:
            if not check_pw(pw, row['pw']):
                raise HTTPException(401, 'Wrong username or password.')

        row = dict(row)
        if username in ADMIN_USERS and row['role'] != 'admin':
            con.execute("UPDATE users SET role='admin' WHERE id=?", (row['id'],))
            row['role'] = 'admin'

        now = int(time.time())
        con.execute('DELETE FROM sessions WHERE user_id=? AND expires<?', (row['id'], now))

        try:
            active = con.execute("SELECT token_hash, created_at, COALESCE(device_name, '') AS device_name FROM sessions WHERE user_id=? ORDER BY created_at ASC", (row['id'],)).fetchall()
        except Exception:
            active = con.execute("SELECT token_hash, created_at, '' AS device_name FROM sessions WHERE user_id=? ORDER BY created_at ASC", (row['id'],)).fetchall()

        if kick_id:
            if kick_id == 'all':
                con.execute('DELETE FROM sessions WHERE user_id=?', (row['id'],))
            else:
                con.execute('DELETE FROM sessions WHERE user_id=? AND token_hash=?', (row['id'], kick_id))
            try:
                active = con.execute("SELECT token_hash, created_at, COALESCE(device_name, '') AS device_name FROM sessions WHERE user_id=? ORDER BY created_at ASC", (row['id'],)).fetchall()
            except Exception:
                active = con.execute("SELECT token_hash, created_at, '' AS device_name FROM sessions WHERE user_id=? ORDER BY created_at ASC", (row['id'],)).fetchall()
            while len(active) >= MAX_DEVICES:
                con.execute('DELETE FROM sessions WHERE user_id=? AND token_hash=?', (row['id'], active[0]['token_hash']))
                active.pop(0)
        elif len(active) >= MAX_DEVICES:
            device_list = []
            for idx, s in enumerate(active, 1):
                device_list.append({
                    'id': s['token_hash'],
                    'name': s['device_name'] or f"Device {idx}",
                    'created_at': s['created_at']
                })
            return JSONResponse({
                'ok': False,
                'device_limit': True,
                'detail': 'Account is already active on 2 devices.',
                'message': 'You are currently logged in on 2 devices. Please choose which device to log out to continue on this device:',
                'devices': device_list
            }, status_code=409)

        resp = JSONResponse({'ok': True, 'user': public(row)})
        new_session(con, row['id'], resp, req)
    return resp

@app.post('/api/logout')
async def api_logout(req: Request):
    need_csrf(req)
    tok = req.cookies.get(COOKIE)
    if tok:
        with db() as con:
            con.execute('DELETE FROM sessions WHERE token_hash=?', (sha(tok),))
    resp = JSONResponse({'ok': True}); resp.delete_cookie(COOKIE, path='/')
    return resp

@app.get('/api/me')
def api_me(req: Request):
    u = need_user(req)
    return {'user': public(u)}

@app.put('/api/progress')
async def api_progress_put(req: Request):
    need_csrf(req); u = need_user(req)
    d = body_json(await req.json())
    return {'progress': save_progress(u['id'], d)}

@app.get('/api/progress')
def api_progress_get(req: Request):
    u = need_user(req)
    return {'progress': load_progress(u['id'])}

# ----------------------------------------------------------------------------- Past Papers: separate from lesson XP/progress
def past_questions():
    path = LESSONS / 'past-papers' / '2015.json'
    return {q['id']: q for q in json.loads(path.read_text(encoding='utf-8'))['questions']}


@app.get('/api/past-papers/state')
def past_state(req: Request):
    u = need_user(req)
    with db() as con:
        rows = con.execute('SELECT event_id,question_id,result,created_at FROM past_attempts WHERE user_id=? '
                           'ORDER BY created_at,event_id', (u['id'],)).fetchall()
        bookmarks = [r['question_id'] for r in con.execute('SELECT question_id FROM past_bookmarks WHERE user_id=?', (u['id'],)).fetchall()]
    return {'attempts': [dict(id=r['event_id'], question=r['question_id'], result=json.loads(r['result']),
                              at=r['created_at']) for r in rows], 'bookmarks': bookmarks}


@app.post('/api/past-papers/attempts')
async def past_save(req: Request):
    need_csrf(req); u = need_user(req)
    raw = await req.body()
    if len(raw) > 512000:
        raise HTTPException(413, 'Attempt is too large.')
    try:
        data = body_json(json.loads(raw))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Invalid JSON.')
    events = data.get('events')
    if not isinstance(events, list) or not 1 <= len(events) <= 50:
        raise HTTPException(400, 'Send between 1 and 50 attempts.')
    bank = past_questions(); validated = []
    for e in events:
        if not isinstance(e, dict) or not isinstance(e.get('id'), str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,64}', e['id']):
            raise HTTPException(400, 'Invalid attempt ID.')
        q = bank.get(e.get('question')) if isinstance(e.get('question'), str) else None
        if not q or e.get('mode') not in ('practice','exam'):
            raise HTTPException(400, 'Unknown question or mode.')
        clean = {k:e[k] for k in ('id','question','mode')}
        if q['type'] == 'mcq':
            choice = e.get('choice')
            if choice is not None and (type(choice) is not int or choice not in range(4)):
                raise HTTPException(400, 'Choose an option from 1 to 4.')
            clean['choice'] = choice
            result = dict(type='mcq', choice=choice, correct=choice == q['correct'], correctChoice=q['correct'], mode=e['mode'])
        else:
            answers = e.get('answers', {})
            labels = {p['label'] for p in q['parts']}
            if (not isinstance(answers,dict) or any(k not in labels or not isinstance(v,str) or len(v)>2000 for k,v in answers.items())
                    or e.get('selfCheck') not in (None,'needs-work','understood')):
                raise HTTPException(400, 'Invalid written response.')
            clean.update(answers=answers, selfCheck=e.get('selfCheck'))
            result = dict(type='written', answers=answers, selfCheck=e.get('selfCheck'), mode=e['mode'])
        validated.append((clean,result))
    saved=[]; now=int(time.time()*1000)
    with db() as con:
        last=con.execute('SELECT MAX(created_at) AS at FROM past_attempts WHERE user_id=?',(u['id'],)).fetchone()['at']
        now=max(now,(last or 0)+1)
        for clean,result in validated:
            payload=json.dumps(clean,sort_keys=True,ensure_ascii=False)
            old=con.execute('SELECT payload,result,created_at FROM past_attempts WHERE user_id=? AND event_id=?',(u['id'],clean['id'])).fetchone()
            if old and old['payload'] != payload:
                raise HTTPException(409, 'Attempt ID was already used. Retry with the original response.')
            con.execute('INSERT INTO past_attempts(user_id,event_id,question_id,payload,result,created_at) VALUES(?,?,?,?,?,?) '
                        'ON CONFLICT(user_id,event_id) DO NOTHING',
                        (u['id'],clean['id'],clean['question'],payload,json.dumps(result,ensure_ascii=False),now))
            stored=con.execute('SELECT payload,result,created_at FROM past_attempts WHERE user_id=? AND event_id=?',(u['id'],clean['id'])).fetchone()
            if stored['payload']!=payload:
                raise HTTPException(409, 'Attempt ID was already used.')
            saved.append(dict(id=clean['id'],question=clean['question'],result=json.loads(stored['result']),at=stored['created_at']))
            now+=1
    return {'attempts':saved}


@app.put('/api/past-papers/bookmark')
async def past_bookmark(req: Request):
    need_csrf(req); u=need_user(req); d=body_json(await req.json())
    q=d.get('question')
    if not isinstance(q,str) or q not in past_questions() or type(d.get('saved')) is not bool:
        raise HTTPException(400, 'Invalid bookmark.')
    with db() as con:
        if d['saved']:
            con.execute('INSERT INTO past_bookmarks(user_id,question_id) VALUES(?,?) ON CONFLICT(user_id,question_id) DO NOTHING',(u['id'],q))
        else:
            con.execute('DELETE FROM past_bookmarks WHERE user_id=? AND question_id=?',(u['id'],q))
    return {'ok':True}


@app.post('/api/account/name')
async def api_name(req: Request):
    need_csrf(req); u = need_user(req)
    name = str(body_json(await req.json()).get('display_name', '')).strip()[:30]
    if not name:
        raise HTTPException(400, 'Please type a name.')
    with db() as con:
        con.execute('UPDATE users SET display_name=? WHERE id=?', (name, u['id']))
    return {'ok': True}

@app.post('/api/account/password')
async def api_password(req: Request):
    need_csrf(req); rate(req, 'pw', 10, 600); u = need_user(req)
    d = body_json(await req.json())
    if not check_pw(str(d.get('old', '')), u['pw']):
        raise HTTPException(401, 'Your current password is wrong.')
    new = str(d.get('new', ''))
    if len(new) < 8 or len(new) > 200:
        raise HTTPException(400, 'New password must be at least 8 characters.')
    tok = req.cookies.get(COOKIE)
    with db() as con:
        con.execute('UPDATE users SET pw=? WHERE id=?', (hash_pw(new), u['id']))
        con.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?', (u['id'], sha(tok or '')))
    return {'ok': True}

@app.post('/api/account/delete')
async def api_delete(req: Request):
    need_csrf(req); rate(req, 'del', 5, 600); u = need_user(req)
    if not check_pw(str(body_json(await req.json()).get('password', '')), u['pw']):
        raise HTTPException(401, 'Wrong password.')
    with db() as con:
        con.execute('DELETE FROM users WHERE id=?', (u['id'],))
    resp = JSONResponse({'ok': True}); resp.delete_cookie(COOKIE, path='/')
    return resp

# ----------------------------------------------------------------------------- API: admin
@app.get('/api/admin/users')
def api_admin_users(req: Request):
    need_admin(req)
    out = []
    with db() as con:
        now = int(time.time())
        devices = {r['user_id']: r['c'] for r in con.execute('SELECT user_id, COUNT(*) AS c FROM sessions WHERE expires>? GROUP BY user_id', (now,)).fetchall()}
        prog = {}
        for r in con.execute("SELECT user_id,k,v FROM progress WHERE k IN ('scx_xp_total','scx_badges')").fetchall():
            prog.setdefault(r['user_id'], {})[r['k']] = r['v']
        for r in con.execute('SELECT id,username,display_name,role,created_at,last_seen FROM users ORDER BY last_seen DESC').fetchall():
            p = prog.get(r['id'], {})
            out.append({'id': r['id'], 'username': r['username'], 'display_name': r['display_name'], 'role': r['role'], 'created_at': r['created_at'], 'last_seen': r['last_seen'],
                        'devices': devices.get(r['id'], 0),
                        'xp': int(p.get('scx_xp_total') or 0), 'badges': len(_json(p.get('scx_badges', '[]'), []))})
    return {'users': out}

@app.post('/api/admin/kick-devices')
async def api_admin_kick_devices(req: Request):
    need_csrf(req); need_admin(req)
    uid = int(body_json(await req.json()).get('id', 0))
    with db() as con:
        con.execute('DELETE FROM sessions WHERE user_id=?', (uid,))
    return {'ok': True}

@app.post('/api/admin/create-user')
async def api_admin_create_user(req: Request):
    need_csrf(req); need_admin(req)
    d = body_json(await req.json())
    username = str(d.get('username', '')).strip().lower()
    pw = str(d.get('password', ''))
    name = str(d.get('display_name', '')).strip()[:30] or username
    role = str(d.get('role', 'student')).strip().lower()
    if role not in ('student', 'admin'):
        role = 'student'
    if not USER_RE.match(username):
        raise HTTPException(400, 'Username must be 3 to 20 letters, numbers or underscore.')
    if len(pw) < 8 or len(pw) > 200:
        raise HTTPException(400, 'Password must be at least 8 characters.')
    pwh = hash_pw(pw)
    now = int(time.time())
    with db() as con:
        try:
            uid = con.execute('INSERT INTO users(username,display_name,pw,role,created_at,last_seen) VALUES(?,?,?,?,?,?) RETURNING id',
                              (username, name, pwh, role, now, now)).fetchone()['id']
        except INTEGRITY:
            raise HTTPException(409, f'Username @{username} is already taken.')
    return {'ok': True, 'user': {'id': uid, 'username': username, 'display_name': name, 'role': role}}

@app.post('/api/admin/reset')
async def api_admin_reset(req: Request):
    need_csrf(req); need_admin(req)
    d = body_json(await req.json()); new = str(d.get('password', ''))
    if len(new) < 8:
        raise HTTPException(400, 'Password must be at least 8 characters.')
    uid = int(d.get('id', 0))
    with db() as con:
        con.execute('UPDATE users SET pw=? WHERE id=?', (hash_pw(new), uid))
        con.execute('DELETE FROM sessions WHERE user_id=?', (uid,))
    return {'ok': True}

@app.post('/api/admin/delete')
async def api_admin_delete(req: Request):
    need_csrf(req); me = need_admin(req)
    uid = int(body_json(await req.json()).get('id', 0))
    if uid == me['id']:
        raise HTTPException(400, 'You cannot delete yourself here. Use the Account page.')
    with db() as con:
        con.execute('DELETE FROM users WHERE id=?', (uid,))
    return {'ok': True}

# ----------------------------------------------------------------------------- pages
def safe_next(n: str) -> str:
    return n if n and n.startswith('/') and not n.startswith('//') and '\\' not in n else '/lessons/index.html'

def js_json(o) -> str:
    return json.dumps(o, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')

BOOT = '''<script>(function(){try{
var U=%s,S=%s;
var T=function(k){return /^(scx_|lessonLang$|lessonTheme$)/.test(k)};
var owner=localStorage.getItem('acct_owner');
if(owner&&owner!==String(U.id)){Object.keys(localStorage).filter(T).forEach(function(k){localStorage.removeItem(k)})}
localStorage.setItem('acct_owner',String(U.id));
function J(v,d){try{return JSON.parse(v)}catch(e){return d}}
function M(k,o,n){if(o===null||o===undefined)return n;try{
if(k==='lessonLang'||k==='lessonTheme')return o;
if(k==='scx_xp_total')return String(Math.max(parseInt(o,10)||0,parseInt(n,10)||0));
if(k==='scx_badges'||/_activities$/.test(k)){var s={};J(o,[]).concat(J(n,[])).forEach(function(x){s[x]=1});return JSON.stringify(Object.keys(s).sort())}
if(k==='scx_visit_dates'){var s2={};J(o,[]).concat(J(n,[])).forEach(function(x){s2[x]=1});return JSON.stringify(Object.keys(s2).sort().slice(-400))}
if(/_stars$/.test(k)){var a=J(o,[]),b=J(n,[]),m=Math.max(a.length,b.length),r=[];for(var i=0;i<m;i++)r.push(Math.max(a[i]||0,b[i]||0));return JSON.stringify(r)}
if(k.indexOf('scx_path_')===0){var d=J(o,{}),e=J(n,{});for(var x in e){if(e[x])d[x]=e[x]}return JSON.stringify(d)}
if(/_done$/.test(k)||/^scx_(done|story|lab)_/.test(k))return (o==='1'||n==='1')?'1':n;
}catch(e){}return n}
Object.keys(S).forEach(function(k){if(T(k))localStorage.setItem(k,M(k,localStorage.getItem(k),S[k]))});
window.SCX_USER=U;window.__acctBoot=true;
localStorage.setItem('scx_lease_ts',String(Date.now()));
var lease=parseInt(localStorage.getItem('scx_lease_ts')||'0',10);
if(lease&&(Date.now()-lease>7*86400*1000)){
  window.__scxLeaseExpired=true;
  window.addEventListener('DOMContentLoaded',function(){
    var b=document.createElement('div');
    b.style.cssText='position:fixed;inset:0;background:rgba(11,15,23,0.97);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;font-family:system-ui,sans-serif;backdrop-filter:blur(8px);';
    b.innerHTML='<div style="max-width:380px;background:#141d2c;border:1.5px solid #25324a;border-radius:20px;padding:26px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.5)">'
      +'<div style="font-size:2.8rem;margin-bottom:8px">⏳</div>'
      +'<h2 style="margin:0 0 8px;font-size:1.25rem;color:#4cc3f0">Offline Pass Expired</h2>'
      +'<p style="margin:0 0 16px;color:#a7b3c8;font-size:0.92rem;line-height:1.5">You have been offline for over 7 days. Please connect to the internet once to re-verify your active student license.</p>'
      +'<button onclick="location.reload()" style="background:#4cc3f0;color:#06182b;border:none;border-radius:12px;padding:12px 20px;font-weight:700;font-size:0.95rem;cursor:pointer">Reconnect &amp; Refresh</button>'
      +'</div>';
    document.body.appendChild(b);
  });
}
}catch(e){}})();</script>'''

APP_HEAD = (
    '<link rel="manifest" href="/manifest.webmanifest">'
    '<meta name="theme-color" content="#0b0f17">'
    '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-title" content="STEM Cloud">'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700;800&display=swap" media="print" onload="this.media=&quot;all&quot;">'
    '<link rel="icon" type="image/png" sizes="32x32" href="/static/icons/favicon-32.png">'
    '<link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192.png">'
    '<link rel="icon" type="image/png" href="/static/brand/logo-mark.png">'
    # the chosen language is set before first paint and the page stays hidden until it has been applied (lessons: when the player has started, and for Sinhala when its words are in),
    # so a page never shows English for a moment and then flips; a failsafe shows it after 4 seconds whatever happens
    '<style>html.stem-boot body{visibility:hidden}</style>'
    '<script>try{var _l=localStorage.getItem("lessonLang")||"en",_h=document.documentElement;_h.lang=_l;_h.classList.add("stem-boot");'
    '(function(){var d=false,w=_l==="si";function go(){if(d)return;d=true;_h.classList.remove("stem-boot")}'
    'document.addEventListener("stem-step",function(){if(!w)setTimeout(go,250)},{once:true});window.addEventListener("stem-si-coverage",function(){setTimeout(go,250)},{once:true});'
    'document.addEventListener("DOMContentLoaded",function(){setTimeout(go,document.getElementById("fw_path")?1800:40)});setTimeout(go,4000)})()}catch(e){}</script>'
    # animations are ON unless the student switched them off in the account menu (applied before first paint)
    '<script>try{if(localStorage.getItem("stem_motion")==="off")document.documentElement.classList.add("stem-calm")}catch(e){}</script>'
)
APP_TAIL_CSS = '<link rel="stylesheet" href="/static/app-layer.css"><link rel="stylesheet" href="/static/player.css">'
# order matters: player.js builds the lesson bar that voice.js adds its button to
APP_TAIL_JS = ('<script src="/static/pwa.js"></script><script src="/static/si.js"></script><script src="/static/app-layer.js"></script>'
               '<script src="/static/player.js"></script><script src="/static/story.js"></script>'
               '<script src="/static/voice.js"></script><script src="/static/questions.js"></script><script src="/static/icons.js"></script>'
               '<script src="/static/account.js"></script><script src="/static/past-paper-links.js"></script>')
VIEWPORT_RE = re.compile(r'<meta\s+name="viewport"[^>]*>', re.I)

_MARK = '<!--STEM-BOOT-->'
_tpl = {}

def _template(path: Path) -> str:
    """The lesson with everything that is the same for every student already inserted (cached per instance)."""
    key = (str(path), path.stat().st_mtime_ns)
    html = _tpl.get(key)
    if html is None:
        html = path.read_text(encoding='utf-8')
        vp = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        html = VIEWPORT_RE.sub(vp, html, 1) if VIEWPORT_RE.search(html) else html.replace('<head>', '<head>' + vp, 1)
        html = html.replace('<head>', '<head>' + _MARK + APP_HEAD, 1) if '<head>' in html else _MARK + html
        html = html.replace('</head>', APP_TAIL_CSS + '</head>', 1)
        html = html.replace('</body>', APP_TAIL_JS + '</body>', 1) if '</body>' in html else html + APP_TAIL_JS
        _tpl.clear(); _tpl[key] = html
    return html

def render_lesson(path: Path, user: dict, progress: dict) -> HTMLResponse:
    boot = BOOT % (js_json(public(user)), js_json(progress))
    return HTMLResponse(_template(path).replace(_MARK, boot, 1))

@app.get('/')
def home(req: Request):
    return RedirectResponse('/lessons/index.html' if current_user(req) else '/login', status_code=302)

@app.get('/healthz')
def healthz():
    try:
        with db() as con:
            con.execute('SELECT 1').fetchone()
    except HTTPException as e:
        return JSONResponse({'ok': False, 'error': e.detail}, status_code=503)
    except Exception:
        return JSONResponse({'ok': False, 'error': 'Cannot reach the database. Check DATABASE_URL.'}, status_code=503)
    return {'ok': True, 'db': 'postgres' if PG else 'sqlite'}

@app.get('/lessons')
@app.get('/lessons/')
def lessons_root():
    return RedirectResponse('/lessons/index.html', status_code=302)

@app.get('/lessons/{rel:path}')
def lessons(rel: str, req: Request):
    p = (LESSONS / rel).resolve()
    with db() as con:                    # one database connection for the whole page: session check and the student's progress
        u = current_user(req, con)
        if not u:
            if rel.endswith('.html'):
                return RedirectResponse('/login?next=' + '/lessons/' + rel, status_code=302)
            raise HTTPException(401, 'Please log in.')
        if LESSONS not in p.parents or not p.is_file():
            raise HTTPException(404, 'Not found.')
        if p.suffix == '.html':
            return render_lesson(p, u, load_progress(u['id'], con))
    return FileResponse(p)

@app.get('/login')
def login_page(req: Request):
    if current_user(req):
        return RedirectResponse(safe_next(req.query_params.get('next', '')), status_code=302)
    return FileResponse(STATIC / 'login.html')

@app.get('/privacy')
def privacy_page():
    return FileResponse(STATIC / 'privacy.html')

@app.get('/account')
def account_page(req: Request):
    return FileResponse(STATIC / 'account.html') if current_user(req) else RedirectResponse('/login?next=/account', status_code=302)

@app.get('/admin')
def admin_page(req: Request):
    u = current_user(req)
    if not u:
        return RedirectResponse('/login?next=/admin', status_code=302)
    if u['role'] != 'admin':
        raise HTTPException(403, 'Admins only.')
    return FileResponse(STATIC / 'admin.html')


# ----------------------------------------------------------------------------- app files that must live at the site root
@app.get('/sw.js')
def service_worker():
    return FileResponse(STATIC / 'sw.js', media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/'})

@app.get('/manifest.webmanifest')
def manifest():
    return FileResponse(STATIC / 'manifest.webmanifest', media_type='application/manifest+json', headers={'Cache-Control': 'public, max-age=3600'})

@app.get('/apple-touch-icon.png')
@app.get('/apple-touch-icon-precomposed.png')
def apple_icon():
    return FileResponse(STATIC / 'icons' / 'apple-touch-icon.png', headers={'Cache-Control': 'public, max-age=86400'})

@app.get('/favicon.ico')
def favicon():
    ico = STATIC / 'icons' / 'favicon.ico'
    if ico.exists():
        return FileResponse(ico, media_type='image/x-icon', headers={'Cache-Control': 'public, max-age=86400'})
    return FileResponse(STATIC / 'icons' / 'favicon-32.png', media_type='image/png', headers={'Cache-Control': 'public, max-age=86400'})

app.mount('/static', StaticFiles(directory=str(STATIC)), name='static')
