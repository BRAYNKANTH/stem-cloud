import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { $ids, $step } from '../stores/lesson';
import { pick, type Tri } from '../lib/lesson-ui';
import { currentLesson, onceId, randomId, record, reward } from '../stores/progress';

export interface Question {
  id: string;
  prompt: Tri;
  options: Tri[];
  answer: number;
  explain?: Tri | null;
}

// Words from the current quiz (the lesson page's quiz and public/static/quiz-sheet.js; Sinhala "Score:" from si/_ui.json).
const W = {
  score: { en: 'Score:', ta: 'மதிப்பெண்:', si: 'ලකුණු:' },
  correct: { en: 'Correct!', ta: 'சரி!', si: 'නිවැරදියි!' },
  wrong: { en: 'Not quite', ta: 'சரியில்ல', si: 'හරියටම නෑ' },
  answerIs: { en: 'The answer is: ', ta: 'சரியான பதில்: ', si: 'නිවැරදි පිළිතුර: ' },
  next: { en: 'Next question', ta: 'அடுத்த கேள்வி', si: 'ඊළඟ ප්‍රශ්නය' },
  myScore: { en: 'See my score', ta: 'என் மதிப்பெண்', si: 'මගේ ලකුණු' },
} satisfies Record<string, Tri>;

const TICK = 'M20 6L9 17l-5-5';
const CROSS = 'M6 6l12 12M18 6L6 18';

/**
 * The self-check quiz: each question locks after one answer and marks the right option; an answer sheet at the bottom
 * says "Correct!" or "Not quite" with the right answer and the explanation, and one button goes on to the next question.
 * The explanation stays in the card for review once the sheet is closed. Without JavaScript the page shows the answers
 * behind "Show answer" instead.
 */
export default function Quiz({ stepId, questions, compact = false }: { stepId: string; questions: Question[]; compact?: boolean }) {
  const lang = useStore($lang);
  const step = useStore($step);
  const ids = useStore($ids);
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [sheet, setSheet] = useState<number | null>(null);      // the question whose answer sheet is open
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const scoreBox = useRef<HTMLDivElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const L = (t: Tri) => pick(t, lang);
  const score = picked.filter((p, i) => p === questions[i]!.answer).length;

  const close = (focusNext: boolean) => {
    if (sheet === null) return;
    const at = sheet;
    setSheet(null);
    if (!focusNext) return;
    const next = cards.current[at + 1];
    if (next) {
      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
      next.querySelector<HTMLButtonElement>('.qz-opt')?.focus({ preventScroll: true });
    } else if (scoreBox.current) {
      scoreBox.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      scoreBox.current.focus({ preventScroll: true });
    }
  };

  const answer = (qi: number, oi: number) => {
    if (picked[qi] !== null) return;
    const next = picked.map((p, i) => (i === qi ? oi : p));
    setPicked(next);
    setSheet(qi);
    // progress v2: every answer is an attempt; the first right answer to a question is worth 10 XP, once (as on the
    // current pages); a whole quiz right is the lesson's "quiz ace" badge
    const q = questions[qi]!, lesson = currentLesson(), right = oi === q.answer;
    void record({ id: randomId(), type: 'answer', question: `${lesson}/${q.id}`, correct: right });
    if (right) void reward('q:' + q.id, 10);
    if (!compact && next.every((p, i) => p === questions[i]!.answer)) void record({ id: onceId('badge:' + lesson + ':quiz-ace'), type: 'badge', badge: lesson + ':quiz-ace' });
  };

  // the sheet: focus its button and keep the answered options in sight above it
  useEffect(() => {
    if (sheet === null) return;
    document.documentElement.classList.add('qsheet-open');
    go.current?.focus({ preventScroll: true });
    const opts = cards.current[sheet]?.querySelector('.qz-opts');
    const box = go.current?.closest<HTMLElement>('#stem-qsheet');
    if (opts && box) {
      const r = opts.getBoundingClientRect(), room = innerHeight - box.offsetHeight - 12;
      if (r.bottom > room) scrollBy({ top: Math.min(r.bottom - room, Math.max(0, r.top - 70)), behavior: 'smooth' });
    }
    return () => document.documentElement.classList.remove('qsheet-open');
  }, [sheet]);

  // Escape closes the sheet, listened for from the start so a key pressed as the sheet opens is not missed
  const open = useRef<number | null>(null);
  open.current = sheet;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || open.current === null) return;
      const card = cards.current[open.current];
      setSheet(null);
      card?.focus();               // its options are disabled now, so the card itself takes focus
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // leaving the quiz step closes the sheet
  useEffect(() => {
    if (step >= 0 && ids[step] !== stepId) setSheet(null);
  }, [step]);

  const q = sheet === null ? null : questions[sheet]!;
  const right = q !== null && picked[sheet!] === q.answer;
  return (
    <div class="qz">
      {!compact && (
        <div class="quiz-score" ref={scoreBox} tabIndex={-1}>
          {L(W.score)} <b>{score}</b> / <span>{questions.length}</span>
        </div>
      )}
      {questions.map((item, qi) => {
        const p = picked[qi];
        const done = p !== null;
        return (
          <div class={'qz-card' + (sheet === qi ? ' qz-in-sheet' : '')} id={item.id} key={item.id} tabIndex={-1} ref={(el) => { cards.current[qi] = el; }}>
            <div class="qz-q">{compact ? '' : `${qi + 1}. `}{L(item.prompt)}</div>
            <div class="qz-opts">
              {item.options.map((o, oi) => (
                <button type="button" key={oi} disabled={done} onClick={() => answer(qi, oi)}
                        class={'qz-opt' + (done && oi === item.answer ? ' correct' : '') + (done && oi === p && p !== item.answer ? ' wrong' : '')}>
                  {L(o)}
                </button>
              ))}
            </div>
            {item.explain && <div class={'qz-explain' + (done ? ' show' : '')}>{L(item.explain)}</div>}
          </div>
        );
      })}
      {q && (
        <section id="stem-qsheet" class={right ? 'ok' : 'no'} role="dialog" aria-modal="false" aria-labelledby="qs-h" aria-describedby="qs-d">
          <div class="qs-head">
            <span class="qs-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d={right ? TICK : CROSS} /></svg>
            </span>
            <b id="qs-h">{L(right ? W.correct : W.wrong)}</b>
          </div>
          <div id="qs-d">
            {!right && <p class="qs-ans">{L(W.answerIs)}<strong>{L(q.options[q.answer]!)}</strong></p>}
            {q.explain && <div class="qs-why">{L(q.explain)}</div>}
          </div>
          <button type="button" class="qs-go" ref={go} onClick={() => close(true)}>{L(sheet === questions.length - 1 && !compact ? W.myScore : W.next)}</button>
        </section>
      )}
    </div>
  );
}
