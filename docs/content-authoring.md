# Writing lesson content

How a lesson is made for the new pages (`/learn/...`), what checks it, and how to add a new chapter or subject. The
plan behind it is `docs/migration-plan-astro.md`. This guide describes the repository as of 2026-10-13 (Phase 9.1).

## Where things live

| What | Where | Made by |
|---|---|---|
| A lesson (chapter): every step's text, questions, worked examples, exercises, topics | `content/<subject>/g<grade>/<slug>/lesson.json` | today `tools/extract_lesson.py` from the current page; later, by hand or by the course workspace |
| The lesson format (the rules) | `content_schema/lesson.py` | by hand; `python tools/content_types.py` regenerates the JSON Schema and `web/src/lib/content-types.ts` |
| The course list | `content/catalog.json` | `python tools/validate_content.py --write` |
| Ids that have shipped | `content/_ids.json` (and `content/_renames.json` for a moved id) | `python tools/validate_content.py --write` |
| Sinhala | `public/static/si/<page>.json` and `_ui.json` (a translation memory: English → Sinhala) | a translator |
| Labs, games, sort games, animations | `web/src/labs/`, `web/src/games/`, `web/src/watch/` | hand-written islands, or lifted from the current pages by generators (below) |
| Past paper questions | `content/past-papers/physics/*.json` | `tools/validate_past_papers.py` checks them |

## The lesson file

One JSON file per chapter, at the path its id names (`physics.g10.friction` → `content/physics/g10/friction/lesson.json`).
`content_schema/lesson.py` is the source of truth; in short:

- **Text** is `{ "en": ..., "ta": ..., "si": ... }`. English is required. A missing language is **left out, never copied from English**: the page falls back to English and the validator reports the coverage.
- **Rich text** (notes, worked examples, answers) is a small, safe subset of HTML: tables, drawings (SVG), `<b>`, lists. No scripts, event handlers, `javascript:`/`data:` links, iframes or forms; the model refuses them.
- **Steps**, in order: `story`, `basics`, `watch`, `notes`, `activities`, `lab`, `game`, `quiz`, `sort`, `worked`, `exercises`, `recap`, `summary`. Each has an `id`; a lesson uses the ones it has.
- **Topics** (optional): each topic points at a notes card, a slice of the animation (`watch.from`/`to`), quiz questions and exercises **by id**, plus its own summary and Explore (a story, or the lesson's lab).
- **`legacy`**: the current page this lesson came from (`file`, its section id → step id map `steps`, the game's `stars_key`). The new pages use it to read old links (`#practice` → `worked`), to keep the current pages' device keys for missions and stars, and for the cut-over redirects (`stemcloud/legacy_map.json`).

### Ids never change once shipped

Saved progress (steps done, answers, game stars) refers to ids: `physics.g10.friction/quiz`, `physics.g10.friction/q3`.
`tools/validate_content.py` fails if a shipped id disappears. To move one, add `"old id": "new id"` to `content/_renames.json` (create the file for the first rename).

## Checks (all run in CI on every pull request)

```bash
python tools/validate_content.py
```
the format, ids, `legacy` sections, the catalog, and Tamil/Sinhala coverage per chapter.

```bash
python tools/extract_lesson.py --all --check
```
while the current pages are the source: `content/` is what they say, nothing lost.

```bash
python tools/content_types.py --check
```
the schema and TypeScript types match the format.

```bash
cd web && npm run check && npm run build && npm run budget
```
types, the build, and the JavaScript budget (60 KB gzipped per page).

```bash
python tests/test_lesson_pages.py
```
every chapter at 375 px and desktop, every lab, game and animation played, three languages, offline.

The generators below each have a `--check` in CI too.

## Labs, games and animations

There are three kinds:

1. **Rebuilt by hand** (Motion, Newton's laws, Friction, Resultant force, Turning effect, Equilibrium): a Preact island in `web/src/labs/physics/<Name>Lab.tsx` on the shared parts in `web/src/labs/shared.tsx` (guide, stage, missions, readouts, graphs, player). Register it in `web/src/labs/registry.ts` and `web/src/components/lesson/LabIsland.astro`. Its `STRINGS` list feeds the Sinhala lookup.
2. **Data lifted from the page:** the sort games (`tools/sort_games.py` → `web/src/games/sort/<lesson>.json`, played by `games/SortGame.tsx`).
3. **The page's own code lifted unchanged and run in an island:**
   - the cartoon engine (`tools/lab_engine.py` → `labs/engine.js`);
   - the nine slider labs (`tools/slider_labs.py` → `labs/slider/`);
   - the challenge games (`tools/challenge_games.py`);
   - the six one-off games (`tools/level_games.py`);
   - the Watch animations (`tools/watch_anims.py` → `watch/`).

   Each generator copies the page's own script and markup unchanged, and its island gives the script what it used from its page (`document.getElementById` inside the island, XP, storage, the language).

**Adding a lab to a new chapter:** write an island on `labs/shared.tsx` (kind 1). That is the only app code a new chapter may need. Missions earn 5 XP each and 10 for all, once (`useMissions`). The lab step counts as done when a mission or a try is done (`markLab`).

**Before the current pages are deleted (Phase 9 clean-up):** kinds 2 and 3 are generated from `site/lessons/*.html`. Before that folder goes, freeze them:
- keep the generated files as the source;
- remove the generators and their `--check` steps from CI.

The same applies to `tools/extract_lesson.py --check` once `content/` is edited by hand.

## Translations

- **Tamil** is written in the lesson (`"ta"`), next to the English.
- **Sinhala** comes from a translation memory, `public/static/si/<page>.json`, looked up the way `si.js` does on the current pages: the exact text, then the same text with its numbers lifted out (`"v = {0} m/s"`), then short phrases (`"~Next:"`). The extractor fills `"si"` in `content/` from it. Islands get, at build time, only the entries they need (`labSinhala`).
  - **To fill a gap:** add the English → Sinhala entry to the page's dictionary, then run `python tools/extract_lesson.py --all` and `python tools/validate_content.py`.
- **Interface labels** (Understand, Watch, buttons) are in `web/src/lib/lesson-ui.ts` and need a reviewer's Tamil and Sinhala.

## Past paper questions

One bank per year, `content/past-papers/physics/<year>.json`, listed in `catalog.json` in the same folder. Every text
is `{ "en", "ta", "si" }`.

- **A question** is an MCQ (`options`, `correct`, one entry in `optionExplanations` per option, `explanation`) or a written question (`parts`, each with a `label`, a `prompt` and a model `answer`).
- **Chapters:** `lessons` lists the chapters a question belongs to, by the lesson page's file name (`g10-chapter-15-hydrostatic-pressure`). On a written question, give each part its own `lessons`; the question's list is all of its parts' lists. The page groups questions by these.
- **The explanation** of each MCQ and each written part has:
  - a `hint`;
  - `steps`, at least two;
  - in `detailedExplanation`: the `concept` (the idea), the `reasoning` (why it works), a `commonMistake`, and a `practice` question with its answer.

  Write each section for this question:
  - the hint points at what to notice here, not at the topic in general;
  - the steps work it out;
  - each option's reason says why that option is right or wrong.
- **A figure question** (`figure`): read the scan before writing the reasons, and say what each diagram shows.

`python tools/validate_past_papers.py` checks all of this, in all three languages:
- no section repeats another or the answer;
- each option has its own reason;
- no hint is used twice.

The page shows only the sections that add something new.

## Formula cards

All cards are in one file, `content/formulas/physics.json`, in the order the chapters teach them. The page is `/formulas/`, and `/formulas/#<chapter slug>` opens one chapter. A lesson's step bar links to its chapter's cards when it has any.

- **A card** has:
  - `lesson`: the catalog id;
  - `name` and `worked` (one worked example), each `{ "en", "ta", "si" }`;
  - `math`: the formula in symbols, such as `P = h ρ g`. Use `{ "en", "ta", "si" }` only when it is in words;
  - `symbols`: each with its meaning in the three languages and its `unit`;
  - an optional `tip`.
- **`box`** is the English label of the lesson's own formula box that the card comes from (the `flabel` in the notes), or `null` for a formula the notes teach without a box.
- **Terms:** use the textbook terms from the lessons' glossaries: in Tamil, கதி is speed, வேகம் velocity, ஆர்முடுகல் acceleration, திணிவு mass, நிறை weight. Worked examples take g = 10 m s⁻², as the exam does.

`python tests/test_formula_cards.py` (in CI) checks:
- every card is complete in the three languages and names a lesson of the catalog;
- each `box` is still in its lesson;
- every formula box of the lessons is on a card. A box that is not a formula is listed in `NOT_A_CARD`, so a new formula in a lesson cannot be missed.

## Practice questions (the learning feed)

Each chapter has one file, `content/practice/<subject>/<chapter>.json`, with up to 100 questions. `/feed/#<chapter>` shows all of them, one per screen like a reel, in a random order: questions not answered yet come first, then the ones answered wrong come back, then the ones already right.

- **These are practice questions, not past paper questions.** They are written from the lesson, in the style of the past papers, and the page labels them "Practice question".
- **A question** is `mcq` (3 or 4 `options`, `correct` is the index) or `tf` (`correct` is 1 for true, 0 for false), with:
  - `q` and a one-line `why`, in English and Tamil. Sinhala (`si`) is added after review; once a question has it, it must be complete.
  - a `topic`, and a `level`: `recall`, `apply` or `think`.
  - `calc`, for a numeric answer: the sum as written in the reason, such as `"3 * 1000 * 10"`.
  - `figure`, for a question with a picture: a kind from `web/src/feed/figures.tsx` with its numbers, such as `{"kind": "hydraulic", "a1": "10 cm²", "a2": "200 cm²", "f1": "20 N", "f2": "?"}`.

`python tools/validate_practice.py` (in CI) checks every question:
- the languages, one right answer, no repeated options or questions;
- every `calc` is worked out again: the right option must show the result, and no other option may.

`python tools/practice_review.py <chapter>` writes `docs/review/<chapter>.md`, a sheet for a teacher to check every question in both languages.

## Adding a chapter, or a new subject

1. Write `content/<subject>/g<grade>/<slug>/lesson.json`: copy a chapter of the same kind and replace its content. Give every step and question a new id.
2. Put its figures in the lesson as SVG where you can. Images go under `public/static/`; in production media is served from Cloudflare R2, and `tools/r2_media.py` plans, uploads and checks new media there.
3. If it has a lab, write it as above.
4. Run `python tools/validate_content.py --write`. It updates the catalog and records the new ids. Fix what it reports.
5. Build and run the browser test. A new chapter is picked up by the lesson pages, the topic view and the test without code changes (the goal of Phase 11).
6. **Review:** before students see it, a teacher reads it in all three languages on a phone (375 px). Check especially:
   - the worked examples' steps and units;
   - every quiz answer and its explanation;
   - the drawings at phone size;
   - the Sinhala coverage the validator reports.
