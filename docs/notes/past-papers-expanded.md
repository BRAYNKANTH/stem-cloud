# Physics past papers: 2015–2023

Open Course contents → Past Papers → Open question bank, then select a year.
The year selector is visible above the filters on phones and desktops.
Changes are local until deployed.

| Source year | Physics MCQs | Written parent questions |
| --- | ---: | ---: |
| 2015 | 14 | 5 |
| 2016 | 12 | 4 |
| 2017, old syllabus | 15 | 4 |
| 2018 | 14 | 4 |
| 2019 | 12 | 5 |
| 2020 | 12 | 3 |
| 2021 (2022) | 15 | 3 |
| 2022 (2023) | 13 | 3 |
| 2023 (2024) | 13 | 4 |

Only physics questions and physics subparts are practice content. Original numbering
is retained. Adjacent written prompts are sometimes grouped under their original
combined subpart labels. Full mixed-subject source marks are not displayed.
The complete Science PDFs remain optional source references.

Both individual practice and paper practice have no countdown, deadline or automatic
submission. Paper practice hides solutions until manual submission. Responses survive
reloads. Old physics sessions migrate to untimed 2015 practice without losing responses.
Question IDs keep years separate in drafts, bookmarks and account attempts. Written
answers use self-checking and do not receive automatic marks or lesson XP.

## Source and answer limitations

- The supplied 2017 paper is the old syllabus paper.
- The supplied 2020 and 2021 PDFs omit Part II A. The supplied 2022 PDF omits
  Part II A and printed page 5. Only available physics questions are included;
  a visible coverage notice explains each gap.
- 2016 Q8 B(iii)(c), a train/track-length interpretation, is held for review.
  The available momentum subpart is included; the omitted part is disclosed.
- The 2015 MCQ choices have an official checked key. Other years use independently
  worked model answers. None of the new years claims an official marking scheme.
  Translations and model answers need teacher review; `teacherReviewed` stays false.
- New-year textbook links reuse verified passages for background principles and
  are labelled **related reading**, rather than claiming those pages verify a complete
  new solution. Grade/chapter lesson links are checked against the course index.

Each answer includes Tamil and English explanation, governing principles, worked
steps, a common mistake, and a similar practice problem. Source illustrations are
rendered from the supplied scans. Source PDF bytes and SHA-256 metadata are preserved.
PDFs stay on the network for native byte-range viewing; visited bank data and JPGs
can be used offline. The initial bank visit loads all nine years. The service-worker
cache version is v19, and logout clears the private page cache.

## Rebuild and validate

```powershell
python tools/build_2015_pilot.py
python tools/import_past_papers.py --source-dir 'C:/Users/T.BRAYNKANTH/Downloads/gce ol past paper/tamil'
python -X utf8 tools/build_physics_years.py --source-dir 'C:/Users/T.BRAYNKANTH/Downloads/gce ol past paper/tamil'
python -X utf8 tests/test_past_papers.py
python -X utf8 tests/test_pwa.py
```

Authoring lives in `tools/physics_2016_2017.py`, `physics_2018_2019.py`,
`physics_2020_2021.py` and `physics_2022_2023.py`. The common builder applies
the final scan corrections in `corrections()` and writes the published JSON.
API validation reads the physics banks for 2015–2023. The importer preserves
existing published-year catalog entries when rerun.
