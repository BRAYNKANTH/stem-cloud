import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { UI, pick, type Tri } from '../lib/lesson-ui';

export interface StoryAsk {
  ask: Tri;
  options: Tri[];
  correct: number;
  why: Tri;
}

// The quiz's own words (Quiz.tsx, from public/static/quiz-sheet.js).
const W = {
  correct: { en: 'Correct!', ta: 'சரி!', si: 'නිවැරදියි!' },
  wrong: { en: 'Not quite', ta: 'சரியில்ல', si: 'හරියටම නෑ' },
} satisfies Record<string, Tri>;

/**
 * Explore: a short real-life scenario worked through one question at a time (the topic pages' story, public/static/
 * topics.js): pick an answer, see whether it is right and why, then the next question; the wrap-up comes at the end.
 * Without JavaScript the page shows the questions with their answers instead.
 */
export default function TopicStory({ scenario, steps, wrap }: { scenario: Tri; steps: StoryAsk[]; wrap?: Tri | null }) {
  const lang = useStore($lang);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => steps.map(() => null));
  const L = (t: Tri) => pick(t, lang);
  const shown = steps.slice(0, at + 1);
  const done = at === steps.length - 1 && picked[at] !== null;

  return (
    <div class="tp-story">
      <p class="tp-scenario">{L(scenario)}</p>
      {shown.map((s, i) => {
        const p = picked[i] ?? null;
        return (
          <div class="qz-card" key={i}>
            <div class="qz-q">{L(s.ask)}</div>
            <div class="qz-opts">
              {s.options.map((o, k) => (
                <button type="button" key={k} disabled={p !== null}
                        class={'qz-opt' + (p !== null && k === s.correct ? ' correct' : '') + (p === k && k !== s.correct ? ' wrong' : '')}
                        onClick={() => setPicked(picked.map((x, j) => (j === i ? k : x)))}>
                  {L(o)}
                </button>
              ))}
            </div>
            {p !== null && (
              <div class="qz-explain show" role="status">
                <b>{L(p === s.correct ? W.correct : W.wrong)}</b> {L(s.why)}
              </div>
            )}
            {p !== null && i === at && i < steps.length - 1 && (
              <button type="button" class="btn primary tp-next" onClick={() => setAt(at + 1)}>{L(UI.next)}</button>
            )}
          </div>
        );
      })}
      {done && wrap && <div class="card tp-wrap">{L(wrap)}</div>}
    </div>
  );
}
