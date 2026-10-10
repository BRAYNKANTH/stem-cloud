# Physics past-paper pilot

The 2015 Tamil-medium O/L Science paper provides **14 physics MCQs and 39 physics written subparts across five original questions**. Biology, Chemistry and general science trivia are excluded from the published bank. Mixed written questions 1 and 3 retain only physics subparts and original labels; their full-source marks are omitted.

Open Course contents → Past Papers → Open question bank, or `/lessons/past-papers.html` after signing in. Relevant physics lessons link to topic practice. Changes are local until deployed. The other eight years are available; see [expanded-year coverage](past-papers-expanded.md).

All 53 answers include bilingual teaching notes: the concept, explanatory reasoning, a common mistake and a similar practice question with its answer revealed separately. MCQs also include checked choices, option reasoning and hints. Written questions include model answers, worked calculations and explanatory diagrams where appropriate. Original complete Science scans/PDF are optional source references containing all subjects; they are not practice questions in this physics bank.

`tools/pilot_physics_explanations.py` authors the teaching notes. Available lesson references are checked against the course index and show grade, chapter and title. The 13 supplied textbook PDFs/chapter extracts are catalogued under `site/lessons/textbooks/` as unchanged originals. `tools/textbook_sources.py` maps the verified passages, with independent printed and PDF page numbers for each language. There are 71 textbook links across 49 answers: 39 answers have direct support, 10 have only related reading, and four have no verified match. Related reading is labelled explicitly and does not claim to verify the complete answer. `textbookReferenceStatus` is `verified-with-coverage-gaps`. Prepared explanations work offline after caching and do not make live AI calls. Follow-up chat remains a separate optional feature.

Exercises are untimed physics practice: 14 MCQs or five written questions. Students submit when ready; there is no countdown or automatic submission. These subsets are not complete official Science examinations. Written answers are self-checked, without automatic marks. Attempts do not award lesson XP.

MCQ choices were checked against the Department of Examinations 2015 key. Explanations, translations and written model solutions still require teacher review. `teacherReviewed` remains false.

## Maintain

```powershell
python tools/import_textbooks.py --source-dir 'C:/Users/T.BRAYNKANTH/Downloads'
python tools/build_2015_pilot.py
python tools/import_past_papers.py --source-dir 'C:/Users/T.BRAYNKANTH/Downloads/gce ol past paper/tamil'
```

The build script preserves the original transcription, then publishes an explicit physics MCQ selection and physics-only written subparts. Apply the same scope to future imports. Production reads the physics banks for 2015-2023. See `past-papers-expanded.md` for the expanded rebuild command and coverage gaps.

The API validates against the published physics bank. Historical nonphysics attempts remain in the database but are hidden from physics account state; removed written labels are omitted. Old device data is retained while eligible physics work migrates to `stem_pp_physics_<user>`. Mixed-subject sessions reset, retaining physics responses as drafts. Changed queued written payloads receive new event IDs to avoid conflicting with saved immutable attempts.

Service-worker cache version v19 refreshes the old bank. The UI rejects cached banks without the physics scope marker. Offline question-bank use requires an initial successful online visit. Original textbook PDFs require a connection and stay outside the service-worker cache so native PDF byte-range requests work.

## Validation

`python -X utf8 tests/test_past_papers.py` runs installed Edge with a disposable database. It checks physics-only content, removed-question rejection, legacy migration, scoring, CSRF, account isolation, drafts, untimed practice, year switching, offline replay, Tamil switching, textbook page links, authenticated PDF range requests and mobile layout. The import command verifies every mapped printed/PDF page endpoint directly against the supplied file. Original bytes are recorded with SHA-256 checksums in the source catalog.
