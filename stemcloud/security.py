"""Passwords, sessions, CSRF, rate limits and the lesson gate cookie."""
import base64, hashlib, hmac, secrets, time

from fastapi import HTTPException, Request, Response

from .config import COOKIE, CSRF_VALUE, SESSION_DAYS, TRUST_PROXY, GATE_COOKIE, GATE_HOURS, GATE_SECRET
from .db import db


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
    set_gate(resp, user_id, req)

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

def body_json(data):
    if not isinstance(data, dict):
        raise HTTPException(400, 'Bad request.')
    return data


# ----------------------------------------------------------------------------- lesson gate cookie
# Format: v1.<user id>.<expiry unix time>.<base64url HMAC-SHA256 of "v1.<id>.<expiry>">. It only says "this browser
# belonged to a logged-in student until <expiry>", so the edge can serve the static lesson pages. Personal data
# always needs the real session (sid). Revoking a session does not revoke this cookie, which is why it is short-lived.
def _gate_sig(payload: str) -> str:
    mac = hmac.new(GATE_SECRET.encode(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).rstrip(b'=').decode()

def gate_value(user_id: int, now: int = None) -> str:
    exp = (now or int(time.time())) + GATE_HOURS * 3600
    payload = 'v1.%d.%d' % (int(user_id), exp)
    return payload + '.' + _gate_sig(payload)

def check_gate(value: str, now: int = None):
    """The user id if the cookie is genuine and not expired, else None."""
    if not GATE_SECRET or not value:
        return None
    parts = value.split('.')
    if len(parts) != 4 or parts[0] != 'v1' or not parts[1].isdigit() or not parts[2].isdigit():
        return None
    if not hmac.compare_digest(_gate_sig('.'.join(parts[:3])), parts[3]):
        return None
    if int(parts[2]) <= (now or int(time.time())):
        return None
    return int(parts[1])

def set_gate(resp: Response, user_id: int, req: Request):
    if GATE_SECRET:
        resp.set_cookie(GATE_COOKIE, gate_value(user_id), max_age=GATE_HOURS * 3600, httponly=True, samesite='lax', secure=is_secure(req), path='/')

def clear_gate(resp: Response):
    resp.delete_cookie(GATE_COOKIE, path='/')
