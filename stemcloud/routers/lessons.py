"""The current lesson pages and topic pages (login only), served with the student's progress."""
import re
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from ..config import LESSONS
from ..db import db
from ..legacy import render_lesson
from ..media import media_response
from ..progress import load_progress
from ..security import current_user

router = APIRouter()

SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]{0,80}$')

@router.get('/topics/{slug}')
def topics_page(slug: str, req: Request):
    """Subject > chapter > topic > learning steps. The page is one shell; the chapter's content is site/lessons/topics/<slug>.json (served to logged-in students only)."""
    if not SLUG_RE.match(slug) or not (LESSONS / 'topics' / (slug + '.json')).is_file():
        raise HTTPException(404, 'Not found.')
    with db() as con:
        u = current_user(req, con)
        if not u:
            nxt = req.url.path + ('?' + req.url.query if req.url.query else '')
            return RedirectResponse('/login?next=' + quote(nxt, safe='/'), status_code=302)
        return render_lesson(LESSONS / 'topics.html', u, load_progress(u['id'], con))

@router.get('/lessons')
@router.get('/lessons/')
def lessons_root():
    return RedirectResponse('/lessons/index.html', status_code=302)

@router.get('/lessons/{rel:path}')
def lessons(rel: str, req: Request):
    p = (LESSONS / rel).resolve()
    with db() as con:                    # one database connection for the whole page: session check and the student's progress
        u = current_user(req, con)
        if not u:
            if rel.endswith('.html'):
                return RedirectResponse('/login?next=' + '/lessons/' + rel, status_code=302)
            raise HTTPException(401, 'Please log in.')
        if LESSONS not in p.parents:
            raise HTTPException(404, 'Not found.')
        remote = media_response('lessons/' + p.relative_to(LESSONS).as_posix())
        if remote is not None:
            return remote
        if not p.is_file():
            raise HTTPException(404, 'Not found.')
        if p.suffix == '.html':
            return render_lesson(p, u, load_progress(u['id'], con))
    return FileResponse(p)
