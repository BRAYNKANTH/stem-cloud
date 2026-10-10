# STEM Cloud: migration plan to Astro + React islands + FastAPI

Status: proposal · Written 2026-10-10

## 1. Goal

Turn STEM Cloud into a scalable MVP that can:

1. **Add subjects and grades quickly.** Chemistry, Biology, Maths and other grades should be new *content*, not new code.
2. **Serve many more students** on low-end Android phones and slow mobile data, offline, from a CDN.

The target stack:

| Layer | Choice | Why |
|---|---|---|
| Pages | **Astro** (static output) | Lessons are mostly reading content. They are built to plain HTML ahead of time, so text shows instantly and needs no JS. |
| Interactivity | **React islands** (`client:visible` / `client:idle`) | Only the player, story, quiz, games, labs and voice load JavaScript, one piece at a time. |
| Shared client state | **nanostores** (+ `@nanostores/react`) | XP, progress and the user are shared across islands without a global React tree. |
| Content | **Typed JSON in the repo** | Validated in CI. Translations live inside the content (`{en, ta, si}`). |
| API | **FastAPI** (kept, split into modules) | Proven auth, CSRF, rate limits and progress rules, plus the existing Python tooling. |
| Data | **Neon Postgres** (pooled), SQLite locally | As today. Schema changes become versioned migrations (`stemcloud/migrations.py`). |
| Media | **Cloudflare R2** | The integration is already written (`api/r2_storage.py`). Media leaves git. |
| Hosting | **Vercel**: static Astro build + Python function for `/api/*` | One project, one deploy. |
| Install | PWA (`@vite-pwa/astro`), then Play Store (TWA via PWABuilder), then iOS (Capacitor) | |

## 2. Where we start from

- `api/index.py` (889 lines) holds the whole backend. It also server-renders every lesson to inject the student's progress (`BOOT`, `render_lesson`).
- `site/lessons/*.html` holds 15 chapters, each a self-contained 240–450 KB page. Their sections are `fw_path, story, basics, watch, notes, activities, lab, pushit, quiz, sortgame, walkthroughs, practice, recap, summary, fw_finish`.
- `public/static/*.js` holds about 17 scripts that reshape lesson pages after they load: `player.js` builds the steps, `si.js` translates to Sinhala from `public/static/si/*.json`, `ui-icons.js` swaps emoji, and so on.
- Progress is kept as localStorage `scx_*` keys, stored as one key-value table (`progress(user_id, k, v)`). The merge rules exist twice: Python `merge()` and the JS `BOOT`.
- `tools/build_topics.py` with `tools/topics/*.spec.json` already turns a lesson into structured JSON (Motion pilot). It is the starting point for the extractor.
- Past papers: per-year JSON plus images in `site/lessons/past-papers/` (55 MB).
- Tests: `tests/test_flow.py` (API), plus Playwright browser tests in Python. There is no CI.

**What must survive the migration** (these behaviours are encoded in today's tests and README):
- Login-only lessons.
- Progress that only moves forward.
- Wiping local data on a shared device.
- Offline use of lessons already opened.
- 44 px touch targets and no sideways scroll at 375 px.
- Reduced-motion toggle that keeps animations on by default.
- Tamil neural story audio.
- Read-aloud.
- Deep links to a step (`#quiz`).
- Admin tools.
- Child-privacy rules: no email or real name collected.

## 3. Key design decisions

### 3.1 Lessons stay behind login, still served from the CDN
Today lessons and media are login-only, and `cloudflare-r2.md` treats them as private. We keep that without giving up static hosting:

- When a student logs in, FastAPI sets a second cookie, `scx_gate`, next to `sid`. Its value is `base64(user_id.expiry).HMAC-SHA256(secret)`. It is `HttpOnly`, `Secure`, `SameSite=Lax`, lives 24 h, and is refreshed by every `/api/me`.
- **Vercel Routing Middleware** (`middleware.ts`) runs on `/learn/*`, checks the HMAC with Web Crypto (no database call) and redirects to `/login?next=…` when the cookie is missing or invalid. The pages themselves are still static files from the CDN.
- Trade-off: when an admin signs out a student's devices, lesson pages stay readable for up to 24 h. They are static content only. All personal data stays behind the real `sid` session in FastAPI.
- Setting `GATE_LESSONS=0` makes lessons public later, for search engines or open access, with no rebuild.
- Media stays on the private R2 bucket behind signed URLs (already built). Story audio and public images go on the public bucket behind the CDN.

### 3.2 URLs and languages
- `/learn/<subject>/<grade>/<chapter>/` is the lesson, and `#<step>` deep-links to a step. Example: `/learn/physics/g10/friction/#quiz`.
- `/learn/<subject>/<grade>/<chapter>/topics/<topic>/` is the topic view: the same content, organised by concept.
- **Language is chosen on the device, not in the URL.** Each page carries the active language in the HTML. The three languages are built as separate small JSON payloads (`/content/<chapter>.<lang>.json`), so a page never ships all three. The default language is built into the HTML so it shows without JS. Switching language swaps the payload on the device and remembers the choice (`lessonLang`, as today).
  - Reason: students switch language mid-lesson, and that should not reload the page or lose their place.
- Old URLs (`/lessons/chapter-05-friction.html#quiz`) get permanent (301) redirects to the new ones (see Phase 9).

### 3.3 Content format (lesson schema v2)
The single source of truth is **Pydantic models** in `content_schema/`. They export a JSON Schema, and TypeScript types are generated from it (`json-schema-to-typescript`), so Python tools, the API and React all agree.

```jsonc
// content/physics/g10/friction/lesson.json
{
  "schema": 2,
  "id": "physics.g10.friction",
  "legacy": { "id": "c5", "file": "chapter-05-friction.html" },
  "subject": "physics", "grade": 10, "order": 5, "textbookRef": "Chapter 5",
  "title": { "en": "Friction", "ta": "உராய்வு", "si": "ඝර්ෂණය" },
  "steps": [
    { "type": "story", "id": "story", "lines": [
      { "speaker": "raja", "text": { "en": "...", "ta": "...", "si": "..." }, "audio": { "ta": "c5/line00.mp3" } } ] },
    { "type": "watch", "id": "watch", "animation": "physics/friction-intro", "durationSec": 30,
      "scenes": [{ "from": 0, "to": 11, "title": { "en": "..." } }] },
    { "type": "notes", "id": "notes", "cards": [{ "title": {...}, "blocks": [ /* rich blocks, see below */ ] }] },
    { "type": "lab", "id": "lab", "lab": "physics/friction-slider", "goal": {...} },
    { "type": "quiz", "id": "quiz", "questions": [
      { "id": "physics.g10.friction.q1", "prompt": {...}, "options": [{...}], "answer": 2, "explain": {...}, "hint": {...} } ] },
    { "type": "sort", "id": "sortgame", "bins": [...], "items": [...] },
    { "type": "worked", "id": "walkthroughs", "examples": [...] },
    { "type": "exercises", "id": "practice", "items": [{ "id": "...", "prompt": {...}, "parts": [...], "answer": {...}, "figure": "..." }] },
    { "type": "recap", "id": "recap", "points": [...] },
    { "type": "glossary", "id": "summary", "terms": [{ "en": "friction", "ta": "உராய்வு", "si": "ඝර්ෂණය" }] }
  ],
  "topics": [ /* moved from tools/topics/*.spec.json: topic id, title, which cards/questions/scenes belong to it */ ]
}
```

- **Rich text blocks**:
  - Block types: `p`, `list`, `table`, `formula` (KaTeX at build time, so no runtime JS), `figure` (an SVG or image asset), `callout`, `compare`.
  - Inline marks: bold, italic, sub, sup, term.
  - No raw HTML. This keeps content safe, translatable and renderable by voice.
- **Missing translations**: a text field may leave out `ta` or `si`. The page then falls back to `en` and shows a quiet "not yet translated" marker. CI prints a coverage report per chapter.
- **Content is never faked**: the existing topic-view rule ("coming soon", which doesn't count toward completion) becomes part of the schema (`"status": "missing"`).
- **IDs are stable and global** (`subject.grade.chapter.q1`). Progress refers to them, so they must never be renumbered. CI fails if an ID that already shipped disappears without an entry in `content/_renames.json`.
- `content/catalog.json` is generated from the lesson files. It lists subjects, grades and chapters in order and drives the course home. Nothing about the course list is hard-coded.

### 3.4 Labs and animations
- `labs/` is a registry from id to a React component loaded on demand:
  - `{ "physics/friction-slider": () => import('./physics/FrictionSlider') }`.
  - Each lab is its own bundle.
  - Each lab receives `{ lang, onProgress, reducedMotion }`.
- Until a lab is ported, the registry falls back to **`LegacyLab`**. It is an `<iframe>` of the old lesson page in embed mode (`?embed=1#lab`), which `public/static/embed.js` already supports, so all 15 chapters work on day one.
- Animations (`watch`) work the same way: `LegacyAnimation` uses an iframe with `seg`/`dur`, as the topic view does today. They are ported to React later.

### 3.5 Progress v2 (event-based, works offline)
Replace the key-value bag with typed tables plus an **idempotent event API**. That suits offline phones and keeps one set of merge rules on the server.

```
step_progress(user_id, lesson_id, step_id, opened_at, done_at)              PK(user_id, lesson_id, step_id)
question_attempts(user_id, question_id, attempts, ever_correct, first_try_correct, last_at)  PK(user_id, question_id)
game_scores(user_id, game_id, level, best_stars)                             PK(user_id, game_id, level)
xp_events(user_id, event_id, source, amount, created_at)                     PK(user_id, event_id)
badges(user_id, badge_id, earned_at)                                         PK(user_id, badge_id)
activity_days(user_id, day)                                                  PK(user_id, day)
user_prefs(user_id, lang, theme, motion, reading_mode)
```

- The device writes events to an **outbox** in IndexedDB, each with a unique `event_id`. A nanostore applies them to the screen at once. `POST /api/v2/events` sends them in batches every 1.5 s, when the tab is hidden, and when the device comes back online.
- The server applies events with `INSERT … ON CONFLICT` using the forward-only rules: done stays done, best stars use `GREATEST`, a repeated `event_id` is ignored. Replaying an event is harmless, so a stale phone can never wipe newer progress.
- `GET /api/v2/progress?lesson=<id>` returns a small summary for one lesson. `GET /api/v2/progress/summary` returns totals for the home page.
- XP = `SUM(xp_events.amount)`, with a cached `users.xp_total` so the home page and admin stay fast.
- **Migration**:
  - A one-off script, `tools/migrate_progress_v2.py`, maps every `scx_*` key to v2 rows. Old XP becomes one `legacy` XP event, `scx_done_*` / `scx_path_*` become step rows, `scx_topics_*` become step and question rows, and stars go to `game_scores`.
  - Until the old app is retired, the v1 endpoints keep working **and** write v2 rows as well.

### 3.6 Backend layout (FastAPI)
```
api/index.py                 # Vercel entry: `from stemcloud.main import app`
stemcloud/
  main.py                    # app factory, middleware (security headers), router wiring
  config.py                  # env settings (pydantic-settings)
  db.py                      # Conn wrapper (Postgres/SQLite), unchanged behaviour
  security.py                # hash_pw/check_pw, sessions, gate cookie, CSRF, rate limit
  routers/auth.py            # signup, login, logout, me
  routers/account.py         # name, password, delete
  routers/progress_v1.py     # current /api/progress (kept until cutover, also writes v2)
  routers/progress_v2.py     # events + summaries
  routers/past_papers.py
  routers/admin.py
  routers/media.py           # R2 signed redirects (from r2_storage.py)
  routers/legacy.py          # serves old /lessons/*.html during the transition (render_lesson + BOOT)
stemcloud/migrations.py      # versioned migrations: 1 = baseline (today's schema), then the v2 tables
```

**Decided in Phase 1:** a small versioned migration runner instead of Alembic. Alembic would add SQLAlchemy to the serverless bundle, and Vercel's Python functions have no easy step to run it at deploy time. The runner applies missing migrations on the first connection of each instance, under the Postgres advisory lock the old code already used, and records them in `schema_migrations`. Migrations are written to be safe on a database that already has the tables. (The old schema check ran once per instance, not per request.) A daily job (Vercel Cron) cleans old `ratelimit` and expired `sessions` rows.

### 3.7 Frontend layout (Astro)
```
web/
  astro.config.mjs           # output: 'static', integrations: react(), @vite-pwa/astro
  src/
    layouts/AppLayout.astro  # head, fonts, theme tokens, header, bottom nav slot
    pages/
      index.astro, about.astro, privacy.astro, terms.astro, offline.astro
      login.astro            # <AuthForm client:load/>
      account.astro          # <AccountPanel client:load/>
      admin.astro            # <AdminApp client:only="react"/>
      learn/index.astro      # course home from catalog.json + <ProgressTiles client:idle/>
      learn/[subject]/[grade]/[chapter]/index.astro          # lesson
      learn/[subject]/[grade]/[chapter]/topics/[topic].astro # topic view
      past-papers/index.astro
    components/static/       # Astro, zero JS: NotesCard, Recap, Glossary, WorkedExample, Figure, Formula
    islands/                 # React: LessonPlayer, StoryPlayer, Quiz, QuizSheet, SortGame, Exercises,
                             #        VoiceReader, XpBar, Badges, LangSwitch, BottomNav, PastPapers, LegacyLab
    stores/                  # nanostores: user, lang, progress (+ outbox), prefs
    lib/api.ts               # fetch wrapper: X-Requested-With header, credentials, retry
    styles/tokens.css        # from public/static/theme-bright.css (colours, radii, shadows, type)
  content -> ../content      # read with Astro content collections + the generated Zod/TS types
labs/                        # lab registry + ported labs (imported by web/)
```

- **Design system**: carry over the interface rules in the README (bright palette, Baloo Thambi 2 / Nunito / Noto Sans Tamil and Sinhala, rounded tiles with solid shadows, drawn icons). Fonts are **self-hosted** (`@fontsource`) instead of loaded from Google Fonts, which is faster and works offline.
- **Performance budget**, checked in CI with Lighthouse CI on a simulated slow-4G mid-range Android:
  - Lesson page JS before any interaction ≤ 60 KB gzipped (React plus the player shell).
  - Each lab ≤ 50 KB.
  - LCP ≤ 2.5 s.
  - CLS ≤ 0.05.
- **Service worker** (Workbox through `@vite-pwa/astro`):
  - The app shell and static assets are precached.
  - Lesson pages and lesson JSON are cached the first time they're opened, plus a "Download chapter for offline" action.
  - Story audio is cached only on request.
  - On logout or change of account, the SW clears its lesson caches and the progress outbox (keeps today's shared-device privacy rule).

## 4. Phases

Estimates assume 1–2 developers; they are rough and the main purpose is ordering. The current app stays live throughout, and each phase can be released on its own.

### Phase 0: Groundwork (≈1 week)
- Make this folder a clean monorepo: `stemcloud/` (API), `web/`, `content/`, `content_schema/`, `labs/`, `tools/`, `tests/`, `docs/`. Move the audit and report `.md`/`.txt` files at the root into `docs/notes/`.
- GitHub Actions CI: `pytest tests/test_flow.py`, plus lint (ruff, eslint) and type-check (mypy-light, `astro check`).
- Record a **performance baseline** of today's site (Lighthouse, slow 4G, Moto G class) to compare against.
- Take a production DB backup and a restore drill on a Neon branch.
- Decide the remaining open questions (§6).

### Phase 1: Split the backend (≈1–2 weeks)
- Move `api/index.py` into the `stemcloud/` package (§3.6) **with no behaviour change**. `tests/test_flow.py` must pass unchanged on SQLite and Postgres.
- Versioned migrations (`stemcloud/migrations.py`) with migration 1 = the current schema, safe on the existing production database.
- Add the `scx_gate` cookie (set on signup and login, refreshed on `/api/me`, cleared on logout) plus tests.
- Turn on R2 media (`R2_MEDIA_ENABLED=1`) following `cloudflare-r2.md`, then remove the past-paper images and audio from git. Rewriting git history to shrink the repo is optional and needs team agreement.
- **Done when**: production runs on the split backend, all API tests pass, and the Python bundle is under 20 MB.

### Phase 2: Astro foundation (≈1–2 weeks)
- Set up `web/` (Astro static, React integration, TypeScript strict, nanostores, `@vite-pwa/astro`).
- `vercel.json`: Astro build output plus the Python function. Rewrites: `/api/*` goes to the function, and `/lessons/*` and `/topics/*` go to the function's legacy router during the transition.
- Design tokens, `AppLayout`, self-hosted fonts and drawn icons (port `ui-icons.js` to an `<Icon>` component).
- Port the public pages: home, about, privacy, terms, offline.
- `middleware.ts` gate for `/learn/*` (§3.1).
- **Done when**: public pages are served by Astro in production, Lighthouse meets the budget, and the old lessons still work.

### Phase 3: App shell islands (≈2 weeks)
- `AuthForm` (signup and login, same rules: nickname only, rate-limit messages), `AccountPanel`, `AdminApp`, `BottomNav`, `LangSwitch`, and the theme and motion prefs.
- Course home `/learn/`: greeting, stat tiles, Continue card and grade tabs, built from `catalog.json` (built by hand from the 15 chapters until Phase 4 generates it). Chapter cards link to the **old** lesson URLs for now.
- Port the shared-device rule: when `acct_owner` changes, clear the old student's local data.
- **Done when**: login, home, account and admin are React islands in production, and the old `login.html`, `account.html`, `admin.html` and `index.html` are retired.

### Phase 4: Content schema and extractor (≈2–3 weeks)
- `content_schema/` Pydantic models (§3.3), JSON Schema export and TS type generation (`npm run gen:types`).
- `tools/extract_lesson.py`, built from `tools/build_topics.py`:
  - Parse each section by its id (`story`, `notes`, `quiz`, `sortgame`, `walkthroughs`, `practice`, `recap`, `summary`, …).
  - Pull out the English and Tamil text already in the page.
  - Merge Sinhala from `public/static/si/<chapter>.json`.
  - Pull inline SVG diagrams out into asset files.
  - Write `content/<subject>/<grade>/<chapter>/lesson.json`.
- Fold `tools/topics/*.spec.json` into each lesson's `topics`.
- `tools/validate_content.py` in CI: schema, unique stable IDs, assets exist, translation coverage report.
- **Pilot: Motion in a Straight Line** (`unit-02`), which already has topic data. Then run the extractor on all 15 chapters and record anything it can't parse as TODOs in the report rather than guessing.
- A teacher reviews a side-by-side of old page against extracted JSON for the pilot.
- **Done when**: all 15 chapters validate, and the pilot has been reviewed and approved.

### Phase 5: Lesson renderer (≈3–4 weeks)
- Lesson page: the static parts (notes, worked examples, recap, glossary, figures and formulas) render to HTML at build time. Islands:
  - `LessonPlayer`: one step at a time, Back/Next bar, lesson map, hash deep links, browser Back steps back, the "whole lesson on one page" option.
  - `StoryPlayer`: swipe, tap and arrow keys; Tamil neural audio; the Voices on / Phone / Off cycle.
  - `Quiz` + `QuizSheet` (Correct! / Not quite + explanation), `SortGame`, `Exercises` (reveal answer, multi-part rows, full-screen diagrams).
  - `VoiceReader`: reads the step's text from **content data**, not the DOM, sentence highlighting, units spoken as words. Port the rules from `voice.js`.
  - `XpBar`/`Badges`/confetti.
  - `LegacyLab`/`LegacyAnimation` iframes (§3.4).
- Topic view pages from the same content: Understand / Watch / Explore / Practice. Retire `topics.js`.
- Animations play by default with the motion toggle and `prefers-reduced-motion` respected, and nothing autoplays (*Tap to watch* poster).
- Release the pilot chapter first behind a "Try the new lesson" link, then all 15.
- **Done when**: the browser tests (§5) pass for every chapter on desktop and at 375 px.

### Phase 6: Progress v2 (≈2 weeks, can overlap Phase 5)
- Migration 2 for the v2 tables, `routers/progress_v2.py` and the progress store with its IndexedDB outbox.
- The v1 endpoints also write v2 rows. Run `tools/migrate_progress_v2.py` on a **Neon branch copy** of production first and check that every student's XP, badges, stars and finished flags match. Then run it on production.
- New lesson pages use only v2. The old pages keep v1, which also writes v2, until cutover.
- **Done when**: the migration check shows zero differences and the API tests cover replay, out-of-order delivery and merging from two devices.

### Phase 7: Past papers (≈1–2 weeks)
- Port `past-papers.js` to a `PastPapers` island: year and lesson filters, practice and exam mode, drafts, bookmarks, attempts sync.
- Year JSON moves to `content/past-papers/physics/<year>.json` and is validated by the same CI. Images come from R2.
- Keep the existing `past_attempts` and `past_bookmarks` tables.

### Phase 8: Port the labs (ongoing, ≈2–4 days per lab)
- Order: the pilot chapter first, then the most-used chapters (taken from `step_progress` data).
- Each port: React component, registry entry, Playwright test, then remove that iframe.
- Animations last. They can stay as iframes for a long time without hurting students.

### Phase 9: Cutover and cleanup (≈1 week)
- Permanent 301 redirects in `vercel.json` from every `/lessons/<file>.html` and `/topics/<slug>` to the new `/learn/...` URLs, and `#step` hashes keep working.
- **Service-worker handover**: the new SW is served at the old `sw.js` path with the same scope, deletes all old caches when it activates and takes control of open pages. Test the upgrade from a phone that has the old app installed and has offline progress waiting to sync.
- Retire the v1 progress endpoints once old-SW traffic falls to roughly zero (watch the logs). Then delete `routers/legacy.py`, `site/lessons/*.html`, `public/static/*` (the old app layer) and `tools/sync_lessons.py`.

### Phase 10: App stores
- **Play Store**: package the PWA as a Trusted Web Activity with PWABuilder or Bubblewrap and host `/.well-known/assetlinks.json`. Updates go live with every deploy.
- **iOS** (when demand appears): Capacitor shell with real native value (downloaded chapters and audio for offline use, notifications) so it passes Apple's review. Login uses the same cookie session; check cookie behaviour inside the WebView early.

### Phase 11: Second subject (proves the plan)
- Write `docs/content-authoring.md`: folder layout, schema, IDs, translations, assets, how to add a lab, and the review checklist.
- Add one chapter of a new subject (for example Chemistry G10). **Goal: no app code changes** apart from any new labs.

## 5. Testing strategy

| Level | Tool | What |
|---|---|---|
| API | pytest (existing `tests/test_flow.py` + new) | Auth, CSRF, rate limits, gate cookie, progress v1 and v2 rules, replay and out-of-order events, admin, past papers |
| Content | `tools/validate_content.py` | Schema, IDs, assets, translation coverage, renames |
| Components | Vitest + Testing Library | Quiz marking, sort game, player navigation, outbox and merge in the progress store |
| End to end | Playwright (keep the Python suite and port the checks from `test_pwa.py`, `test_player.py`, `test_topics.py`) | Login gate, 375 px with no sideways scroll, 44 px targets, offline lesson, install prompt, shared-device wipe, deep links, language switch keeps position |
| Performance | Lighthouse CI | Budget in §3.7, on lesson, home and login |
| Migration | Script against a Neon branch | Progress v1 and v2 match for every user |

CI runs everything on each pull request. Vercel preview deployments run against a Neon branch database, never production.

## 6. Open decisions

1. **Lesson visibility.** The plan keeps lessons login-only (§3.1). Should any chapter be public as a free sample or for search engines? Recommended: make the intro lesson public.
2. **Rich text vs. HTML.** The extractor targets rich blocks (§3.3). If some notes are too irregular, allow a temporary sanitized `html` block, which CI reports so it gets cleaned up later.
3. **Where content is authored.** Content is generated today in a separate "course workspace". From Phase 4 the JSON in this repo is the source of truth, so the AI pipeline must output lesson JSON instead of HTML.
4. **Labels for the new UI** (Understand, Watch, …) need Tamil and Sinhala wording from a reviewer.
5. **Teacher and school features** are out of scope for this MVP. The v2 progress tables are designed so that class dashboards can be added later without migrating data.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The extractor misreads hand-built lesson HTML | Pilot first, side-by-side teacher review, and unparsed content goes in the report rather than being guessed |
| Porting labs takes longer than planned | Legacy iframes keep every lab working, so porting can be gradual and prioritised by use |
| Losing student progress during migration | Dual-write, a Neon-branch dry run with a full comparison, forward-only rules and backups |
| Old service workers keep the old app alive on phones | Same SW path and scope, cache purge on activate, upgrade tested on a real old-app install |
| Bundle bloat on cheap phones | Islands only where needed, per-lab splitting, Lighthouse CI budget fails the build |
| Gate cookie outlives a revoked session | 24 h lifetime, static content only; personal data always checks the real session |
| One-region DB latency for Sri Lankan users | Neon region close to users (Singapore, `ap-southeast-1`), and the event outbox hides network latency |

## 8. Order of work at a glance

```
P0 Groundwork ─► P1 Backend split + R2 ─► P2 Astro foundation ─► P3 App shell
                                                        └──► P4 Content schema ─► P5 Lesson renderer ─► P9 Cutover ─► P10 Stores
                                                                   P6 Progress v2 (overlaps P5) ┘          ▲
                                                                   P7 Past papers ──────────────────────────┘
                                                                   P8 Lab ports (ongoing, after P5)       P11 Second subject
```
