import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import { SCENES, themeColors } from '../feed/scenes';
import FigureSvg, { type Figure } from '../feed/figures';

type Tri = { en: string; ta: string; si: string };
export type FeedCard =
  | { id: string; type: 'predict'; lesson: string; scene?: string; video?: { src: string; pauseAt: number }; question: Tri; options: Tri[]; correct: number; why: Tri }
  | { id: string; type: 'mcq'; lesson: string; question: Tri; options: Tri[]; correct: number; why: Tri; figure?: Figure; practice?: boolean }
  | { id: string; type: 'tf'; lesson: string; statement: Tri; correct: number; why: Tri; figure?: Figure; practice?: boolean }
  | { id: string; type: 'idea'; lesson: string; formula: { name: Tri; math: string | Tri; worked: Tri; tip?: Tri } };
export interface Chapter { id: string; title: Tri; url: string }
/** A chapter's pool of practice questions (content/practice): all of them, one per screen, in a random order. */
export interface Pool { slug: string; lesson: string; cards: FeedCard[] }
/** #chapters in the address: the list of chapters to practise (the feed header's Chapters button). */
const CHAPTERS = 'chapters';
const gradeOf = (lesson: string) => /\.g(\d+)\./.exec(lesson)?.[1] ?? '';

interface Answer { choice: number; right: boolean; counts?: number[] }
const KEY = 'stem_feed_v1';
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };

const W = {
  predict: { en: 'Predict, then watch', ta: 'ஊகி, பிறகு பார்', si: 'අනුමාන කර, පසුව බලන්න' },
  quick: { en: 'Quick question', ta: 'விரைவு வினா', si: 'ඉක්මන් ප්‍රශ්නය' },
  tf: { en: 'True or false?', ta: 'சரியா பிழையா?', si: 'සත්‍යද අසත්‍යද?' },
  idea: { en: 'Formula', ta: 'சூத்திரம்', si: 'සූත්‍රය' },
  swipe: { en: 'Swipe right for true, left for false', ta: 'சரி என்றால் வலப்பக்கம், பிழை என்றால் இடப்பக்கம் தள்ளு', si: 'සත්‍ය නම් දකුණට, අසත්‍ය නම් වමට ස්වයිප් කරන්න' },
  t: { en: 'True', ta: 'சரி', si: 'සත්‍ය' },
  f: { en: 'False', ta: 'பிழை', si: 'අසත්‍ය' },
  watching: { en: 'Watch…', ta: 'பார்…', si: 'බලන්න…' },
  guess: { en: 'What happens next? Make your guess.', ta: 'அடுத்து என்ன நடக்கும்? ஊகித்துச் சொல்.', si: 'ඊළඟට කුමක් සිදුවේද? ඔබේ අනුමානය කරන්න.' },
  replay: { en: 'Watch again', ta: 'மீண்டும் பார்', si: 'නැවත බලන්න' },
  right: { en: 'Right!', ta: 'சரி!', si: 'නිවැරදියි!' },
  wrong: { en: 'Not quite', ta: 'சரியில்லை', si: 'එතරම් නිවැරදි නැත' },
  everyone: { en: 'How everyone answered', ta: 'எல்லோரும் சொன்ன பதில்', si: 'සියලු දෙනා පිළිතුරු දුන් ආකාරය' },
  students: { en: 'students', ta: 'மாணவர்கள்', si: 'සිසුන්' },
  student: { en: 'student', ta: 'மாணவர்', si: 'සිසුවා' },
  next: { en: 'Next', ta: 'அடுத்தது', si: 'ඊළඟ' },
  example: { en: 'Example', ta: 'உதாரணம்', si: 'උදාහරණය' },
  learn: { en: 'Learn it', ta: 'கற்றுக்கொள்', si: 'ඉගෙන ගන්න' },
  streak: { en: 'in a row', ta: 'தொடர்ச்சியாக', si: 'අඛණ්ඩව' },
  done: { en: 'That is the feed for now', ta: 'இப்போதைக்கு இவ்வளவுதான்', si: 'දැනට එච්චරයි' },
  score: { en: 'right', ta: 'சரி', si: 'නිවැරදි' },
  again: { en: 'Start again', ta: 'மீண்டும் தொடங்கு', si: 'නැවත අරඹන්න' },
  feed: { en: 'Learning feed', ta: 'கற்றல் ஓட்டம்', si: 'ඉගෙනුම් පෝෂණය' },
  practice: { en: 'Practice question', ta: 'பயிற்சி வினா', si: 'පුහුණු ප්‍රශ්නය' },
  practise: { en: 'Practise', ta: 'பயிற்சி', si: 'පුහුණුව' },
  questions: { en: 'questions', ta: 'வினாக்கள்', si: 'ප්‍රශ්න' },
  restart: { en: 'Start this chapter again', ta: 'இந்தப் பாடத்தை மீண்டும் தொடங்கு', si: 'මෙම පරිච්ඡේදය නැවත අරඹන්න' },
  swipeUp: { en: 'Swipe up for the next question', ta: 'அடுத்த வினாவுக்கு மேலே தள்ளு', si: 'ඊළඟ ප්‍රශ්නයට ඉහළට ස්වයිප් කරන්න' },
  backFeed: { en: 'Back to the feed', ta: 'ஓட்டத்துக்குத் திரும்பு', si: 'පෝෂණයට ආපසු' },
  roundDone: { en: 'Chapter finished', ta: 'பாடம் முடிந்தது', si: 'පරිච්ඡේදය අවසන්' },
  chapters: { en: 'Practise a chapter', ta: 'ஒரு பாடத்தைப் பயிற்சி செய்', si: 'පරිච්ඡේදයක් පුහුණු වන්න' },
  pick: { en: 'Pick a chapter: all its questions, one at a time, swiped up.', ta: 'ஒரு பாடத்தைத் தெரிவு செய்: அதன் எல்லா வினாக்களும், ஒன்றன்பின் ஒன்றாக.', si: 'පරිච්ඡේදයක් තෝරන්න: එහි සියලු ප්‍රශ්න, එකින් එක.' },
  grade: { en: 'Grade', ta: 'தரம்', si: 'ශ්‍රේණිය' },
  toFeed: { en: 'Or swipe through the feed', ta: 'அல்லது ஓட்டத்தைப் பார்', si: 'නැතහොත් පෝෂණය බලන්න' },
  allDone: { en: 'You have answered every question in this chapter right!', ta: 'இந்தப் பாடத்தின் எல்லா வினாக்களுக்கும் சரியாகப் பதிலளித்தாய்!', si: 'මෙම පරිච්ඡේදයේ සියලු ප්‍රශ්නවලට ඔබ නිවැරදිව පිළිතුරු දුන්නා!' },
};

/** After an answer: bring the reason, the poll and Next into view (the card can be taller than the screen). */
const showResult = (id: string, wait = 0) => setTimeout(() => {
  document.querySelector(`[data-card="${id}"] .fd-foot`)?.scrollIntoView({ block: 'end', behavior: document.documentElement.classList.contains('stem-calm') ? 'auto' : 'smooth' });
}, wait);

const load = (): Record<string, Answer> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/**
 * The learning feed: one card per screen, swiped up, like a reel. Cards: predict, then watch (a scene plays, stops for a
 * guess, then shows what happens); a quick question; true or false (swiped right or left); a formula. Every answer is
 * checked at once with a one-line reason, and shows how all students answered (the API keeps each student's first
 * answer). The Practice tab of the bottom bar; answers are kept on this device.
 */
export default function LearningFeed({ cards, chapters, pools = [] }: { cards: FeedCard[]; chapters: Chapter[]; pools?: Pool[] }) {
  const lang = useStore($lang);
  const t = (x: Tri | string) => (typeof x === 'string' ? x : x[lang] || x.en);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const box = useRef<HTMLDivElement>(null);
  const byId = new Map(chapters.map((c) => [c.id, c]));

  // #<chapter> in the address: a round of that chapter's practice questions; anything else: the feed
  const [mode, setMode] = useState('');
  const [deck, setDeck] = useState<FeedCard[]>([]);
  const [cur, setCur] = useState(0);                 // the card on screen
  const [round, setRound] = useState(0);             // counts the times a chapter is dealt, so a new order is drawn afresh, not moved about
  const [recent, setRecent] = useState<boolean[]>([]);  // this visit's answers, right or wrong, in order (for the streak)
  const [swiped, setSwiped] = useState(false);          // has the student moved on from the first card yet
  const deal = (slug: string, a: Record<string, Answer>) => {
    const pool = pools.find((p) => p.slug === slug);
    if (!pool) { setMode(''); return; }
    const mix = <X,>(xs: X[]) => xs.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    // every question of the chapter, in a random order: the ones not answered yet first, then the ones answered wrong (they
    // come back to try again), then the ones already right
    const fresh = mix(pool.cards.filter((c) => !a[c.id]));
    const again = mix(pool.cards.filter((c) => a[c.id] && !a[c.id]!.right));
    const done = mix(pool.cards.filter((c) => a[c.id]?.right));
    if (again.length) { const b = { ...a }; again.forEach((c) => delete b[c.id]); save(b); }
    setDeck([...fresh, ...again, ...done]);
    setMode(slug);
    setCur(0);
    setRecent([]);
    setSwiped(false);
    setRound((r) => r + 1);
    box.current?.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => box.current?.scrollTo({ top: 0, behavior: 'instant' }));   // again once the new order is drawn
  };
  const restart = (slug: string) => {
    const pool = pools.find((p) => p.slug === slug);
    if (!pool) return;
    const b = { ...answers };
    pool.cards.forEach((c) => delete b[c.id]);
    save(b);
    deal(slug, b);
  };
  useEffect(() => {
    loadPrefs();
    const a = load();
    setAnswers(a);
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (pools.some((p) => p.slug === h)) deal(h, load());
      else { setMode(h === CHAPTERS ? CHAPTERS : ''); setDeck([]); setCur(0); setRecent([]); box.current?.scrollTo({ top: 0 }); }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  const list = mode === CHAPTERS ? [] : mode ? deck : cards;
  const save = (a: Record<string, Answer>) => { setAnswers(a); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ } };

  const answer = (card: FeedCard, choice: number) => {
    if (card.type === 'idea' || answers[card.id]) return;
    const right = choice === card.correct;
    const next = { ...answers, [card.id]: { choice, right } };
    save(next);
    setRecent((r) => [...r, right]);
    if (card.type !== 'predict') showResult(card.id, 60);
    if (navigator.vibrate) try { navigator.vibrate(right ? 25 : [30, 60, 30]); } catch { /* not allowed */ }
    fetch('/api/feed/answer', { method: 'POST', credentials: 'same-origin', headers: H, body: JSON.stringify({ card: card.id, choice }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.counts) setAnswers((a) => { const b = { ...a, [card.id]: { ...a[card.id]!, counts: j.counts } }; try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* */ } return b; }); })
      .catch(() => { /* offline: the card still marks the answer */ });
  };
  const goTo = (i: number) => {
    const el = box.current?.querySelectorAll<HTMLElement>('.fd-card')[i];
    if (!el) return;
    el.scrollIntoView({ behavior: document.documentElement.classList.contains('stem-calm') ? 'auto' : 'smooth', block: 'start' });
    el.querySelector<HTMLElement>('.fd-focus')?.focus({ preventScroll: true });
  };
  const goNext = (i: number) => goTo(i + 1);

  // the streak: answers right in a row, in feed order, up to the last one answered
  const answered = list.filter((c) => answers[c.id]);
  let streak = 0;
  for (const r of recent) streak = r ? streak + 1 : 0;
  const right = answered.filter((c) => answers[c.id]!.right).length;

  // which card is on screen: the one across the middle of the feed (a card taller than the screen still counts); and the keys
  // for a computer: down / up (or J / K) for the next / previous card
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { const k = Number((e.target as HTMLElement).dataset.i); if (!Number.isNaN(k)) { setCur(k); if (k > 0) setSwiped(true); } }
    }), { root, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    root.querySelectorAll('.fd-card[data-i]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mode, deck.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (mode === CHAPTERS || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j', up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k';
      if (!down && !up) return;
      e.preventDefault();
      goTo(Math.max(0, Math.min(list.length, cur + (down ? 1 : -1))));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, cur, list.length]);

  const why = (card: { why: Tri; correct: number }, a: Answer, labels: string[]) => {
    const total = (a.counts || []).reduce((x, y) => x + y, 0);
    return (
      <div class={'fd-result ' + (a.right ? 'ok' : 'no')} role="status">
        <p class="fd-verdict">{a.right ? '✓ ' + t(W.right) : '✗ ' + t(W.wrong)}</p>
        <p class="fd-why">{t(card.why)}</p>
        {total > 0 && (
          <div class="fd-poll" aria-label={t(W.everyone)}>
            <p>{t(W.everyone)} <small>({total} {t(total === 1 ? W.student : W.students)})</small></p>
            {labels.map((l, k) => {
              const pct = Math.round((100 * (a.counts![k] || 0)) / total);
              return (
                <div class={'fd-bar' + (k === card.correct ? ' is-right' : '') + (k === a.choice ? ' is-mine' : '')}>
                  <span class="fd-bar-fill" style={{ width: pct + '%' }} />
                  <span class="fd-bar-text">{l}</span><b>{pct}%</b>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // every chapter with practice questions, by grade, with how many of its questions this student has got right
  const grades = [...new Set(pools.map((p) => gradeOf(p.lesson)))];
  const chooser = (
    <div class="fd-pools">
      {grades.map((g) => (
        <>
          {g && <h3>{t(W.grade)} {g}</h3>}
          {pools.filter((p) => gradeOf(p.lesson) === g).map((p) => {
            const ch = byId.get(p.lesson);
            const ok = p.cards.filter((c) => answers[c.id]?.right).length;
            return <a class="btn fd-pool" href={'#' + p.slug}><span>{ch ? t(ch.title) : p.slug}</span><small>✓ {ok}/{p.cards.length}</small></a>;
          })}
        </>
      ))}
    </div>
  );

  return (
    <div class="fd" ref={box} aria-label={t(W.feed)}>
      {mode !== CHAPTERS && list.length > 0 && <div class="fd-progress" role="progressbar" aria-label={t(W.practice)} aria-valuemin={1} aria-valuemax={list.length} aria-valuenow={Math.min(cur + 1, list.length)}><i style={{ width: (100 * Math.min(cur + 1, list.length) / list.length) + '%' }} /></div>}
      {mode !== CHAPTERS && <div class="fd-score" aria-live="polite">✓ {right}/{answered.length} · 🔥 {streak} {t(W.streak)}{list.length > 0 && <span class="fd-pos"> · {Math.min(cur + 1, list.length)} / {list.length}</span>}</div>}
      {list.map((card, i) => {
        const ch = byId.get(card.lesson);
        const a = answers[card.id];
        const kind = card.type === 'predict' ? W.predict : card.type === 'tf' ? W.tf : card.type === 'idea' ? W.idea : W.quick;
        return (
          <section class={'fd-card is-' + card.type} key={round + ':' + card.id} data-card={card.id} data-i={i} aria-label={`${i + 1} / ${list.length}: ${t(kind)}`}>
            <div class="fd-inner">
              <p class="fd-kind">{t(kind)}{ch && <span> · {t(ch.title)}</span>}{'practice' in card && card.practice && <em class="fd-tag">{t(W.practice)}</em>}</p>
              {card.type === 'predict' && <Predict card={card} t={t} answer={a} onAnswer={(k) => answer(card, k)} why={why} />}
              {card.type === 'mcq' && (
                <>
                  {card.figure && <FigureSvg figure={card.figure} label={t(card.question)} />}
                  <h2 class="fd-q fd-focus" tabIndex={-1}>{t(card.question)}</h2>
                  <Options card={card} t={t} answer={a} onAnswer={(k) => answer(card, k)} />
                  {a && why(card, a, card.options.map(t))}
                </>
              )}
              {card.type === 'tf' && <TrueFalse card={card} t={t} answer={a} onAnswer={(k) => answer(card, k)} why={why} />}
              {card.type === 'idea' && (
                <>
                  <h2 class="fd-q fd-focus" tabIndex={-1}>{t(card.formula.name)}</h2>
                  <p class="fd-math">{t(card.formula.math)}</p>
                  <p class="fd-ex"><b>{t(W.example)}</b> {t(card.formula.worked)}</p>
                  {card.formula.tip && <p class="fd-tip">💡 {t(card.formula.tip)}</p>}
                </>
              )}
              <div class="fd-foot">
                {ch && <a href={ch.url + '#notes'}>{t(W.learn)} →</a>}
                {(card.type === 'idea' || a) && <button type="button" class="btn primary fd-next" onClick={() => goNext(i)}>{t(W.next)} ↓</button>}
              </div>
            </div>
          </section>
        );
      })}
      {mode !== CHAPTERS && list.length > 0 && !swiped && cur === 0 && <div class="fd-cue" aria-hidden="true"><span>{t(W.swipeUp)}</span><i>⌃</i></div>}
      <section class="fd-card fd-end" data-i={list.length}>
        <div class="fd-inner">
          {mode === CHAPTERS ? (
            <>
              <h2 class="fd-q fd-focus" tabIndex={-1}>{t(W.chapters)}</h2>
              <p class="fd-tip">{t(W.pick)}</p>
              {chooser}
              <a class="btn" href="#">{t(W.toFeed)} ↓</a>
            </>
          ) : mode ? (
            <>
              <h2 class="fd-q fd-focus" tabIndex={-1}>🎉 {t(list.length ? W.roundDone : W.allDone)}</h2>
              {list.length > 0 && <p class="fd-big">{right} / {answered.length} {t(W.score)}</p>}
              {list.length > 0 && <button type="button" class="btn primary" onClick={() => restart(mode)}>{t(W.restart)}</button>}
              <a class="btn" href="#chapters">{t(W.chapters)}</a>
              <a class="btn" href="#">{t(W.backFeed)}</a>
            </>
          ) : (
            <>
              <h2 class="fd-q fd-focus" tabIndex={-1}>🎉 {t(W.done)}</h2>
              <p class="fd-big">{right} / {answered.length} {t(W.score)}</p>
              {chooser}
              <button type="button" class="btn" onClick={() => { const b = { ...answers }; cards.forEach((c) => delete b[c.id]); save(b); box.current?.scrollTo({ top: 0 }); }}>{t(W.again)}</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

type T = (x: Tri | string) => string;
type Why = (card: any, a: Answer, labels: string[]) => JSX.Element;

/** Tap one option; then the right one is marked, and the one chosen if it was wrong. */
function Options({ card, t, answer, onAnswer, locked = false }: { card: { options: Tri[]; correct: number }; t: T; answer?: Answer; onAnswer: (k: number) => void; locked?: boolean }) {
  return (
    <div class="fd-opts">
      {card.options.map((o, k) => {
        const cls = answer ? (k === card.correct ? ' is-right' : k === answer.choice ? ' is-wrong' : ' is-dim') : '';
        return <button type="button" class={'fd-opt' + cls} aria-pressed={answer?.choice === k} disabled={!!answer || locked} onClick={() => onAnswer(k)}>{t(o)}</button>;
      })}
    </div>
  );
}

/** A statement to swipe: right for true, left for false (or the two buttons). */
function TrueFalse({ card, t, answer, onAnswer, why }: { card: Extract<FeedCard, { type: 'tf' }>; t: T; answer?: Answer; onAnswer: (k: number) => void; why: Why }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const down = (e: PointerEvent) => { if (!answer) { start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } };
  const move = (e: PointerEvent) => { if (start.current !== null) setDx(e.clientX - start.current); };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (Math.abs(dx) > 90) onAnswer(dx > 0 ? 1 : 0);
    setDx(0);
  };
  const lean = dx > 40 ? ' lean-t' : dx < -40 ? ' lean-f' : '';
  return (
    <>
      {card.figure && <FigureSvg figure={card.figure} label={t(card.statement)} />}
      <div class={'fd-statement fd-focus' + lean} tabIndex={-1} style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <p>{t(card.statement)}</p>
        {!answer && <small>{t(W.swipe)}</small>}
      </div>
      <div class="fd-tf">
        <button type="button" class={'fd-opt fd-false' + (answer ? (card.correct === 0 ? ' is-right' : answer.choice === 0 ? ' is-wrong' : ' is-dim') : '')} disabled={!!answer} onClick={() => onAnswer(0)}>✗ {t(W.f)}</button>
        <button type="button" class={'fd-opt fd-true' + (answer ? (card.correct === 1 ? ' is-right' : answer.choice === 1 ? ' is-wrong' : ' is-dim') : '')} disabled={!!answer} onClick={() => onAnswer(1)}>✓ {t(W.t)}</button>
      </div>
      {answer && why(card, answer, [t(W.f), t(W.t)])}
    </>
  );
}

/**
 * Predict, then watch: the scene (or a video) plays up to its pause point when the card comes into view, waits for the
 * guess, then plays to the end. With animations switched off it jumps straight to the pause, then to the end.
 */
function Predict({ card, t, answer, onAnswer, why }: { card: Extract<FeedCard, { type: 'predict' }>; t: T; answer?: Answer; onAnswer: (k: number) => void; why: Why }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pos = useRef(0);                  // where the scene is, 0 to 1
  const [phase, setPhase] = useState<'idle' | 'intro' | 'guess' | 'reveal' | 'end'>('idle');
  const scene = card.scene ? SCENES[card.scene] : undefined;
  const calm = () => document.documentElement.classList.contains('stem-calm');

  const paint = (p: number) => {
    const cv = canvas.current;
    if (!cv || !scene) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 320;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(w * 0.75 * dpr); }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform((cv.width / 320), 0, 0, (cv.height / 240), 0, 0);
    ctx.clearRect(0, 0, 320, 240);
    scene.draw.call(scene, ctx, p, themeColors());
  };
  // play the scene from where it is to `to`, then call done
  const play = (to: number, done: () => void) => {
    if (!scene) return;
    if (calm()) { pos.current = to; paint(to); done(); return; }
    let last = performance.now();
    const step = (now: number) => {
      pos.current = Math.min(to, pos.current + (now - last) / scene.ms);
      last = now;
      paint(pos.current);
      if (pos.current < to) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  };
  const begin = () => {
    pos.current = 0;
    setPhase('intro');
    if (video.current && card.video) { video.current.currentTime = 0; void video.current.play().catch(() => setPhase('guess')); return; }
    play(scene!.pause, () => setPhase('guess'));
  };

  // start when the card comes into view; a card already answered shows its end
  useEffect(() => {
    const el = canvas.current || video.current;
    if (!el) return;
    if (answer) { pos.current = 1; paint(1); setPhase('end'); return; }
    paint(0);
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && phase === 'idle') { begin(); io.disconnect(); } }), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // a video stops at its pause point
  const onTime = () => {
    const v = video.current;
    if (v && card.video && phase === 'intro' && v.currentTime >= card.video.pauseAt) { v.pause(); setPhase('guess'); }
  };
  const choose = (k: number) => {
    onAnswer(k);
    setPhase('reveal');
    if (video.current && card.video) { void video.current.play().catch(() => setPhase('end')); return; }
    play(1, () => { setPhase('end'); showResult(card.id, 60); });
  };
  const again = () => {
    if (video.current && card.video) { video.current.currentTime = 0; void video.current.play(); return; }
    pos.current = 0;
    play(1, () => setPhase('end'));
  };

  return (
    <>
      <div class="fd-stage">
        {card.video
          ? <video ref={video} src={card.video.src} muted playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => setPhase('end')} />
          : <canvas ref={canvas} role="img" aria-label={t(card.question)} />}
        {phase === 'intro' && <span class="fd-badge">▶ {t(W.watching)}</span>}
      </div>
      <h2 class="fd-q fd-focus" tabIndex={-1}>{t(card.question)}</h2>
      {phase === 'guess' && !answer && <p class="fd-hint">{t(W.guess)}</p>}
      <Options card={card} t={t} answer={answer} locked={phase === 'intro'} onAnswer={(k) => (phase === 'guess' || phase === 'idle' ? choose(k) : undefined)} />
      {answer && phase === 'end' && why(card, answer, card.options.map(t))}
      {answer && phase === 'end' && <button type="button" class="btn btn-sm fd-replay" onClick={again}>↻ {t(W.replay)}</button>}
    </>
  );
}
