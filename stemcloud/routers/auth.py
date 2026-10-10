"""Sign up, log in (with the two-device limit), log out, who am I."""
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..config import ADMIN_USERS, COOKIE, USER_RE
from ..db import INTEGRITY, db
from ..security import (MAX_DEVICES, body_json, check_pw, clear_gate, hash_pw, need_csrf, need_user, new_session, public, rate,
                        set_gate, sha)

router = APIRouter()

@router.post('/api/signup')
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

@router.post('/api/login')
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

@router.post('/api/logout')
async def api_logout(req: Request):
    need_csrf(req)
    tok = req.cookies.get(COOKIE)
    if tok:
        with db() as con:
            con.execute('DELETE FROM sessions WHERE token_hash=?', (sha(tok),))
    resp = JSONResponse({'ok': True}); resp.delete_cookie(COOKIE, path='/'); clear_gate(resp)
    return resp

@router.get('/api/me')
def api_me(req: Request):
    u = need_user(req)
    resp = JSONResponse({'user': public(u)})
    set_gate(resp, u['id'], req)          # keeps the 24-hour lesson gate fresh while the student uses the app
    return resp
