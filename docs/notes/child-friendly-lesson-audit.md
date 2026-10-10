# Lesson understanding, UI, UX and accessibility review

Reviewed 6 October 2026. Scope: all 15 course lessons, the introductory page, course hub, sign-in page, and shared lesson player, story, voice, language, diagram and motion code. This review adds documentation and evidence; it does not change the application.

## Decision

**Improvements are needed before describing the full course as independently understandable by small children.** The course has a useful foundation: familiar stories, a simple introduction in every chapter, illustrated notes, interactive labs, quizzes, worked answers and multiple languages. The full path remains a Grade 10–11 exam course. Enjoying the characters, navigating the interface, understanding an everyday example and solving an exam question are different outcomes.

A young child could explore selected introductions and demonstrations with guidance. The present evidence does not establish that a child can independently understand every chapter, operate every control or transfer the ideas to a new problem.

## Evidence and limits

- Parsed all 15 lesson HTML files and extracted their static section text, headings and source locations into `lesson-review-evidence.json`. Reviewed the beginner explanations, progression into notes, representative longer explanations and shared activity engines. Inspected chapter-specific simulation code where relevant.
- All 15 lessons have a `basics` section. These contain approximately 144–196 English whitespace-separated words, including headings, emoji and diagram labels. Notes contain approximately 719–2,184 words across 4–8 cards per lesson; there are 84 notes cards altogether. Counts describe source content, not text simultaneously visible on screen, reading age or comprehension scores. Generated story, quiz and lab text is not fully represented in these counts.
- The interactive Browser connection returned no available browsers. The first existing `tests/test_player.py` run failed to start Playwright under sandbox restrictions. The retry with expanded execution access completed in headless Edge: **179 checks passed and 21 failed**. Its log also contains a Windows subprocess connection warning. The assertion results are preserved in `lesson-review-test-output.txt`. There was no manual visual inspection, measured contrast result or accessibility conformance assessment.
- No children participated in this review. Age suitability below is a design judgment, not an observed developmental result. Tamil and Sinhala translation presence is not evidence of linguistic accuracy; native-speaking educators still need to review terminology, naturalness and pronunciation.
- This is a course-wide understanding and interface audit, not a word-for-word verification of every answer against the official textbooks or marking schemes. Existing textbook/past-paper audits address separate source-fidelity work.

## What is already working well

1. Every chapter starts with familiar objects and a short “Start from zero” explanation. Examples such as sliding a book, opening a door, tracing a torch circuit and observing a spoon in water give children something concrete to discuss.
2. The guided player displays one lesson step at a time. Notes are divided into cards and the shared Next control advances through them before leaving Notes (`public/static/player.js:419`).
3. Labs combine a visible model, labelled sliders, numerical output and missions. The mission panel now opens by default (`player.js:498`).
4. The application contains keyboard focus styling, a skip link, landmarks, live feedback, enlarged diagrams and read-aloud support. These are valuable foundations, although they still require assistive-technology testing.
5. The English/Tamil/Sinhala language picker supports learners who cannot comfortably study through English. Sinhala explicitly reports incomplete static translation coverage rather than silently promising full coverage.

## Main improvements, in priority order

| Priority | Finding and evidence | Why it matters | Concrete improvement |
|---|---|---|---|
| P0 | Pressure home activity tells learners to press a sharp pencil into their palm and asks which end hurts more (`g10-chapter-15-hydrostatic-pressure.html:521`). | The proposed action itself is unsuitable for a child learning independently. | Replace it with two blunt objects pressing modelling clay under the same small load. Any bottle-piercing activity should be prepared by an adult. |
| P0 | Beginner wording contradicts or blurs later explanations: balanced forces mean “nothing moves”; energy is “used up”; a fuse “protects you.” | A memorable simple sentence can establish a misconception before the accurate notes appear. | Correct the beginner wording in all languages first; proposed replacements follow below. |
| P1 | Many controls rely on icons; the central counter's step name is hidden below 900 px, although the header retains a small step label. Story swipe text is visually hidden and the existing story Previous/Next buttons display arrows (`player.css:78–85`, `:223–237`). | A sighted phone user may see an arrow, speaker, turtle or counter without knowing its action. Accessible names help screen readers but do not explain controls to sighted children. | Keep icon + short visible text: Back, Next, Listen, Slow, Replay, Show answer. Display “Step 3: Watch” and “Story line 2 of 7.” Keep swipe as an additional method and label the existing story buttons. |
| P1 | The browser suite measured page-width overflow in every lesson at 393 px, typically 398–410 px for the first reported failing steps. A 320 px check also failed across 12 main steps. | Content extending beyond the viewport can compromise small-phone reading and control access, even when the overflow is small. | Inspect the overflowing elements in Watch, Labs and Quizzes first, then all remaining steps. Correct container sizing and retain intentional diagram scrolling inside its container. Rerun at 320 and 393 px; do not conceal overflow without preserving content. |
| P1 | Waves' cartoon still says “Shrill, high pitch!” when f ≥ 8 Hz (`g11-chapter-04-waves.html:2211`), despite the mission wording being corrected. The same lesson gives 20 Hz as the lower hearing limit. Animation phase runs at f/8 without an evident explanatory stage label. | The beginner sees a sound claim inconsistent with the stated hearing range and a slowed wave without a clear time scale. | Change the cartoon message to “More vibrations each second.” Label the model as slowed to one-eighth speed and separate an audible-pitch demonstration from this visual model. |
| P1 | Four or five simple beginner ideas lead into a long sequence with 12–13 main steps and multiple note cards. For example, Friction’s Watch takeaways already introduce normal reaction and proportionality (`chapter-05-friction.html:598–606`). | The transition asks the learner to absorb new words, symbols, rules and calculations together. | Offer two paths: **Explore the idea** and **Study for O/L**. Give the first a short story, one experiment, a prediction and a brief explanation. Put formulas and exam work in the second. |
| P1 | “Start from zero” is explanatory text and emoji, with no embedded response check before proceeding. | Reading or hearing an explanation does not show whether the child can use the idea. | Add one picture prediction and one “show me” action per concept. Give specific feedback and a simpler explanation after an incorrect response. Allow exploration without locking the learner out. |
| P1 | Completion remains an activity measure: reading steps complete on Next; quiz completion checks whether questions were answered; Watch completion checks scrub position (`player.js:202–228`). Whole-page mode retains visibility marking in lesson HTML. | A tick does not establish accuracy, recall or understanding. Progress can mean different things in different view modes. | Distinguish **Visited**, **Activity finished**, and **Understanding checked**. Use the same completion rules in both views. Add a new-example question before claiming understanding. |
| P1 | Audio availability differs between chapters and devices. Local recorded story folders exist for the six earlier chapters, while the other nine rely on fallback speech. Sinhala has no unit/symbol expansion table in `voice.js:83`. | A child who depends on listening may encounter missing voices or poorly spoken formulas. | Show whether recorded or device speech is available. Provide a visible transcript and a usable reading fallback. Add Sinhala unit/symbol pronunciation handling and verify actual playback with native speakers on supported phones. |
| P2 | Sign-in is English-only and asks for “credentials”; it routes enrollment through an administrator/WhatsApp (`login.html:33–77`). The lesson language picker is absent there. | A young learner may need help before reaching any lesson. | Offer language selection before sign-in. Say “Use the username and password your teacher gave you.” Clearly label enrollment help for a parent or teacher; keep account setup supported by an adult. |
| P2 | The visible duration is calculated as main steps × 3 minutes (`player.js:186`), independent of card count or reading/activity workload. | The estimate can create an unrealistic expectation, particularly for a beginner. | Label it as an estimate, separate exploration time from full study time, and revise it using observed learner sessions. Show a stopping point after a small group of concepts. |
| P2 | Resume restores the main step when the hub supplies `?resume=1`, but no corresponding notes-card/story-line restoration is evident in the shared resume logic (`player.js:555–559`). | Returning to a long step may require finding the previous position again. | Save and restore the card/line within the step and provide an obvious “Start again” action. Ensure these positions remain private when students share a device. |
| P2 | Device reduced-motion preference is deliberately overridden by the default app motion policy (`app-layer.css:193–198`), although a manual calm setting now exists. | The learner must discover an account setting before reducing unwanted movement. | Respect the device preference by default; provide explicit Play, Pause and Next frame for instructional animation. Retain slider-controlled still diagrams. |
| P1 | The Sinhala overview test failed, and its output shows “SECTOR 1: FOUNDATIONS,” “1.1 Overview” and “1.2 Fundamentals” remaining English. Some static SVGs also contain English labels without Tamil metadata, e.g. Waves’ “compression,” “rarefaction” and “direction of wave propagation.” | A translated paragraph beside an English navigation label or diagram does not make the learning task understandable in the selected language. | Translate phase/step labels as well as diagram text, selected states, result messages and accessible labels. Keep internationally used symbols such as N or V, while explaining their meanings locally. Test language changes during activities. |
| P2 | Shared phase/step labels use “Sector,” “Fundamentals,” “Theory & Principles,” “Assessment & Mastery” and “Classification” (`g11-chapter-13-electromagnetism.html:1747–1762`). | These labels tell an educator more than they tell a young learner about what to do next. | Use “Meet the idea,” “Watch,” “Try,” “Sort the pictures,” “Check what you learned” and “Exam practice.” Keep curriculum section numbers as secondary information. |
| P2 | Generic SVG names such as “animation” do not describe the educational relationships shown. | Read-aloud paragraphs alone may not convey an essential visual model to a learner who cannot see it. | Provide a nearby concise text description, live numerical/state output and an equivalent way to answer the activity. Verify the entire learning task with a screen reader. |

W3C’s cognitive guidance supports clear words and controls whose use is understandable. These recommendations go beyond merely attaching an invisible accessible label to an icon. See [Use Clear Words](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/) and [Clearly Identify Controls and Their Use](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p05-clear-controls/).

## Precise beginner wording corrections

| Location | Current wording/problem | Proposed child-facing explanation |
|---|---|---|
| Resultant Force, `basics:533` | “Equal and opposite: nothing moves.” This can be read as a universal rule. | “Equal pushes in opposite directions do not change how something moves. If the box is still, it stays still. If it is already moving, balanced forces do not make it speed up or slow down.” |
| Newton’s Laws, Notes `:641` | The paragraph ends by saying an unbalanced force decides “does it move or not,” although the local example starts at rest. | “For this still table, a larger push can start movement. More generally, an unbalanced force changes speed or direction.” |
| Work/Energy/Power, `basics:520` | “Energy: the power to do work” merges two technical concepts; “Doing work uses energy up” suggests disappearance. | “Energy lets things move, warm up or change. When you lift a bag, energy moves from your body into the bag and its surroundings. Energy changes form; it does not disappear. Power tells us how quickly energy is transferred.” |
| Equilibrium, `basics:504` | “A wide base and low weight” substitutes weight for the position of the centre of gravity. | “A wide base and a low balance point make something harder to tip over.” Follow with a drawing and introduce “centre of gravity” as the scientific term. |
| Electric Appliances, `basics:520` | A fuse “protects you,” while Notes `:610` correctly distinguishes overcurrent protection from shock protection. | “A fuse can break the circuit when too much current flows, helping stop wires overheating. It does not make sockets safe to touch. Ask an adult for appliance activities.” |
| Optics, `basics:520` | “A lens bends light to a point” is stated for lenses generally, followed by magnifying glass and spectacles examples. | “Lenses change the direction of light. Some bring light rays together; others spread them apart. We will first explore a lens that brings rays together.” |

The force corrections follow the distinction between motion and **change in motion** in [OpenStax’s Newton’s first law explanation](https://openstax.org/books/college-physics-2e/pages/4-2-newtons-first-law-of-motion-inertia). The energy correction follows [conservation of energy](https://openstax.org/books/college-physics-2e/pages/7-6-conservation-of-energy). Circuit-protection wording should preserve the distinction discussed in [electric hazards and protection](https://openstax.org/books/college-physics-2e/pages/20-6-electric-hazards-and-the-human-body).

These replacements are proposed copy for educator review. Update the Tamil and Sinhala equivalents alongside English so the same misconception is not retained in another language.

## Chapter-by-chapter understanding review

“Accessible entry” means a concept can be introduced through a familiar example. It does not mean the full chapter has been shown to be independently understandable by a young child.

| Lesson | Accessible entry already present | Main understanding gap | Best next improvement | Notes cards / source words |
|---|---|---|---|---|
| Motion in a Straight Line | Home-to-school journey, walking versus cycling. | Distance/displacement, velocity, acceleration, graph gradient and area arrive in one chapter. | Begin with a movable character on a straight track. Compare two journeys with the same start/end before introducing coordinates. Teach one graph axis at a time. | 5 / 928 |
| Newton’s Laws | Ball, door, cart, swimming. | Three laws, momentum and mass/weight are a substantial conceptual load; “force causes motion” wording needs care. | Use separate mini-lessons for starting/changing motion, mass and acceleration, and force pairs. Show action/reaction forces on **different objects**. | 6 / 1,683 |
| Friction | Book sliding, hands rubbing, shoes and brakes. | Normal reaction, limiting/dynamic friction and proportionality appear before a beginner has tested the simple relationship. | Predict which of two surfaces stops a book sooner; show the observation and explanation first. Introduce limiting friction as a later model with its assumptions. | 4 / 937 |
| Resultant Force | Friends pulling a box and tug of war. | Units N appear immediately; zero resultant can be confused with zero motion; inclined/parallel forces require more geometry. | Explain one newton as a force unit, use same-line arrows and preserve an already-moving example. Move angled-force construction to the exam path. | 4 / 844 |
| Turning Effect | Door, spanner and seesaw. | Multiplication is introduced before perpendicular distance and pivot position are explicit. | Colour the pivot, force arrow and perpendicular distance. Ask which push turns the door more before calculating a moment. | 4 / 719 |
| Equilibrium | Balancing a pencil/ruler. | Two balance conditions and three-force arrangements are difficult without the previous force/moment ideas. | Link to Resultant Force and Turning Effect. Start with one balanced beam and correct the “low weight” wording. | 4 / 869 |
| Pressure of Liquids | Water pressing on container sides; deeper water gives greater pressure. | Area division, depth, density, Pascal’s principle, atmospheric pressure and upthrust span several prerequisites. Sharp-pencil home activity is unsuitable. | Replace the home task. Use broad/narrow blunt supports on clay, then a separate water-depth demonstration. Explain pressure separately from total force. | 5 / 1,812 |
| Work, Energy and Power | Lifting a bag and a falling ball. | Everyday “work,” scientific work, energy conservation and power can be confused; the beginner wording reinforces this. | Track energy using labelled arrows and compare the same lift over different times. Introduce W = Fs only after identifying force direction and displacement. | 6 / 1,453 |
| Current Electricity | Torch circuit and water-flow analogy. | Charge, voltage, current, resistance and series/parallel rules lead to eight note cards. An analogy can become the learner’s literal model. | Start with a complete low-voltage battery/bulb loop. Keep charge movement distinct from energy transfer and voltage. Teach one meter/quantity at a time. | 8 / 2,181 |
| Waves | Rope pulse, drum and pond ripple. | Amplitude, wavelength, frequency, period and speed are introduced close together. The lab allows frequency and wavelength to vary independently, changing speed. | Use a marked particle to distinguish particle motion from wave travel. Teach tall/wide/often separately. State what the model holds fixed; label when wave speed changes. | 8 / 1,880 |
| Geometrical Optics | Straw/spoon in water, shadow and mirror. | Reflection, refraction, total internal reflection, mirrors and lenses need several separate models; image type and sign conventions add complexity. | Separate the phenomena into mini-lessons. Trace one ray before drawing two. Clearly distinguish converging/diverging lenses and object versus image. | 5 / 1,797 |
| Heat | Cooling tea, thermometer, melting ice. | Temperature and transferred heat can blur; Kelvin, heat capacity and latent heat introduce several quantities. | Compare two different masses of water at the same temperature. Add a particle view and ask what changes during melting when temperature remains constant. Keep real activities to adult-prepared warm water. | 6 / 2,058 |
| Electric Appliances | Kettle heats, fan spins, bulb glows. | Power/energy/kWh and home wiring are distinct topics; the fuse simplification gives an incorrect sense of personal protection. | Correct the fuse copy; put units and a worked bill in their own mini-lesson. Make home wiring an observation/simulation activity with adult guidance. | 6 / 1,667 |
| Electronics | LED and one-way-gate analogy. | Current Electricity is needed before doping, holes, junction bias, rectification and transistors. | Offer an LED/diode exploration first. Gate the *recommended sequence* with a prerequisite reminder, while keeping free access. Put semiconductor structure in a later study section. | 6 / 2,019 |
| Electromagnetism | Magnet, compass and a moving magnet near a coil. | Fields, motor force, induction, AC/DC and turns ratios span seven note cards and several mechanisms. | Split into magnet/current, motor and induction mini-lessons. Show that induction depends on **changing** magnetic linkage and compare still/moving cases before transformer ratios. | 7 / 2,184 |

## Age and prerequisite design

Use these as starting hypotheses for testing, not eligibility rules:

- **Early readers, roughly 5–7:** adult-guided story, one visible action, spoken instructions and picture choices. Do not claim independent mastery of the full O/L chapters.
- **More confident readers, roughly 8–11:** a short exploration path with immediate explanations, basic counting and measurement; optional numbers after the concept is clear.
- **Older beginners and Grade 10–11 learners:** the full exam path, with prerequisite links, symbol definitions, units, worked examples and transfer questions.

Reading language, prior knowledge and arithmetic matter more than a strict age label. Provide “I am new to this” and “I am studying for O/L” choices. Do not require personal age data merely to choose a path.

Suggested prerequisite links: Motion → Newton’s Laws → Resultant Force → Turning Effect → Equilibrium; basic force/area/volume ideas → Pressure; Work/Energy/Power + Current Electricity → Electric Appliances; Current Electricity → Electronics and Electromagnetism. Before Waves/Optics/Heat calculations, check the specific measurement and arithmetic needed.

## A simpler learner journey

For an exploration, aim initially for one concept and approximately 5–8 minutes, then measure the actual time:

1. **Notice:** a familiar situation and a short story.
2. **Guess:** one picture question: “Which book stops first?”
3. **Try:** one clearly labelled control or simple adult-prepared demonstration.
4. **Explain:** one or two sentences linking what happened to the idea.
5. **Check:** a different everyday example and helpful feedback.
6. **Choose:** finish this exploration, try another example, or study the formula.

A sensible first implementation is Friction: it already has concrete examples and a small notes set. Use it to test the new path and labelled controls before repeating the pattern throughout the course.

## Accessibility checks still required

The source contains meaningful accessibility improvements, but these must be validated as learning tasks:

The completed browser run provides useful evidence: story gestures, visible story arrow buttons, diagram opening, keyboard term selection, calm lab behavior, resume links and many language transitions passed. Its 21 failures comprise 15 lesson-width assertions, one 320 px width assertion, one reading-completion assertion, three enlarged-figure focus assertions and one Sinhala overview assertion. This suite is **not fully passing**.

Treat the reading-completion failure as a likely outdated test: it expects one Next click to finish Notes, but the current Next control advances through note cards. The figure checks use the first figure after an earlier action has advanced the note card; that figure may be in a hidden card, leaving focus on a notes-path button. Reproduce those checks against the visible active figure before declaring the modal implementation broken. Preserve tests for focus entering the dialog, Tab containment and focus restoration; correct their setup rather than dropping the checks. The Sinhala assertion expects older step names, but its captured output also establishes actual English text remaining in Sinhala navigation.

| Area | Required verification |
|---|---|
| Keyboard | Complete a quiz, matching round, sorting round and lab using only the keyboard in both guided and whole-page views. Confirm focus remains visible after content changes. |
| Screen reader | With TalkBack and VoiceOver, identify the step, hear the educational diagram meaning, adjust sliders, understand feedback, open/close dialogs and continue without guessing. |
| Reflow and enlargement | Test 320 CSS px width, enlarged text and browser zoom; inspect sticky bars and expanded diagrams for obscured content. Two-dimensional diagrams may need their own scroll area. |
| Targets | Measure actual button/chip targets and spacing in each state. Use 44–48 px as a child-friendly design goal; WCAG 2.2 AA’s minimum target criterion is 24 × 24 CSS px or qualifying alternatives/exceptions, not a universal 44 px requirement. |
| Contrast | Measure text and control contrast in light/dark themes and correct/incorrect/disabled states. Source colour tokens alone do not establish a pass. |
| Motion | With reduced motion enabled before page load, confirm decorative motion stops and instructional models remain understandable through deliberate controls. |
| Language | Change language while a story, quiz, sorting result and lab are active. Verify visible instructions, diagram labels, accessible names, formulas and speech. |
| Access/offline | Test sign-in help with a new learner, missing speech voices, slow internet, cached versus unopened lessons and logout on a shared device. |

Use [WCAG 2.2 understanding documents](https://www.w3.org/WAI/WCAG22/understanding/) and [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) for the technical baseline. Child comprehension still needs separate evaluation.

## Earlier audit findings: current status

The 5 October report should not be repeated as if every finding still applies. Current source includes:

- Real-completion hooks in all 15 lessons, with visibility marking suppressed in guided mode. Remaining work: consistent whole-page rules and understanding measures.
- Calm-mode lab event handling and confetti guards in all 15 lessons. Remaining work: device-preference defaults and live verification.
- Shared keyboard enhancement for matching/sorting controls (`player.js:233` onward). It is tied to the guided player, which returns early for whole-page mode, so verify/support that view too.
- Diagram dialogs using the shared modal helper (`questions.js:64`). The three current figure-focus assertions failed and need the active-card reproduction described above. The helper is supplied by the guided player; full modal behavior in whole-page mode needs separate verification.
- Explicit hub resume links and player resume reading. Remaining work: position within a step.
- Watch pause-on-leave code in all 15 lessons; story and voice step-change handlers also exist.
- Missions shown by default and lab completion evaluation restricted to relevant control/action targets.
- Waves phase calculated at 1/8 of real time in its implementation, and the old “shrill” mission replaced by “fast-vibrating wave.” The cartoon's separate “Shrill, high pitch!” message remains; complete the correction and add a visible, translated time-scale label.
- An off-picture indicator in the Optics cartoon and a labelled linear Heat bar. Extreme lens combinations can still warrant visual checks for vertical clipping and legibility.

## Validation with children

Recruit a small initial group with parent/teacher involvement, covering different reading levels and supported languages. Begin with Motion, Friction and Current Electricity, then repeat with the more abstract chapters. Ask the child to perform tasks; avoid explaining the interface before seeing where they get stuck.

Observe whether they can choose a language, start the correct path, identify Back/Next/Listen, finish the story, make a prediction, operate the lab, understand an incorrect-answer explanation, describe the idea in their own words and use it in a different situation. Record prompts needed and wrong turns, as well as correctness. A “fun” rating or completed lesson alone is insufficient.

Suggested initial acceptance targets, to refine after the pilot: most learners start and navigate without repeated adult prompts; correctly explain the central idea and answer two new-example questions; recover from a mistake with the provided feedback; and find their place after returning. Specify “most” numerically before testing and report the group size. Do not market these results as applying to all children.

## Implementation order

1. Replace the sharp-pencil activity and correct the misleading beginner explanations in all languages.
2. Resolve measured phone overflow, remaining Sinhala navigation text and the Waves cartoon inconsistency. Correct stale browser-test setup and rerun the affected checks.
3. Add visible labels and a short exploration path to Friction; validate it with children.
4. Add prerequisite reminders, prediction checks and explanatory feedback across all 15 chapters.
5. Make completion behavior and keyboard/dialog support consistent across guided and whole-page views.
6. Finish dynamic diagram/speech language coverage, respect device motion preferences, and verify physical phones and assistive technology.

**Release decision:** retain the course as an engaging Grade 10–11 learning resource. Describe its simple introductions as beginner support. Claim independent suitability for younger children only after a dedicated exploration path and observed comprehension testing support that claim.
