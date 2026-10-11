import { useState } from 'preact/hooks';
import Ico from './Ico';

const OPTIONS = [
  { key: 'A', text: 'Newton (N)', correct: false },
  { key: 'B', text: 'Newton meter (N m)', correct: true },
  { key: 'C', text: 'Joule (J)', correct: false },
  { key: 'D', text: 'Pascal (Pa)', correct: false },
];

/** The Home page's sample O/L question with instant feedback (one try, as on the current page). */
export default function QuizDemo() {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = answered && OPTIONS[picked]!.correct;
  return (
    <div class="quiz-demo-box">
      <span class="q-badge">Sample Question · G.C.E. O/L Physics</span>
      <div class="q-title" id="demo-q">Which of the following is the correct SI unit of Moment of a Force?</div>
      <div class="q-options" role="group" aria-labelledby="demo-q">
        {OPTIONS.map((o, i) => {
          const cls = answered && (o.correct ? 'correct' : i === picked ? 'wrong' : '');
          return (
            <button type="button" class={`q-opt ${cls || ''}`} disabled={answered} onClick={() => setPicked(i)}>
              <span>{o.key})</span> {o.text}
            </button>
          );
        })}
      </div>
      <div class={`q-feedback ${answered ? (right ? 'show success' : 'show fail') : ''}`} role="status" aria-live="polite">
        {answered && (right ? (
          <><strong>Correct!</strong> The moment of a force is defined as <em>Force (N) × Perpendicular Distance (m)</em>, giving the SI unit <strong>Newton meter (N m)</strong>. In STEM Cloud, every exercise offers detailed diagnostic explanations!</>
        ) : (
          <><strong><Ico name="cross" /> Not quite.</strong> Moment = Force × Perpendicular distance. Since force is measured in Newtons (N) and distance in meters (m), the correct SI unit is <strong>N m</strong>. Notice how Joules (J) is for energy/work!</>
        ))}
      </div>
    </div>
  );
}
