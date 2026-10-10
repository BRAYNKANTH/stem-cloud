"""STEM Cloud backend: the FastAPI app, its middleware and routers."""
from fastapi import FastAPI, Request

from .config import STATIC
from .media import MediaStaticFiles
from .routers import account, admin, auth, lessons, pages, past_papers, progress

app = FastAPI(title='STEM Cloud', docs_url=None, redoc_url=None, openapi_url=None)

# ----------------------------------------------------------------------------- security headers
@app.middleware('http')
async def headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    # lesson pages may be framed by our own topic pages (they show one lesson step inside a topic); nothing else may be framed, and never by another site
    resp.headers['X-Frame-Options'] = 'SAMEORIGIN' if request.url.path.startswith('/lessons/') and request.url.path.endswith('.html') else 'DENY'
    resp.headers['Referrer-Policy'] = 'same-origin'
    if request.url.path.startswith(('/api', '/lessons', '/topics', '/account', '/admin')):
        resp.headers['Cache-Control'] = 'no-store'
    return resp

for module in (auth, progress, past_papers, account, admin, pages, lessons):
    app.include_router(module.router)

app.mount('/static', MediaStaticFiles(directory=str(STATIC)), name='static')
