# -*- coding: utf-8 -*-
"""STEM Cloud: O/L Physics lessons with accounts, login and saved progress.

This file is the Vercel entry point; the backend lives in the stemcloud/ package (one module per area, routers in stemcloud/routers/).
Hosted on Vercel (serverless): set DATABASE_URL to a Postgres database (Neon / Vercel Postgres / Supabase).
Local development needs no database: without DATABASE_URL it uses a SQLite file.
    cd api && python -m uvicorn index:app --port 8000

Environment:  DATABASE_URL (Postgres)   ADMIN_USERS (comma separated usernames)   DB_PATH (local SQLite file)
              GATE_SECRET (signs the lesson gate cookie; unset = no gate cookie)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from stemcloud.main import app  # noqa: E402
from stemcloud.config import USER_RE  # noqa: E402,F401  (tools/manage_admin.py)
from stemcloud.db import db  # noqa: E402,F401
from stemcloud.security import hash_pw  # noqa: E402,F401
