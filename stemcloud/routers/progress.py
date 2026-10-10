"""Progress v1 API used by account.js on the current lesson pages."""
from fastapi import APIRouter, Request

from ..progress import load_progress, save_progress
from ..security import body_json, need_csrf, need_user

router = APIRouter()

@router.put('/api/progress')
async def api_progress_put(req: Request):
    need_csrf(req); u = need_user(req)
    d = body_json(await req.json())
    return {'progress': save_progress(u['id'], d)}

@router.get('/api/progress')
def api_progress_get(req: Request):
    u = need_user(req)
    return {'progress': load_progress(u['id'])}
