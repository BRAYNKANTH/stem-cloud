# STEM Cloud

GCE O/L Physics with Raja and Chittu: six lessons, games, labs and animations, with student accounts and saved progress (XP, badges, stars, finished lessons) that follow the student to any device.

```
api/index.py        the whole backend (FastAPI): accounts, progress sync, admin, serves the lessons
site/lessons/       the lesson pages (served only to logged-in students)
site/static/        login/account/admin/privacy pages, account.js (sync + account menu),
                    pwa.js + sw.js + manifest (installable app), app-layer.css/js (phone layout), icons/
vercel.json         routes everything to the function and bundles site/
tests/test_flow.py  39 account/API checks (SQLite and real Postgres)
tests/test_pwa.py   real-browser checks: installability, offline, cache privacy, phone layout (Edge/Chrome)
tools/sync_lessons.py   copies updated lessons from the course workspace into site/lessons
tools/make_icons.py     redraws the app icons
```

## It is an installable app (PWA) and works on phones

- **Install:** Android/Chrome and desktop Chrome/Edge show *Install app* in the account menu (or the browser's own install button). On iPhone/iPad: Safari → Share → **Add to Home Screen**. It then opens full screen with its own icon.
- **Offline:** lessons a student has already opened still work without internet, and XP earned offline syncs when the connection returns. Anything not opened before shows a friendly "no internet" page.
- **Phones:** one-line header (menu, language, account), 44px touch targets, text never below 11px, cartoon stages use the full width and scale their speech bubbles, the lab cartoon stays pinned while sliders are moved, diagrams keep a readable size and pan sideways, `prefers-reduced-motion` is respected.
- **Shared devices:** the offline copies of lesson pages hold one student's progress, so they are wiped on logout and whenever the login page opens.
- **Releasing changes to the app files:** the service worker serves `site/static/*` instantly from cache and refreshes it in the background (new files show on the second visit). To force an immediate refresh for everyone after a release, bump `VERSION` at the top of `site/static/sw.js`.

## Deploy on Vercel

Vercel functions have no permanent disk, so accounts live in a Postgres database (free tier is enough).

1. **Push this folder to GitHub** (this folder is the repo root):
   ```bash
   git init && git add . && git commit -m "STEM Cloud"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Vercel → Add New → Project →** import the repo. Framework Preset: **Other**. Leave build settings empty. Deploy (the first deploy will show "Database is not set up yet", that is expected).
3. **Add the database:** project → **Storage → Create Database → Neon (Postgres)** → connect it to the project for Production, Preview and Development. Vercel adds `DATABASE_URL` for you. The tables are created automatically on first use.
4. **Add environment variable** `ADMIN_USERS` = your username (so you are always an admin and can't be locked out).
5. **Redeploy** (Deployments → ⋯ → Redeploy), then open `https://<your-app>.vercel.app/healthz`. You should see `{"ok":true,"db":"postgres"}`.
6. Open the site, **create your account first** (the first account becomes admin), then share the link with students. The admin page is at `/admin`.

A custom domain is under Project → Settings → Domains.

### Updating lessons later
Regenerate the lessons in the course workspace, run `python tools/sync_lessons.py`, then `git add . && git commit && git push`. Vercel redeploys automatically. Student data is not touched.

## Run it on your computer

```bash
pip install -r requirements-dev.txt
cd api
python -m uvicorn index:app --port 8000
```

Open http://localhost:8000. Without `DATABASE_URL` it uses a local SQLite file (`data/stemcloud.db`). To try against Postgres locally, set `DATABASE_URL` first.

## Tests

```bash
python tests/test_flow.py            # account/API checks on SQLite and a real embedded Postgres
python tests/test_pwa.py             # real Edge/Chrome: installability, offline, phone layout (needs: pip install playwright)
```

Covers sign-up, login, CSRF, progress merge rules, lesson gating, path traversal, admin, password change, account deletion and rate-limiting.

## How it works

- Lessons are served only to logged-in users. The server injects that student's saved progress into the page, and `account.js` saves new progress back about 1.5 seconds after each change (and when the tab closes).
- Progress only moves forward: XP takes the higher value, badges are combined, stars take the best per level, finished flags stay finished. A stale phone can never wipe newer progress.
- On a shared computer, switching accounts clears the previous student's local progress so it can't leak into the next account.
- Passwords are salted scrypt hashes. Sessions are random tokens (only a hash is stored) in `HttpOnly`, `SameSite=Lax`, `Secure` cookies, valid 30 days. Every write needs an `X-Requested-With` header (CSRF defence). Login, sign-up and password changes are rate-limited per IP, with counters in the database so the limit holds across Vercel instances.
- `/admin` lists students with XP and badge counts, resets a password (shows a temporary one to tell the student) or deletes an account. Students can change name or password and delete their own account at `/account`.

## Privacy (students are children)

No email, phone, real name or tracking is collected, and the sign-up form asks for a nickname. `/privacy` says this in plain words. If you host this for real students, tell their parents or school and decide who gets admin access.

## Known limits

- No email, so **password reset is by the admin only**.
- Every request opens a fresh database connection, which is fine for a class or a few hundred students. For heavy traffic, use Neon's pooled connection string (the Vercel integration already does) and consider connection reuse.
- The six story videos are not part of the site yet (they are large files and need their own hosting).
