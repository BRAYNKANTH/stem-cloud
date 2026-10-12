# STEM Cloud migration log

What has been done so far in the move to **Astro + Preact islands + FastAPI**: the blockers we hit and how each was handled, and the decisions made or changed along the way.

- **Covers:** 2026-10-10 to 2026-10-12, Phases 0–4 and milestones 5.1–5.2.
- **Companion documents:** the plan is in [migration-plan-astro.md](migration-plan-astro.md); steps only the site owner can do are in [owner-tasks.md](owner-tasks.md).

## 1. Where things stand

| Phase | Status | What students notice |
|---|---|---|
| 0 Groundwork | ✅ done | nothing |
| 1 Backend split + R2 media | ✅ done | nothing; past-paper scans and PDFs now come from Cloudflare R2 |
| 2 Astro foundation, deploy, public pages | ✅ done, except milestone 2.4 (on hold) | faster home, about, privacy and terms pages; a phone menu |
| 3 Login, account, admin | ✅ done, except the course home (moved to Phase 5/6) | new login, account and admin pages; same wording |
| 4 Lesson format + extraction | ✅ done | nothing yet; all 15 chapters exist as JSON, ready for Phase 5 |
| 5 New lesson pages | in progress: 5.1 (page and player) and 5.2 (story, quiz, exercises) done | a "Try the new lesson" link on Motion; the current lessons stay the default |
| 6 Progress v2 · 7 Past papers · 8 Labs · 9 Cut-over · 10 App stores · 11 Second subject | not started | |

**Live in production** (checked by the smoke test after every deploy):
- **Served by Astro:** `/`, `/home`, `/about`, `/privacy`, `/terms`, `/login`, and `/account`, `/admin` and the new lessons (`/learn/...`) once signed in.
- **Unchanged:** lessons, the course home, past papers and the API.

**Measured improvement:** this is the same local Lighthouse test as the Phase 0 baseline (mobile, slow 4G).

| Home page | Before | After |
|---|---|---|
| Performance score | 82 | **100** |
| Main content shows after | 3.5 s | **1.8 s** |

Every Astro page loads 1.6–18.5 KB of JavaScript, against a budget of 60 KB.

## 2. Pull requests

| PR | Milestone | Notes |
|---|---|---|
| #1 | Phase 0: plan, CI, performance baseline | |
| #3 | Phase 1: backend split into `stemcloud/`, versioned migrations, lesson-gate cookie code | opened and merged by BRAYNKANTH from Claude's branch; #2 (the same commit) was closed |
| #5 | Phase 1b: lesson media from Cloudflare R2, `/healthz` reports how media is served | opened by BRAYNKANTH; #4 (the same branch) was closed |
| #6 | 2.1 Astro foundation (Preact islands, design tokens, fonts, CI) | |
| #7 | 2.2 Vercel builds Astro next to the Python API | |
| #8 | 2.3a Privacy and Terms in Astro | |
| #9 | Production smoke check after every deploy | |
| #10 | 2.3b About page, shared top bar, drawn icons | |
| #11 | 2.3c Home page; `/` still sends signed-in students to their lessons | |
| #12 | Performance tool can measure any server; Astro snapshot | |
| #13 | Owner task list | |
| #14 | 3.1 Login page | |
| #15 | 3.2 Account page, phone bottom bar | |
| #16 | 3.3 Admin page | |
| #17 | Plan update: Phase 3 status, course home moved | |
| #18 | 4.1 Lesson format, generated types, content checker | |
| #19 | 4.2 All 15 chapters extracted (English + Tamil) | |
| #20 | 4.3 Sinhala, checked against `si.js` | |

**The working routine (from #6 on):**
1. Claude opens a PR.
2. Once CI passes, it is merged automatically.
3. Then a script waits for the production deploy and runs the smoke check.

Nothing is merged with failing checks.

## 3. Decisions

### The big ones
| Decision | Why | When |
|---|---|---|
| **Astro + islands** instead of a React single-page app | The lessons are mostly reading. Astro sends plain HTML and only the interactive parts load JavaScript, which suits low-end phones on slow data. | Planning, at the owner's question "is there a better plan than React?" |
| **Preact** instead of React for the islands | React's runtime alone made a one-button page 70.7 KB of JavaScript; with Preact it is 10.4 KB. Components are written the same way. | 2.1 (owner's choice) |
| **Keep FastAPI**, split into modules | Its auth, CSRF, rate limits and progress rules are proven. It is split, not rewritten. | Planning |
| **Lesson content as typed JSON in the repo** | New subjects should be content, not code. | Planning |
| **Lessons stay login-only** | They were login-only before. Media is in a private R2 bucket. | Planning |

### Decided during the work
| Decision | Instead of | Why |
|---|---|---|
| A small built-in **migration runner** (`stemcloud/migrations.py`) | Alembic | Alembic would add SQLAlchemy to the serverless bundle, and Vercel has no easy deploy-time step to run it. Migration 1 is the existing schema, safe on the production database. |
| **Python route decides, then serves the Astro build** for `/`, `/login`, `/account` and `/admin` (built under `/shell/` and bundled with the function) | Static pages, or Vercel middleware | Signed-in redirects, the login check and the admin check stay on the server. It needs no Vercel secret, and if the build were missing it falls back to the old page instead of an error. |
| **Rich text kept as checked, safe HTML** (notes, worked examples, answers) | Converting everything to structured blocks | That HTML is hand-built with tables and drawings. Converting it would take weeks and risk losing content. This was open decision 2 in the plan. |
| **Lesson JSON generated from the HTML pages for now**, with a CI check that they match | Editing JSON straight away | Lessons are still edited as HTML in the course workspace. The JSON becomes the source of truth when the new lesson pages ship. |
| **R2 private bucket only** (147 files, 122 MB) | Also a public bucket with its own domain | The public part is only about 3 MB and needs a custom domain. |
| **Production smoke check** on GitHub Actions | Checking Vercel previews | Previews need a Vercel login, and the owner's network blocks `stemcloud.site`, but GitHub's runners can reach the site. |
| Theme switch saves `stem_theme` **and** `lessonTheme` | `stem_theme` only, as on the old About page | So lessons follow the choice. |

### Plan changes
- **The offline page stays at `/static/offline.html` until Phase 9.** The current service worker uses it as its offline fallback.
- **The course home (`/lessons/index.html`) moves to Phase 5/6.** It runs on old browser-stored progress and the old app scripts, so porting it now would mean rebuilding v1 progress syncing only to replace it.
- **Milestone 2.4 (the edge lesson gate) is on hold.** It needs `GATE_SECRET` in Vercel (owner task). With the "Python route decides" pattern it may not be needed at all: the new lesson pages can be gated the same way.

## 4. Blockers and how they were handled

### Environment and access
| Blocker | What happened | Handling |
|---|---|---|
| The owner's network blocks `stemcloud.site` | A Palo Alto filter labels it a **newly registered domain**. It blocks the browser, curl and the web-fetch tool alike. | Production is checked from GitHub Actions instead (`tools/smoke_check.py`). Schools may block the site the same way, so recategorisation requests are an owner task. |
| No Vercel access for a while | The owner couldn't check previews. | The smoke check runs after every production deploy and reports whether each page comes from Astro or Python. Changes were built so the worst case is the old page, not an error. |
| Python 3.14 | The embedded Postgres used by the tests (`pgserver`) has no build for it. | A Python 3.12 virtual environment, the same version Vercel uses. |
| GitHub CLI not signed in | The first sign-in failed, partly because of PowerShell's syntax for running a quoted path (`& "...\gh.exe"`). | The owner signed in on the second attempt. |
| Git Bash path conversion | `/privacy` was silently turned into `C:/Program Files/Git/privacy` before being sent to GitHub. | `MSYS_NO_PATHCONV=1`; the smoke script now rejects anything that isn't a site path. |
| App window minimised during tests | Screenshots timed out and the viewport measured 0 px wide. | Pages were checked by measuring them with scripts at fixed emulated sizes (375 px and 1280×800). |

### Secrets
| Blocker | Handling |
|---|---|
| The Neon database password was pasted into the chat | It was not used and not saved. Resetting it is an owner task. |
| The R2 keys were saved into `.env.r2.example`, which git tracks | It was caught before any commit. The keys were moved to `.env.r2.local` (ignored by git) and the template restored. |

### Deployments and R2
| Blocker | Cause | Handling |
|---|---|---|
| The R2 upload couldn't connect | A temporary network failure | Retried; the tool skips files already uploaded. |
| **The new lesson pages could be read without signing in** (after 5.1 and 5.2 shipped, 2026-10-12) | They were published to the CDN under `/shell/learn/`, and the `vercel.json` redirect meant to hide them missed addresses ending in `/`. The production smoke check caught it. | The build now moves the lesson pages out of the published files (`web/scripts/private.mjs` → `web/dist-private/`, bundled with the function only), and the redirect matches every address. Only the lesson text was exposed, no student data. |
| The CI browser test failed on `main` but passed on its PR and locally | Not known yet: GitHub job logs need a sign-in | The test now reports each failure as a GitHub annotation, which can be read without signing in. |
| The activation step couldn't read the bucket's CORS settings | The least-privilege upload key can't read bucket settings. | The tool now checks CORS by requesting a file the way a browser does. |
| The first upload removed the 55 planned public entries from the media manifest | | The tool keeps them on a private-only run. |
| **A Vercel deploy failed** | The R2 activation wrote 147 paths into `vercel.json` (6,084 characters); Vercel allows 256. | `excludeFiles` dropped (`.vercelignore` already lists the files); tested. |
| `/healthz` showed `"media": "local"`, then `"r2-incomplete"` | The R2 settings were missing or incomplete in Vercel. | `/healthz` now names which setting is wrong (never its value). The owner fixed the settings. |
| "Git information retrieval failed" on a preview | A temporary GitHub-to-Vercel problem | An empty commit re-triggered the deploy. |
| BRAYNKANTH merged before Claude did (#3 and #5) | Two people merging | The duplicate PRs were closed. Agreeing a routine is an owner task. |

### Building the app
| Blocker | Handling |
|---|---|
| A React island alone exceeded the 60 KB JavaScript budget | Switched to Preact (owner's decision). |
| `/about` and `/home` still showed the old pages in local development | The dev server's pass-through list was updated, and the browser's cached copy was cleared. |
| The header and content weren't lined up; footer links were 24 px tall; the admin table widened the page on phones | All fixed and re-measured. Every page now has 44 px tap targets and no sideways scroll at 375 px. |
| Account forms sent the previous field values when filled and submitted at once | Each card is now a form that is read when submitted. |
| Only Python 3.9 on the working machine (5.1) | A standalone Python 3.12 from `uv`, in a scratch folder. |
| The new lesson page had no styles when served by the local Python server | Astro's files (`/_astro/`) come from Vercel's CDN in production; the local server now serves them too (local runs only). |
| "Show final answer" showed before the steps were revealed | The old button style beat the `.hidden` rule; `.hidden` now always wins inside lesson content. |
| "Tap to reveal" buttons were 40 px tall | 44 px. All 15 chapters, every step, all three languages: no sideways scroll at 375 px. |

### Extracting the lessons
| Blocker | Handling |
|---|---|
| Six worked-example drawings were empty in `content/` (found in 5.1): the old pages' script draws them when the page loads | Captured once in a browser (`tools/drawn_figures.py`), with colours as theme variables; the extractor fills them in and the validator fails on any empty drawing. |
| The first extraction lost real content: the "Common mistakes" boxes, the later parts of multi-part exercises, glossary meanings, two summary headings | A self-check now compares every English and Tamil text unit of the page with the JSON, and CI fails if any is lost. Result: **7,294 of 7,294.** |
| Extracting all chapters took over 10 minutes | BeautifulSoup compares elements by their whole content. Switching to identity checks made a chapter take about 1 second. |
| One quiz couldn't be read | It used a different array layout. JavaScript literals are now read by matching brackets and evaluating in a Node sandbox. |
| Tamil typos in the source (`</b்` in 4 Resultant Force paragraphs) | Repaired in the JSON and reported. Fixing them at the source is an owner task. |
| The Sinhala port first differed from the browser in 2 of 591 units | The glossary heading rule and the browser's second pass were added. Now **591 of 591 identical** on two chapters. |

## 5. Existing problems found and fixed on the way
- **Shared computers:** the old login page never cleared the previous student's offline lesson copies, because it called `pwa.js` before it had loaded. The new login page does clear them.
- **Admin passwords:** generated student passwords used `Math.random()`. They now use `crypto.getRandomValues` (same `Phys-xxxxxx##` format).
- **Open redirects:** a test now proves `/login?next=//evil.example` and `https://…` never leave the site.
- **Tamil typos** in Resultant Force (see above).
- **Missing test dependency:** `httpx` was missing from `requirements-dev.txt`.
- **Outdated UI tests:** 13 checks in `tests/test_player.py` already failed before the migration. They test interface that the bright redesign changed, and they are not fixed yet.

## 6. Checks that now run on every pull request
- API flow on SQLite and on a real embedded Postgres (`tests/test_flow.py`).
- Backend units (`tests/test_backend.py`): migrations, the lesson-gate cookie, the media status, and the `/`, `/login`, `/account` and `/admin` routes.
- R2 media routing (`tests/test_r2_storage.py`).
- The lesson format (`tests/test_content_schema.py`) and the Sinhala port (`tests/test_sinhala.py`).
- Lesson content:
  - `content/` matches the lesson pages and nothing is lost (`tools/extract_lesson.py --all --check`);
  - format, links, stable ids and catalog (`tools/validate_content.py`).
- Web app: generated types are current, TypeScript check, build, and the 60 KB JavaScript budget per page.
- **After every production deploy:** the smoke check of public pages, the API, static files, and the login redirects on `/lessons`, `/account` and `/admin`.

## 7. What is waiting on the site owner
These are all in [owner-tasks.md](owner-tasks.md), and none of them blocks the next phase:
- reset the Neon password;
- `GATE_SECRET` (only if the edge gate is still wanted);
- a Neon branch per preview deployment;
- an optional Vercel automation bypass secret;
- Neon backup branches;
- the domain recategorisation requests;
- agreeing the merge routine with BRAYNKANTH;
- review of the Terms page;
- Tamil and Sinhala wording for the new interface labels;
- fixing the 4 Tamil typos at the source;
- filling the Sinhala gaps (79–96% coverage per chapter);
- reviewing the extracted lessons once Phase 5 shows them.

## 8. Phase 5 so far
**5.1, the lesson page and player** (2026-10-12):
- All 15 chapters at `/learn/<subject>/g<grade>/<chapter>/`, built from `content/`. Python checks the sign-in, then serves the build. The CDN copy under `/shell/learn/` is redirected to that check.
- The lesson player: one step at a time, Back / Next, lesson map, `#step` links, browser Back, "whole lesson on one page".
- Labs, games, the sort game and the animation come from the current page in a frame.
- 19 KB of JavaScript per page.

**Decisions:**
- All three languages are in the HTML and CSS shows one, so switching is instant and keeps the student's place. Motion is still smaller than today's page: 45 KB gzipped, against 70 KB.
- The content styles are ported from the old pages by a tool, not redesigned.
- The edge gate (2.4) is not needed.

**5.2, story, quiz and exercises** (2026-10-12):
- The story player, the quiz with its answer sheet, and the exercises' rows and full-screen diagrams, ported from the current pages with their look.
- A "Try the new lesson" link on the current Motion page.
- A browser test in CI covers every chapter on a phone and a desktop, plus Motion's player, story and quiz: 90 checks.
- 27.8 KB of JavaScript per page.

**Found on the way:** two key presses or swipes that came before the story re-rendered counted as one; fixed, and tested. Quiz options were 40 px tall; now 44 px.

**Next (5.3):** read-aloud for each step.
