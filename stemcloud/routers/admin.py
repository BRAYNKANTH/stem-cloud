"""Admin: list students, create, reset password, sign out devices, delete."""
import time

from fastapi import APIRouter, HTTPException, Request

from ..config import USER_RE
from ..db import INTEGRITY, db
from ..progress import _json
from ..security import body_json, hash_pw, need_admin, need_csrf

router = APIRouter()

@router.get('/api/admin/users')
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

@router.post('/api/admin/kick-devices')
async def api_admin_kick_devices(req: Request):
    need_csrf(req); need_admin(req)
    uid = int(body_json(await req.json()).get('id', 0))
    with db() as con:
        con.execute('DELETE FROM sessions WHERE user_id=?', (uid,))
    return {'ok': True}

@router.post('/api/admin/create-user')
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

@router.post('/api/admin/reset')
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

@router.post('/api/admin/delete')
async def api_admin_delete(req: Request):
    need_csrf(req); me = need_admin(req)
    uid = int(body_json(await req.json()).get('id', 0))
    if uid == me['id']:
        raise HTTPException(400, 'You cannot delete yourself here. Use the Account page.')
    with db() as con:
        con.execute('DELETE FROM users WHERE id=?', (uid,))
    return {'ok': True}
