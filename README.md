# STEM Cloud

Cloudflare R2 media integration and activation instructions: [cloudflare-r2.md](cloudflare-r2.md).
It stays disabled until uploads are verified and the deployment is configured.

GCE O/L Physics with Raja and Chittu: fifteen lessons (six earlier chapters, three Grade 10 Part II and six Grade 11 physics chapters), each with a story, a watch-it cartoon, notes, textbook activities, an interactive lab, a challenge game, a quiz, a sort game, worked examples, every textbook exercise with an answer, a recap and a Tamil-English glossary, with student accounts and saved progress (XP, badges, stars, finished lessons) that follow the student to any device.

```
api/index.py        the whole backend (FastAPI): accounts, progress sync, admin, serves the lessons
site/lessons/       the lesson pages (served only to logged-in students)
public/static/       login/account/admin/privacy pages, account.js (sync + account menu),
                    pwa.js + sw.js + manifest (installable app), app-layer.css/js (phone layout),
                    player.js/css (lesson player), story.js (swipe), voice.js (read aloud), questions.js (textbook questions),
                    audio/story/ (neural Tamil story voices), brand/, icons/
vercel.json         routes everything to the function and bundles site/
tests/test_flow.py  39 account/API checks (SQLite and real Postgres)
tests/test_pwa.py   real-browser checks: installability, offline, cache privacy, phone layout, animations (Edge/Chrome)
tests/test_player.py  real-browser checks: lesson player, story swipe, read-aloud, textbook questions, lab
tests/test_topics.py  topic pages: server rules, content integrity, progress merge, real-browser flow on desktop and phone
tests/test_voice_lab.py  voice tools: recorder page, import, re-render
tools/sync_lessons.py   copies updated lessons from the course workspace into site/lessons
tools/make_icons.py     redraws the app icons
tools/build_topics.py   builds the topic-by-topic view of a chapter from its lesson page (see "Learning by topic")
tools/topics/           one spec per chapter: which notes, exercises, quiz questions and animation scenes belong to which topic
site/lessons/topics.html + site/lessons/topics/   the topic page shell and its generated chapter data (served to logged-in students only)
public/static/topics.js/.css, embed.js, hub-topics.js   the topic pages, the framed lesson steps, the link on the course contents page
tools/voice_lab.py      audition Tamil voices, re-record the stories, import real recordings (see "Making the voices natural")
```

## It is an installable app (PWA) and works on phones

- **Install:** Android/Chrome and desktop Chrome/Edge show *Install app* in the account menu (or the browser's own install button). On iPhone/iPad: Safari → Share → **Add to Home Screen**. It then opens full screen with its own icon.
- **Offline:** lessons a student has already opened still work without internet, and XP earned offline syncs when the connection returns. Anything not opened before shows a friendly "no internet" page.
- **Phones:** one-line header (menu, language, account), 44px touch targets, text never below 11px, cartoon stages use the full width and scale their speech bubbles, the lab cartoon stays pinned while sliders are moved, diagrams keep a readable size and pan sideways, `prefers-reduced-motion` is respected.
- **Animations always play** (cartoons, labs, story openers), even when the phone is in battery-saver / "remove animations" mode, which would otherwise freeze them. A student who is sensitive to motion can switch them off in the account menu (*Animations: On/Off*); the choice is remembered on that device.
- **Branding:** the logo lives in `public/static/brand/` (`logo-mark.png` is the cut-out cloud used in headers and icons). Run `python tools/make_icons.py` after changing it to rebuild the app icons. Colours are defined once at the top of `public/static/theme-bright.css`.
- **Fast on slow connections:** web fonts load without blocking the page, and the service worker registers as soon as the page is parsed.
- **Lesson player:** every lesson is a guided path instead of one 20,000-pixel scroll. One step at a time (Story, Watch it, Notes, ...), a bottom bar with Back / progress / Next, and a lesson map (tap the progress, or the menu button). The browser's Back button works step by step, deep links like `chapter-05-friction.html#quiz` open that step, and nothing starts by itself: the animation shows a *Tap to watch* poster. A student who prefers the long page can switch it in the account menu (*Whole lesson on one page*).
- **Story by swiping:** swipe left/right (or tap the bubble, or use arrow keys) between Raja's and Chittu's lines. The big Next/Back buttons only remain on mouse devices.
- **Voice:** the speaker button in the bar reads the current step aloud, sentence by sentence, with the sentence highlighted, pause / skip / speed controls, and units and symbols spoken as words ("5 N" becomes "5 newtons"). In the story, *Voices on* plays the **neural Tamil recordings** of Raja and Chittu (`public/static/audio/story/<chapter>/lineNN.mp3`); English story lines and all other text use the phone's own speech engine. If a phone has no Tamil voice installed, it says so and explains how to install one. To add neural English recordings later, render the lines with `edge-tts` (`en-IN-PrabhatNeural` for Raja, `en-IN-NeerjaNeural` for Chittu) into `audio/story/<id>/en/lineNN.mp3` and extend `playLine()` in `voice.js`.
- **Textbook questions:** multi-part questions such as "(i) ... (ii) ... (iii) ..." are laid out as aligned rows, question numbers no longer shift the text, and tapping a diagram opens it full screen at a readable size.
- **Shared devices:** the offline copies of lesson pages hold one student's progress, so they are wiped on logout and whenever the login page opens.
- **Releasing changes to the app files:** the service worker serves `public/static/*` instantly from cache and refreshes it in the background (new files show on the second visit). To force an immediate refresh for everyone after a release, bump `VERSION` at the top of `public/static/sw.js` (story audio is never cached by the worker, so recordings can be replaced freely).

## Interface rules

One look across the app, set in `public/static/theme-bright.css` (loaded last on every page; the server adds it to the lessons, contents and topic pages, the static pages link it). It follows the STEM Cloud app design (the "STEM Cloud App Design" canvas):

- **Colour:** a bright ground (`#F3F5FF`), ink (`#16183D`), brand blue (`#3443D9`), mango (`#FFB21E`) for "up next" and progress, leaf green (`#1F8A4C`) for done and right, clay (`#C2410C`) for wrong. Bright is the default; dark stays available from the account menu.
- **Shape:** rounded cards and buttons (14 to 28px) with a short solid shadow under them, like a pressable tile; the main button is ink with a blue under-shadow.
- **Type:** Baloo Thambi 2 for headings (Latin and Tamil), Nunito for text, Noto Sans Tamil / Sinhala for long Tamil and Sinhala text.
- **Icons:** drawn, not emoji: the lesson player draws its own (`player.js`), and `public/static/ui-icons.js` (`StemIcon('book')`) swaps emoji in the app's own screens and lesson headings; the text a lesson teaches with (stories, questions, answers) is left alone.
- **App screens:** the lesson start is a chapter path (step tiles in groups, done green, next mango, a Continue button that stays at the bottom); the course contents page has a greeting, stat tiles, a blue Continue card and grade tabs; phones get a bottom bar (Home / Learn / Papers / Me, `nav.js`) on the contents, past papers and account pages; a quiz answer opens a sheet with Correct! / Not quite and the explanation (`quiz-sheet.js`).
- **Phones:** 44px touch targets and no sideways scroll at 375px (checked by `tests/test_pwa.py`).

## Learning by topic (Subject → Chapter → Topic → learning steps)

The lessons are organised by content type (story, notes, animation, games, exercises). The topic pages organise the same material by concept:

```
Physics → Motion in a Straight Line → Distance and displacement → Understand → Watch → Explore → Practice → (next topic)
```

- **Where:** `/topics/<chapter>` (for example `/topics/unit-02-motion-in-a-straight-line`) is the chapter overview (topics in the recommended order, progress, *Start / Continue learning*, chapter revision). `?t=<topic>&s=<step>` opens one step; `?r=1&s=summary|mixed|quiz` opens the chapter revision. The course contents page shows *Learn topic by topic* under every chapter that has topics. Any step can be opened directly at any time; Back/Next and the browser's Back button follow the recommended order.
- **The four steps:** *Understand* (short summary, definitions, comparison table, misconception, key formulas, and the lesson notes under "Detailed notes"), *Watch* (the topic's slice of the lesson animation, with its length, and the notes kept under it), *Explore* (a short story with predictions, or the interactive lab), *Practice* (basic to application; multiple choice is marked with an explanation, a hint and retry; worked questions show the solution and the student marks themselves).
- **Nothing in the lessons was moved or rewritten.** `tools/build_topics.py` reads a lesson page plus `tools/topics/<chapter>.spec.json` and writes `site/lessons/topics/<chapter>.json`. Re-run `python tools/build_topics.py` after `tools/sync_lessons.py`. To add a chapter, write its spec (copy the Motion one) and run the tool; it prints what is still missing for each topic.
- **Missing content is never faked.** A step with no content shows "coming soon", does not count towards the topic being complete, and the overview says how many steps are still to come. The tool's report is the to-do list for the content team. In the Motion pilot: Speed and velocity has no video, story or numerical exercises; Motion graphs has no video; Gravitational acceleration and free fall has no story and no multiple-choice questions; Understand notes exist for every topic, but only Distance and displacement has the short summary, comparison table and misconception (the others show the lesson notes as "Detailed notes").
- **Written for the pilot (review before students rely on it):** the "A walk to the shop" story and the short Understand summary for Distance and displacement (`authored` in the spec). Everything else is existing lesson text.
- **Watch and the lab are the lesson's own steps, shown in a frame** (`embed.js`): `?embed=1&seg=11-20&dur=30` plays only seconds 11 to 20 of the 30-second animation. Inside the frame the lesson's header and step bar are hidden, and the lesson's own bookmarks and completion flags are left alone, so looking at a topic never changes what the lesson page says was finished.
- **Progress** is saved per topic in `scx_topics_<chapter id>` (synced like the rest; only ever moves forward). It keeps three things apart: *opened* (`v`), *done* (`d`: read it / watched it / answered the predictions / tried every practice question), and per question *attempts, ever correct, correct at the first try* (`q`). Opening a page is never counted as done, and the practice summary says its numbers are not mastery. Old chapter-level progress (`scx_path_*`, `scx_done_*`) cannot be assigned to topics reliably, so it is left as it is: the overview only notes that the chapter was finished on the original page, and topic progress starts fresh.
- **Language:** the lesson text in the topic pages follows the language button (English / Tamil from the lessons' own Tamil text; Sinhala through the chapter's dictionary). The new labels (Understand, Watch, Explore, Practice, buttons, messages) are English only for now and need Tamil and Sinhala wording written and reviewed.

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
python tests/test_player.py          # real Edge/Chrome: lesson player, story swipe, read-aloud, questions, lab
```

Covers sign-up, login, CSRF, progress merge rules, lesson gating, path traversal, admin, password change, account deletion and rate-limiting.

## How it works

- Lessons are served only to logged-in users. The server injects that student's saved progress into the page, and `account.js` saves new progress back about 1.5 seconds after each change (and when the tab closes).
- Progress only moves forward: XP takes the higher value, badges are combined, stars take the best per level, finished flags stay finished. A stale phone can never wipe newer progress.
- On a shared computer, switching accounts clears the previous student's local progress so it can't leak into the next account.
- Passwords are salted scrypt hashes. Sessions are random tokens (only a hash is stored) in `HttpOnly`, `SameSite=Lax`, `Secure` cookies, valid 30 days. Every write needs an `X-Requested-With` header (CSRF defence). Login, sign-up and password changes are rate-limited per IP, with counters in the database so the limit holds across Vercel instances.
- `/admin` lists students with XP and badge counts, resets a password (shows a temporary one to tell the student) or deletes an account. Students can change name or password and delete their own account at `/account`.

## Making the voices natural

Speech engines are trained on formal reading (news, audiobooks), so casual spoken Tamil can sound stiff. What the app does about it:
- Tamil is read at a brisk 1.1x (not slowed down), English glosses such as "(see-saw)" are skipped, units are spoken as words.
- In the reading controls the microphone button cycles through **every voice installed on the phone** and remembers the choice (Google Tamil is usually more natural than the others).
- In the story, the voices button cycles *Recorded voices* / *Phone voice* / *Off*, and recordings follow the speed setting.

For a truly natural sound, replace the story recordings (needs `pip install edge-tts imageio-ffmpeg`):

0. **Try Google Gemini voices first** (more expressive, accepts a "casual, like talking to a friend" style, supports Tamil). Get a free key at https://aistudio.google.com/apikey (your Google AI Pro plan is billed separately from this developer key, and the free key needs no payment), then:
   ```bash
   pip install imageio-ffmpeg
   set GEMINI_API_KEY=your-key          (PowerShell: $env:GEMINI_API_KEY="your-key")
   python tools/voice_lab.py sample --engine gemini        # listen to 10 voices on real lines: tools/voice_lab_out/index.html
   python tools/voice_lab.py render --engine gemini --raja Puck --chittu Leda
   ```
   Free keys are rate limited, so this runs slowly (about 7 s per line, 54 lines); use `--only c5,u2` to do a few stories at a time. If Google says the TTS model is not available on the free tier, enable billing on the key's project (a few lines of speech cost very little) or use one of the other routes. The default model is `gemini-3.8-flash-tts` (see https://ai.google.dev/gemini-api/docs/speech-generation if Google renames it; change it with `--model`). Change how the characters sound with `--style-raja "..."` / `--style-chittu "..."`. The key is only ever read from your computer's environment and sent to Google in a header; never commit it.
1. **Audition the Microsoft neural voices** (needs internet): `python tools/voice_lab.py sample`, then open `tools/voice_lab_out/index.html` and listen. Pick the voices that sound like someone talking, not reading.
2. **Re-record all stories with them:**
   `python tools/voice_lab.py render --raja ta-IN-ValluvarNeural --chittu ta-IN-PallaviNeural --rate +8%`
   (add `--lang en` with English voices to record the English story lines too; old files are backed up in `tools/voice_lab_out/backup`).
3. **Or use real human voices (best):** run the app, open `/static/record.html` on a phone, pick a story and language, and have a teacher or student read each line the way they would say it to a friend. Save the files, then `python tools/voice_lab.py import <downloads folder>` converts them (trims silence, evens out loudness, makes mp3s) and puts them in the right place.

Commit `public/static/audio/` and push. Recordings are never cached by the service worker, so new ones are used straight away.

## Privacy (students are children)

No email, phone, real name or tracking is collected, and the sign-up form asks for a nickname. `/privacy` says this in plain words. If you host this for real students, tell their parents or school and decide who gets admin access.

## Known limits

- No email, so **password reset is by the admin only**.
- Every request opens a fresh database connection, which is fine for a class or a few hundred students. For heavy traffic, use Neon's pooled connection string (the Vercel integration already does) and consider connection reuse.
- The six story videos are not part of the site yet (they are large files and need their own hosting).
