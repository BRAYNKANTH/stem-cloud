# STEM Cloud migration log

What has been done so far in the move to **Astro + Preact islands + FastAPI**: the blockers we hit and how each was handled, and the decisions made or changed along the way.

- **Covers:** 2026-10-10 to 2026-10-12, Phases 0–7.
- **Companion documents:** the plan is in [migration-plan-astro.md](migration-plan-astro.md); steps only the site owner can do are in [owner-tasks.md](owner-tasks.md).

## 1. Where things stand

| Phase | Status | What students notice |
|---|---|---|
| 0 Groundwork | ✅ done | nothing |
| 1 Backend split + R2 media | ✅ done | nothing; past-paper scans and PDFs now come from Cloudflare R2 |
| 2 Astro foundation, deploy, public pages | ✅ done, except milestone 2.4 (on hold) | faster home, about, privacy and terms pages; a phone menu |
| 3 Login, account, admin | ✅ done, except the course home (moved to Phase 5/6) | new login, account and admin pages; same wording |
| 4 Lesson format + extraction | ✅ done | nothing yet; all 15 chapters exist as JSON, ready for Phase 5 |
| 5 New lesson pages | ✅ built (5.1–5.4); waiting for a teacher's review before more chapters get the link | a "Try the new lesson" link on Motion; the current lessons stay the default |
| 6 Progress v2 | ✅ built (6.1–6.3); the one-off migration of older progress is an owner task | the new pages keep progress and XP; nothing changes on the current pages |
| 7 Past papers | ✅ built (7.1–7.2) | a "Try the new past papers" link on the current page |
| 8 Labs · 9 Cut-over · 10 App stores · 11 Second subject | not started | |

**Live in production** (checked by the smoke test after every deploy):
- **Served by Astro:** `/`, `/home`, `/about`, `/privacy`, `/terms`, `/login`, and, once signed in, `/account`, `/admin`, the new lessons and topic pages (`/learn/...`) and the new past papers (`/past-papers/`).
- **Unchanged and still the default:** the current lessons, the course home and the current past papers page.

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
| #21 | This log (Phases 0–4) | |
| #22 | 5.1 Lesson pages from `content/`, the lesson player | |
| #23 | 5.2 Story, quiz, exercises; "Try the new lesson" on Motion | |
| #24 | Fix: keep the login-only lesson pages out of the published files | found by the production smoke check |
| #25 | 5.3 Read-aloud | |
| #26 | 5.4a Topics in the lesson format | |
| #27 | 5.4b Topic pages | |
| #28 | 6.1 Progress v2 tables and events API | |
| #29 | 6.2 v1 → v2 dual-write and the migration tool | |
| #30 | 6.3 The new pages keep progress (offline outbox) | |
| #31 | 7.1 Past papers on the new pages | |
| #32 | 7.2 Past paper banks are content | |

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
- Generated files are current: the content styles (`tools/lesson_css.py`), the past papers styles (`tools/past_papers_css.py`) and the v1 → v2 map (`tools/legacy_map.py`).
- Past paper banks (`tools/validate_past_papers.py`, `tests/test_past_paper_content.py`).
- **The new pages in a real browser** (`tests/test_lesson_pages.py`, 150 checks): every lesson and topic page at 375 px and on a desktop, the player, story, quiz, read-aloud, topic view, progress (including offline) and past papers.
- **After every production deploy:** the smoke check of public pages, the API, static files, and the login redirects on `/lessons`, `/learn`, `/past-papers`, `/account` and `/admin`, including that the build's own copies of login-only pages are never served.

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

## 8. Phases 5–7
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

**5.3, read-aloud** (2026-10-12):
- The Listen button reads the step with the phone's voice, highlighting each block, with the reading controls of today's pages.
- **Decision:** it reads the text the step shows. That is the content in the student's language, since the other languages are hidden, so nothing is shipped twice.

**5.4, the topic view** (2026-10-12):
- 5.4a: topics in the lesson format; the extractor fills them in from the topic map. Only Motion has one: 5 topics.
- 5.4b: the topic pages (topic list; Understand, Watch, Explore and Practice; revision), built like the lesson pages and login-only.
- **Found on the way:** after 5.1 and 5.2 shipped, the lesson pages could be read without signing in at the CDN address ending in `/` (see §4). Fixed in #24 by keeping them out of the published files.

**Next:** progress v2 (Phase 6). Phase 5 is complete once a teacher has checked Motion and more chapters get the "Try the new lesson" link.

**5.4, the topic view:** topics in the lesson format, filled in by the extractor from the topic map (only Motion has one), and the topic pages built from them. Login-only, like the lessons.

**Phase 6, progress v2:**
- **6.1:** the v2 tables and an events API that only moves forward. A repeated event is ignored, and events can arrive in any order or from two devices. Tested on SQLite and Postgres.
- **6.2:** every save from the current pages also writes v2 (dual-write, inside a savepoint), and `tools/migrate_progress_v2.py` converts older progress and checks it.
- **6.3:** the new pages send events through an outbox on the device, so progress made offline is sent later. One-time XP rewards have fixed ids, so a reload can't count them twice.
- **Waiting on the owner:** running the migration on a Neon branch copy, then on production.

**Phase 7, past papers:**
- **7.1:** the past papers page on the new pages, with the same device storage and API as today. Students can switch between the two pages.
- **7.2:** the question banks moved to `content/`, with a validator in CI. 9 banks, 155 questions.

**Found on the way:**
- **The new lesson pages could be read without signing in** at their CDN address ending in `/`. The production smoke check caught it, and #24 fixed it. Only lesson text was exposed.
- **The CI browser test failed now and then.** Checks read the page before it had updated, and one quiz key listener started late. The checks now retry, and the listener starts at once.
- **Vercel preview deploys have failed twice without a reason** (#30, #32). Both succeeded when re-run. Owner task: look at the failed deploys in Vercel.

**Next:** Phase 8, the labs, one chapter at a time, starting with Motion's. Phase 9 (the cut-over) needs the owner first: the progress migration and a teacher's review.

## 9. Phase 8, the labs

**8.1, the Motion lab** (2026-10-12):
- All 15 lesson pages share one cartoon engine (Raja, Chittu, bubbles, arrows), identical in every page. `tools/lab_engine.py` lifts it unchanged into `web/src/labs/engine.js`, and CI checks it stays current.
- The unit 2 lab is rebuilt as an island: the simulation, track, graphs, the guide's three tries, the missions and the stage. Same formulas and drawing code as today.
- Sinhala works the way `si.js` does (exact text, number templates, phrases), with only the entries the lab needs sent to the page.
- Missions keep today's device keys, so a student's ticks carry over. They earn XP through progress v2 (5 each, 10 for all three).
- Other chapters' lab steps still show the current lab in a frame until they are rebuilt.

**8.2, the Force lab** (2026-10-13):
- The guide, stage, missions, readouts and graphs that every lab has are now one shared part (`labs/shared.tsx`), so each new lab is only its simulation and drawing.
- Chapter 4's (Newton's laws) Force lab is rebuilt on it. The Motion lab now uses it too, and its checks still pass.

**8.3, the Friction lab** (2026-10-13): chapter 5's lab, rebuilt on the shared parts. It has the floor and block toggles, and friction follows the push up to the limit, then drops to dynamic friction when the block slides.

**8.4, the Resultant and See-saw labs** (2026-10-13): chapters 9 and 11, rebuilt on the shared parts. Five of the 15 labs are now rebuilt.

**8.5, every lab rebuilt** (2026-10-13):
- Chapter 12's Equilibrium lab is rebuilt by hand.
- The other nine pages build their lab from one template, so `tools/slider_labs.py` lifts each page's own lab code unchanged, as it did for the engine. One island draws them all.
- All 15 lab steps now use rebuilt labs. None is in a frame.
- **Found on the way:** the generated labs showed missions in English in Sinhala, because the "Mission 1: …" lines weren't looked up. The new Sinhala check caught it, and it's fixed.

**8.6, the sort games** (2026-10-13): all 15 rebuilt. The data comes from each page, and one island plays them.
- **Found on the way:**
  - The meanings were shuffled while the page was built, and again in the browser. When the page started up, some tiles showed one meaning while answering for another. They are now shuffled after the page starts.
  - Two quick taps could be lost, because the second tap saw the state from before the first. The game now reads the current choice.
  - The chips were 40 px, under the 44 px tap-target rule on phones.

**8.6, the challenge games** (2026-10-13): the nine template pages' mini-games, lifted from each page and played by one island.
- **Found on the way:** two checks read the server before the outbox had sent its batch, and failed on CI's slower machines. They now wait for it.

**8.7, the one-off games** (2026-10-13): the six games written their own way. Each page's own markup and script now run inside an island, with the page's helpers given to them, so they behave exactly as today. No game is in a frame any more.

**8.8, the Watch animations** (2026-10-13): each page's own card and player now run inside an island on the new pages, and the topic pages use the rebuilt parts too. Every lab, game, sort game and animation is rebuilt, and no lesson or topic page uses a frame.
- **Found on the way:** with every island counted, the Motion page reached 59.3 KB of its 60 KB JavaScript budget. The Watch player now loads only once the step is on screen, which brings every page under 54 KB.

**Phase 8 is complete.**

**Next:** Phase 9, the cut-over, which needs the owner first:
- the progress migration on a Neon branch copy, then on production;
- a teacher's review of the new lessons;
- the owner's sign-off.

## 10. Phase 9, the cut-over

**9.1, ready behind a switch** (2026-10-13): the cut-over is one setting. `CUTOVER=trial` turns on temporary redirects and `CUTOVER=on` permanent ones; nothing changes until it's set. Old links keep their step, and the new pages work offline.
- **Found on the way:**
  - The service worker kept only the current pages offline, so the new pages wouldn't have opened offline after the cut-over. It now keeps them, with everything their islands load.
  - The sort game's last event could be lost if the student left the page at once (CI caught it). Leaving the page now also sends the page's own events.
  - **The progress outbox could get stuck.** It opened a new storage connection for every read and write and never closed them, and one send that never finished stopped all later ones on that page. In a long session, events piled up unsent: this was the real cause of the CI failures above. Now there is one connection per page, and a send gives up after 20 s.
  - With the player's code coming from the cache, the player could start before the page had finished loading. The page's own script then also marked the first step, so two steps showed at once. The script now leaves the choice to the player.
  - `tests/test_pwa.py` (not in CI) has one failing check about the current pages' story animation with reduced motion. It fails the same way without these changes, and it's left as a separate task.

**Next:** the owner's steps in `docs/owner-tasks.md` (progress migration, review, trial, then on). After that comes the clean-up: removing the old pages and the v1 endpoints.

## 11. Past papers, by chapter and fully explained (2026-10-14)

The owner asked for past papers to be the key part of the system: more explanation, a better page, and questions
grouped by chapter.

**The page (#45):**
- `/past-papers/` now opens on the chapters, not the years. A chapter shows its questions from every paper, with filters (all, multiple choice, written, not yet right, saved).
- **Practise this chapter** gives a set of 10, weakest first, with a summary at the end. The years view keeps paper practice (timed, scored).
- After an answer, the chosen option and the right one are marked, with a reason on each. The explanation comes in parts: the answer, the idea, step by step, why it works, watch out, try one like it, and a link to the lesson.
- Written parts are self-checked ("I got it" / "Needs more practice").
- A question right for the first time is worth 5 XP, once. All of it is in English, Tamil and Sinhala.

**The explanations (#46–#54, one PR per year, 2023 back to 2015):**
- All 155 questions were rewritten: 120 MCQs and 141 written parts, 261 explanations in all.
- The first explanations were machine-made and mostly placeholders. An audit found:
  - 241 of 261 hints were general rather than about the question;
  - 172 steps only repeated the answer;
  - 106 option reasons said "use the principle in the worked explanation";
  - many "ideas" were about the wrong topic.
- Each question now has a hint for that question, worked steps, the idea, why it works, a common mistake, a practice question with its answer, and a reason for every option.
- Sinhala was added throughout; before this, Sinhala covered only the page.
- Chapters were checked and fixed. Each written part now names its own chapter, so a question about two topics appears in both. Only two questions have no physics chapter: a diffusion question and a burette question.

**Errors in the old banks, corrected against the paper scans:**
- 2018 Q25: the explanation misquoted option 4.
- 2018 Q37: the English called a tank's valve pit (bisokotuwa) a hydroelectric surge tank.
- 2017 Q27: option 2 is a Zener diode, not an "ordinary diode".

**Kept that way (#55):** `tools/validate_past_papers.py` now also checks the explanations:
- every section is present in all three languages;
- no section repeats another or the answer;
- each option has its own reason;
- a hint is never shared between questions;
- none of the old placeholder text remains.

Run against the old 2016 bank, it reports all 30 of its questions.

**A calmer page (#56).** The owner found the page had too much friction and packed too much in. It now shows one thing at a time:
- **Home:** a "Continue" card, the chapters, and the years as small buttons. The three stat boxes and the chapter/year tabs are gone.
- **Chapter:** its questions as a plain list, showing the start of each prompt. Four filters replace six chips and a year menu.
- **Question:** its own screen, with Previous and Next kept at the bottom.
- **After an answer:** the verdict with one reason. Only the chosen and the right options show reasons; the full explanation is folded away and opens by itself after a wrong answer.
- **Written questions:** typing is optional. A question opened from a chapter shows that chapter's parts first.
- **Paper practice (sitting a whole paper) is removed.** A paper someone had started is kept as drafts.

## 12. The mobile audit fixes (2026-10-14)

A phone-first audit of the whole app (375 × 812, English and Tamil) found 16 problems. All of them are fixed:

**Navigation: one way to each place.**
- Three bottom tabs: **Learn** (the course home), **Past papers**, **Me**. The old Home tab and the Learn tab (a shortcut to the last chapter) were the same place twice.
- Every "home" goes to the course home: the logo, the footer and the lesson back arrow. The logo used to open the marketing page.
- `/learn/` (and `/learn/physics/g10/`) opens the course home. An address that is not there shows a page with a way back, not `{"detail": "Not Found"}`; the API keeps its JSON (`stemcloud/main.py`).
- A lesson has one pager: Back / Next, sticky at the bottom in thumb reach. The top bar keeps Listen and the step picker ("Step menu"); the bottom one is "Step navigation".
- One language button, the same in every header (`islands/LangSwitch.tsx`): a globe and the language, opening the three. The lessons' row of language chips is gone. The light / dark switch moved into the lesson map, to keep room for the chapter name.
- **Me** shows progress first (XP, the day streak, chapters finished, past papers right, what to revisit), then the settings. The progress summary API also lists the lessons finished.

**The labs.** All slider labs share one template (`labs/SliderLab.tsx`):
- The picture comes first and stays in view on a phone while a slider moves; the sliders and the result are right under it. Before, the sliders were 1 541 px down the page.
- One picture slot with a Scene / Diagram switch, where the same tank was drawn twice.
- Sliders are 44 px tall with a 28 px thumb, and have − / + buttons (the density slider moved about 1 px per step).
- A "Try" button sets the lab but does not do a mission for the student; a mission counts only when the student's own change gets there (`labs/shared.tsx`). A done mission says what it showed. The See-saw and Equilibrium labs work the same way; the moving labs still count a mission seen in the motion a Try starts.
- The result reads as one line ("P = hρg = 4 × 1 000 × 10 = 40 000 Pa", no stray "·"), the picture is named by what it shows, and screen readers hear the result when the slider stops.
- In Tamil a lab is always ஆய்வகம் and a mission பணி: the lesson pages were changed and the content regenerated.

**Accessibility and look.**
- Focus: an ink ring with the mango ring outside it, about 16:1 against the page; the mango alone was 1.66:1 (WCAG 1.4.11 asks 3:1).
- The lesson page's H1 is the chapter name; the steps' headers are plain blocks.
- "1 to revisit" on past papers: 6.6:1 (was 4.42:1).
- Weight carries the hierarchy: headings 800, controls 700, labels 600, reading text 400.
- The course home: one skip link (two differed by a letter), 12 px stat labels.
- The service worker version is v26, and a new version fills its cache from the server, not from the browser's copy.
## 13. Formula cards (2026-10-14)

From the audit's list of features, the owner chose formula cards. `/formulas/` has 39 cards from the 14 chapters that have formulas; Electronics has none.
- **A card:** the formula, each symbol with its meaning and unit, one worked example (g = 10), and a tip. It links to the lesson's notes and the chapter's past paper questions.
- **The deck:** one card at a time, swiped, with Previous / Next or the arrow keys. A list view shows them all. The chapter chips choose a chapter (`#<chapter>` in the address).
- **Test me** hides every formula until it is tapped, for revision.
- **Languages:** all three. Tamil and Sinhala use the textbook terms of the lessons' glossaries.
- **Ways in:**
  - a Σ button in every lesson's step bar, which opens that chapter's cards;
  - "Revise with the formula cards" on a lesson's finish;
  - a card on the course home and on the past papers home;
  - a button on Me.
- **Like the lessons:** login-only (`web/scripts/private.mjs`, the `/formulas` route) and kept offline by the service worker (v27).
- **The data:** `content/formulas/physics.json`. `tests/test_formula_cards.py` ties each card to its lesson's formula box and fails if a lesson gains a formula box that no card shows.
## 14. The learning feed, beta (2026-10-15)

`/feed/` is a feed of short cards, one per screen, swiped up like a reel. The owner chose it from the feature ideas, with video questions added. It is separate for now: nothing in the app links to it, so it can be tried before it is connected.
- **Predict, then watch:** a scene plays and stops at "?". The student guesses, then the scene plays to the end.
  - The three scenes are drawn on a canvas in `web/src/feed/scenes.ts`, so there is no video to download: water jets from a bottle, adding a bulb in series, and melting ice.
  - A card can use a filmed video instead (`video: {src, pauseAt}`).
- **Other cards:** true or false (swipe right or left, or tap); a quick question; a formula card from `content/formulas`.
- **After every answer:** right or wrong at once, a one-line reason, and how all students answered ("62% chose B").
- **The poll:** each student's first answer is kept in `feed_answers` (migration 3), through `POST /api/feed/answer`.
- **Progress:** a score and a streak, kept on the device for now (no XP yet).
- **Content:** 20 cards in three languages, `content/feed/physics.json`. `tests/test_feed.py` checks the cards and the API; `tests/test_lesson_pages.py` checks the page.