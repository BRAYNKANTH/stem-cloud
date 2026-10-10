"""Settings read once from the environment, and paths inside the repo."""
import os, re
from pathlib import Path

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

# Lesson gate: a short-lived signed cookie next to the session, so the edge can let a logged-in student
# reach the static lesson pages without a database call (see docs/migration-plan-astro.md, section 3.1).
# Off until GATE_SECRET is set; the edge middleware must use the same secret.
GATE_COOKIE = 'scx_gate'
GATE_HOURS = 24
GATE_SECRET = os.environ.get('GATE_SECRET', '')
