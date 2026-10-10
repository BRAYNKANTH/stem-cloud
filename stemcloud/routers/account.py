"""A student's own account: display name, password, delete."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..config import COOKIE
from ..db import db
from ..security import body_json, check_pw, clear_gate, hash_pw, need_csrf, need_user, rate, sha

router = APIRouter()

@router.post('/api/account/name')
async def api_name(req: Request):
    need_csrf(req); u = need_user(req)
    name = str(body_json(await req.json()).get('display_name', '')).strip()[:30]
    if not name:
        raise HTTPException(400, 'Please type a name.')
    with db() as con:
        con.execute('UPDATE users SET display_name=? WHERE id=?', (name, u['id']))
    return {'ok': True}

@router.post('/api/account/password')
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

@router.post('/api/account/delete')
async def api_delete(req: Request):
    need_csrf(req); rate(req, 'del', 5, 600); u = need_user(req)
    if not check_pw(str(body_json(await req.json()).get('password', '')), u['pw']):
        raise HTTPException(401, 'Wrong password.')
    with db() as con:
        con.execute('DELETE FROM users WHERE id=?', (u['id'],))
    resp = JSONResponse({'ok': True}); resp.delete_cookie(COOKIE, path='/'); clear_gate(resp)
    return resp
