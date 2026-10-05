# Past Papers — 2015 pilot

Open **Past Papers → Open question bank** from the course hub, or `/lessons/past-papers.html` after signing in.

## Delivered

- 2015 Tamil-medium Science: 40 MCQs and all 10 written questions, with 118 individually labelled subparts across Biology, Chemistry and Physics.
- Tamil teaching paraphrases, English teaching translations, independently authored explanations, option feedback, calculation steps and model drawings for Charles’s law, the Ohm-law circuit, OR gate and photodiode.
- Original 12-page PDF and page images; diagram-dependent MCQs retain source panels. Original wording/diagrams remain available for comparison.
- Subject, type, topic, search, bookmark, unattempted and needs-practice filters. Relevant existing physics lessons link into this bank.
- Paper I: 60-minute practice, 40 questions, one point per correct answer. Paper II: 180 minutes, four compulsory questions plus one Biology, one Chemistry and one Physics question. Written responses are self-checked, with no automatic essay marks.
- Drafts and timed deadlines persist on the current device. Submitted attempts and bookmarks sync to the signed-in account, independently of lesson XP. Offline submissions retry with their original IDs to avoid duplicates. Account deletion removes stored attempts and bookmarks.
- Previously visited bank pages/data and images can reopen offline. Original PDFs remain online because PDF viewers use byte-range requests. Private caches clear through the existing logout flow.
- All nine supplied source papers are catalogued with filename, page count and SHA-256. **2016–2023 remain pending extraction.** The last paper retains its printed exam label `2023 (2024)`.

## Content status

This is a **pilot awaiting Tamil-medium science teacher review**, not an approved official answer book. Prompts are teaching paraphrases, not claimed verbatim OCR. The papers are image scans and were transcribed visually.

MCQ option numbers were checked against the [Department of Examinations 2015 Science evaluation report](https://www.doenets.lk/documents/evaluation-reports/ol/2015/english/evol15E_Science.pdf), printed page 18. Explanations and written answers are model solutions; no per-subpart official marks are invented.

Review these items before marking the pilot teacher-approved:

1. Paper I Q8, option 1: the regional Tamil term `இளைப்பு` is retained. Its English translation is explicitly awaiting confirmation; other options preserve gastritis, tuberculosis and laryngitis. A source panel is displayed.
2. Paper I Q10: the historical key selects “mother is colour-blind”. Modern X-linked reasoning establishes that the mother carries the allele, which does not require her to be affected. The original option is retained and the discrepancy is explained after submission.
3. Paper II Q10(iii): distinguish the exam’s conventional diode terminal labels from reverse bias in operation. CdS/CdSe is identified as a historical syllabus answer, with a note that these photoconductive materials are not universal modern photodiode materials.
4. Review every Tamil paraphrase, English translation, model answer and diagram against the source before changing `teacherReviewed` to true.

## Maintain/import

The production app reads `site/lessons/past-papers/2015.json`. Python transcription sources are `tools/build_2015_pilot.py` and `tools/pilot_2015_written.py`.

```powershell
python tools/build_2015_pilot.py
python tools/import_past_papers.py --source-dir 'C:/Users/T.BRAYNKANTH/Downloads/gce ol past paper/tamil'
```

The import tool requires PyMuPDF only on the machine building assets. Production dependencies are unchanged. It renders/copies 2015 and catalogues other years; it does not claim automatic Tamil OCR or generate answers for unreviewed years.

The API adds `past_attempts` and `past_bookmarks` tables through the existing schema initialization. Submitted events are validated and MCQs graded on the server. Stable event IDs make replay idempotent. Stored answers are escaped when rendered. User ownership and the existing CSRF header apply to all mutations. Timed practice runs locally; it is not a supervised or cheat-resistant examination system.

To add another year, prepare and verify a separate bank and original assets, update the catalog, and extend both UI selection and server question loading. Do not make a year available merely by changing its catalog status.

## Validation

`tests/test_past_papers.py` uses a disposable database and installed Edge to verify scoring, validation, CSRF, account isolation, persistence, cross-device submitted responses, timed-paper rules, offline retries, language switching and mobile layout. Existing `tests/test_pwa.py` checks offline/cache privacy and `tests/test_player.py` checks lesson navigation and accessibility.

Past-paper checks and the existing PWA suite passed. The lesson regression run passed its navigation, mobile layout, story, voice, animation, accessibility and language checks, then stopped at an admin-login selector timeout (`#u` while the current login form uses `#un`). The full lesson suite is therefore not reported as passing.
