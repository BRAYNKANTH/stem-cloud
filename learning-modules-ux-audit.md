# Grade 10 and Grade 11 learning-module audit

Reviewed 5 October 2026. Scope: the 15 chapters in `site/lessons/index.html` (nine Grade 10, six Grade 11), shared player, story, voice, diagrams and animation controls. This is an analysis; application code was not changed for this audit.

## Evidence and limits

- Reviewed shared JavaScript/CSS and the repeated lesson engines; inspected individual Grade 11 Waves, Optics, Heat and Electromagnetism simulations.
- Ran the existing `tests/test_player.py` real Edge browser suite. It checked all steps in all 15 chapters at 393 × 760 and reported no page-width overflow or script errors in that sweep. Other completed checks covered story gestures, voice controls, diagram enlargement, navigation and modal focus.
- The first run stopped while printing Tamil text because Windows used a non-Unicode console encoding. The UTF-8 rerun completed: five language-button/Tamil-switch assertions failed, while the other checks passed. Those failures align with the new language picker: clicking now opens a choice panel rather than switching immediately, and the button is labelled by the current language. Update those test interactions to select Tamil explicitly before using them to judge translation behavior. This was not a fully passing test run.
- The interactive Browser connection was unavailable. Findings below are code-confirmed behavior or explicitly identified usability/performance risks, not a claim of manual visual verification on physical devices.
- Language-picker/Sinhala work appeared in the workspace during review. Existing tests assume a two-language toggle and English initial labels; failures of those assumptions need assessment against the new picker. This report does not treat unfinished Sinhala translation coverage as a settled application defect.

## Findings, in recommended priority order

### 1. High — Seeing a section counts as finishing it

**Affected:** all 15 lessons; hub completion/progress.

The lesson-path IntersectionObserver calls `mark()` as soon as enough of a section is visible. Opening Quiz marks it done without answering, opening Story marks it done without reaching the last line, and opening Lab marks it done without missions. Visiting every step can set the finished flag and award completion XP. This makes the completion ticks and Continue recommendation unreliable indicators of learning.

**Evidence:** `site/lessons/g11-chapter-04-waves.html:1795`, `:1780`, `:1769`; the same observer/mark pattern occurs in the other lesson files. Hub `progressOf()` uses those flags.

**Reproduce:** in a fresh account, open each lesson step, allow it to appear, then visit the finish screen without completing the activities.

**Recommendation:** distinguish viewed from completed. Complete story at its final line, animation at its end, quiz after submission and games/labs at an explicit outcome; use an explicit acknowledgement for reading steps. Keep free navigation.

### 2. High — “Animations: Off” does not stop the lab animations

**Affected:** shared setting and repeated cartoon engines across both grades.

The account switch changes `html.stem-calm`; shared CSS shortens CSS animations/transitions. The cartoon lab's JavaScript loop still redraws SVG every animation frame while visible. Watch playback and canvas confetti also lack a general calm-mode check. The setting therefore promises more than it delivers. Reduced-motion CSS stops selected decorative hints but does not supply a still, user-controlled alternative for these loops.

**Evidence:** `public/static/account.js:108`, `public/static/app-layer.css:198`; Waves `:2216`, `:2064`, `:2284`.

**Reproduce:** open a moving lab, choose Animations Off, and observe its time-driven drawing continue.

**Recommendation:** make the setting control JavaScript motion as well. Preserve slider-driven static redraws; offer Play/Pause or frame stepping for educational motion and suppress confetti. Default nonessential motion to the device preference.

### 3. High — Matching and sorting games cannot be completed with a keyboard

**Affected:** all 15 matching/sorting games.

Terms, definitions and chips are `div` elements with click handlers. Bins are also click-only divs. They have no tab stops or Enter/Space handlers, and shared scripts do not add them. Keyboard users cannot select and place answers; selected/matched states are only CSS classes.

**Evidence:** Waves `:2422`, `:2434`, `:2468`, `:2501`; matching/chip construction repeats in all lessons.

**Recommendation:** use real buttons for terms and chips, named destination controls for bins, expose selection/completion state and maintain focus when a chip is removed. Verify an entire game using keyboard input alone.

### 4. High — The enlarged-diagram overlay leaves focus behind it

**Affected:** diagrams and figures across both grades.

Unlike the lesson map, `openBox()` does not move focus into the overlay, mark it as a dialog, make the background inert, trap Tab or restore focus on close. Keyboard users can continue tabbing through obscured lesson controls. Screen readers do not receive a dialog transition.

**Evidence:** `public/static/questions.js:47` and `:49`; compare the existing modal helper in `public/static/player.js:132`.

**Reproduce:** focus a figure, press Enter, then press Tab. Focus remains in the underlying page rather than starting on the overlay's Close button.

**Recommendation:** reuse the map's modal behavior, with an accessible name, initial focus on Close and restored focus on dismissal.

### 5. Medium — “Continue” skips a partly read section

**Affected:** shared lesson player and hub.

`go()` writes `stem_step_<filename>` but initialization does not read it: reopening without a hash goes to the overview. The overview picks the next unfinished/unvisited step. Since visibility marks the current step complete, a student who stops halfway through Notes may be sent onward rather than back to their reading position. The hub's Continue link carries only the filename.

**Evidence:** `public/static/player.js:109`, `:203`, `:366`; `site/lessons/index.html` Continue-link construction.

**Recommendation:** restore the last active step and, where useful, note-card/story position. Provide a separate “next incomplete activity” action.

### 6. Medium — Watch playback continues after leaving its step

**Affected:** the repeated Watch-it engine across all lessons.

Watch's animation loop checks `playing`, not whether the Watch section remains visible. The player hides the section and dispatches `stem-step`, but the cartoon engine does not subscribe to that event. Navigating away mid-play can advance the hidden cartoon to a prediction question or completion; enabled sound effects may continue. Returning can show a different point from the one the student left.

**Evidence:** Waves `:2064` and `:2079`; `public/static/player.js:208`. Voice narration already stops on this event, but the cartoon does not.

**Recommendation:** pause playback and sound when leaving Watch; preserve its time and require an explicit resume when returning.

### 7. Medium — Touch story navigation relies on a gesture with little explanation

**Affected:** story steps on touch devices.

CSS hides the ordinary Previous/Next buttons to a one-pixel box unless focused. The textual swipe instruction is also visually hidden. A moving finger is the main cue and becomes quiet after three advances across the device. Students who do not discover swiping can miss story lines or use the prominent lesson Next button to leave the story. Backtracking is particularly hard to discover because tapping only advances.

**Evidence:** `public/static/player.css:63`, `:203`; `public/static/story.js:18` and `:31`.

**Recommendation:** retain small visible story Previous/Next controls and a short “Swipe or tap Next” hint. Use the line number to distinguish story navigation from lesson navigation.

### 8. Medium — Lab goals and instructions are hidden before students know the task

**Affected:** shared player lab layout.

Missions are folded closed on every screen size, and the how-to guide is closed on phones. Students see controls before the task and goal; a Missions count gives little context for what to change. Lab mission checking treats any card click/input/change as interaction, so expanding a panel can also satisfy a mission already true at default settings.

**Evidence:** `public/static/player.js:320`, `:325`; Waves lab card interaction/check logic `:2189` and `:2196`.

**Recommendation:** show the goal and first mission beside the controls. Keep extended guidance collapsible, but only evaluate deliberate simulation changes/actions.

### 9. Medium — Important diagram labels stay English in Tamil mode

**Affected:** examples confirmed in Waves and Electromagnetism; shared prediction heading.

Some drawing strings bypass the lesson translation helper: Waves writes “transverse”, “longitudinal” and “wave direction”; Electromagnetism writes “step-up transformer”, “step-down transformer” and “equal turns”. The prediction heading comes from an English CSS `content` string. Sorted items are inserted with `textContent` but no translation metadata, so switching language after placing an item leaves it in the old language.

**Evidence:** Waves `:1989`, `:1994`, `:2483`; Electromagnetism `:2217`; `public/static/app-layer.css:116`.

**Recommendation:** translate drawing strings through the same helper as captions, render the prediction heading as translatable DOM text and retain item IDs for language-aware rerendering. Audit dynamic states, not just initial page text. Recheck against the in-progress Sinhala layer.

### 10. Medium — Waves animation does not match the frequency readout

**Affected:** Grade 11 Waves cartoon lab.

The displayed frequency is in Hz, but the animated phase uses `t * (f * 0.9)` radians. That produces roughly `0.9f / (2π)` cycles per second, not `f`. There is no displayed slow-motion factor. The mission labels 8 Hz or more a “shrill note”, while this same lesson's quiz states the human hearing range starts at 20 Hz. These internal inconsistencies can teach an incorrect relationship between the slider and what students see/hear.

**Evidence:** Waves `:2163`, `:2166`, `:2180`; hearing-range question `:1449`.

**Recommendation:** use a documented display-time scale and calculate phase consistently from it. Separate a slow visual wave model from an audible pitch demonstration; align mission wording with the lesson's stated hearing range.

### 11. Medium — Optics' cartoon can lose the image it asks students to inspect

**Affected:** Grade 11 Geometrical Optics cartoon lab.

The fixed drawing scale places the image outside the SVG for valid slider combinations. At `u = 11 cm`, `f = 10 cm`, the model yields `v = 110 cm`, putting the cartoon image at x = 814 in a 640-wide view. The cartoon omits it while saying “Real, inverted and larger.” The lower technical diagram provides an off-picture warning, but the sticky cartoon does not. Virtual images near the focal point can likewise fall outside the view.

**Evidence:** Optics `:2256` and `:2261`; lower diagram's fallback `:1393`.

**Recommendation:** adapt the scale or viewport, or show an explicit directional offscreen indicator and distance. Ensure the sticky stage explains why the image has disappeared.

### 12. Medium — Heat's comparison bar uses an undisclosed nonlinear scale

**Affected:** Grade 11 Heat lab.

The heat bar width is proportional to `sqrt(Q / Qmax)`, while its visible label simply says “heat needed”. Four times as much heat produces only twice the bar width. Students comparing mass, substance and temperature changes can infer the wrong proportional relationship even though the numeric formula is correct.

**Evidence:** Heat `:1358`.

**Recommendation:** use a linear scale with ticks, or clearly label the compressed scale. Replace the numbered substance slider with a named selector to make categorical choices easier to discover.

## Additional risks to verify on devices

- **Performance:** Watch and cartoon-lab painting destroy and recreate the SVG subtree each frame. Watch also rewrites button labels, which trigger icon-skin mutation observers. Profile lower-powered Android devices before calling this a measured performance defect; retain SVG nodes and update their attributes if frame times are poor.
- **Mobile control discoverability:** the turtle, replay, voice-mode and answer-eye buttons hide their words, while tooltips are difficult to access on touch. Small persistent labels or a contextual hint would help first-time students.
- **Voice availability:** recordings exist for the six earlier stories, not the nine `g10c*`/`g11c*` stories. Recorded-voices mode therefore falls back to device TTS after a missing-file request for those chapters. If a device has no suitable voice, the advertised listening experience is unavailable. Label the actual mode and resolve recording availability before playback.

## Suggested implementation order

1. Correct completion semantics, motion controls and keyboard game access.
2. Fix diagram-modal focus, playback lifecycle and resume behavior.
3. Correct Waves/Optics/Heat visualization inconsistencies.
4. Improve visible story navigation, lab goals and dynamic translations.
5. Verify on physical Android/iOS devices in the supported languages, including text enlargement, screen-reader use, reduced motion and slow-device performance.
