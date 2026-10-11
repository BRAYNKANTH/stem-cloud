"""Public and account pages, health check, and the app files that must live at the site root."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from ..config import STATIC, WEB_HOME, WEB_SHELL
from ..db import PG, db
from ..legacy import safe_next
from ..media import media_problems, media_status
from ..security import current_user

router = APIRouter()


def page(built: Path, original: str):
    """The Astro build of a page when it is bundled (on Vercel), the original page otherwise (local runs without a web
    build). The route has already decided based on the visitor, so browsers must ask again instead of reusing a copy."""
    return FileResponse(built if built.is_file() else STATIC / original, media_type='text/html', headers={'Cache-Control': 'no-cache'})


@router.get('/')
def home(req: Request):
    """Signed-in students go straight to their lessons (the installed app opens /); everyone else gets the Home page:
    the Astro build when it is bundled (on Vercel), the original page otherwise (local runs without a web build)."""
    if current_user(req) and not req.query_params.get('home') and not req.query_params.get('preview'):
        return RedirectResponse('/lessons/index.html', status_code=302)
    return page(WEB_HOME, 'home.html')

@router.get('/home')
def home_alias(req: Request):
    return FileResponse(STATIC / 'home.html')

@router.get('/about')
def about_page(req: Request):
    return FileResponse(STATIC / 'about.html')

@router.get('/healthz')
def healthz():
    try:
        with db() as con:
            con.execute('SELECT 1').fetchone()
    except HTTPException as e:
        return JSONResponse({'ok': False, 'error': e.detail, 'media': media_status()}, status_code=503)
    except Exception:
        return JSONResponse({'ok': False, 'error': 'Cannot reach the database. Check DATABASE_URL.', 'media': media_status()}, status_code=503)
    out = {'ok': True, 'db': 'postgres' if PG else 'sqlite', 'media': media_status()}
    if out['media'] == 'r2-incomplete':
        out['media_problems'] = media_problems()
    return out

@router.get('/login')
def login_page(req: Request):
    if current_user(req):
        return RedirectResponse(safe_next(req.query_params.get('next', '')), status_code=302)
    return page(WEB_SHELL / 'login' / 'index.html', 'login.html')

@router.get('/privacy')
def privacy_page():
    return FileResponse(STATIC / 'privacy.html')

@router.get('/terms')
def terms_page():
    return FileResponse(STATIC / 'terms.html')

@router.get('/account')
def account_page(req: Request):
    if not current_user(req):
        return RedirectResponse('/login?next=/account', status_code=302)
    return page(WEB_SHELL / 'account' / 'index.html', 'account.html')

@router.get('/admin')
def admin_page(req: Request):
    u = current_user(req)
    if not u:
        return RedirectResponse('/login?next=/admin', status_code=302)
    if u['role'] != 'admin':
        raise HTTPException(403, 'Admins only.')
    return FileResponse(STATIC / 'admin.html')


# ----------------------------------------------------------------------------- app files that must live at the site root
@router.get('/sw.js')
def service_worker():
    return FileResponse(STATIC / 'sw.js', media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/'})

@router.get('/manifest.webmanifest')
def manifest():
    return FileResponse(STATIC / 'manifest.webmanifest', media_type='application/manifest+json', headers={'Cache-Control': 'public, max-age=3600'})

@router.get('/apple-touch-icon.png')
@router.get('/apple-touch-icon-precomposed.png')
def apple_icon():
    return FileResponse(STATIC / 'icons' / 'apple-touch-icon.png', headers={'Cache-Control': 'public, max-age=86400'})

@router.get('/favicon.ico')
def favicon():
    ico = STATIC / 'icons' / 'favicon.ico'
    if ico.exists():
        return FileResponse(ico, media_type='image/x-icon', headers={'Cache-Control': 'public, max-age=86400'})
    return FileResponse(STATIC / 'icons' / 'favicon-32.png', media_type='image/png', headers={'Cache-Control': 'public, max-age=86400'})
