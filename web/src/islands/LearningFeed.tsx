import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import FigureSvg, { type Figure } from '../feed/figures';

type Tri = { en: string; ta: string; si: string };
export type FeedCard =
  | { id: string; type: 'mcq'; lesson: string; question: Tri; options: Tri[]; correct: number; why: Tri; figure?: Figure }
  | { id: string; type: 'tf'; lesson: string; statement: Tri; correct: number; why: Tri; figure?: Figure };
export interface Chapter { id: string; title: Tri; url: string }
/** A chapter's pool of practice questions (content/practice): all of them, one per screen, in a random order. */
export interface Pool { slug: string; lesson: string; cards: FeedCard[] }
/** #saved in the address: the questions bookmarked on this device. */
const SAVED = 'saved';
const gradeOf = (lesson: string) => /\.g(\d+)\./.exec(lesson)?.[1] ?? '';

interface Answer { choice: number; right: boolean; counts?: number[] }
const KEY = 'stem_feed_v1';
const SAVED_KEY = 'stem_saved_v1';
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };

const W = {
  quick: { en: 'Quick question', ta: 'விரைவு வினா', si: 'ඉක්මන් ප්‍රශ්නය' },
  tf: { en: 'True or false?', ta: 'சரியா பிழையா?', si: 'සත්‍යද අසත්‍යද?' },
  swipe: { en: 'Swipe right for true, left for false', ta: 'சரி என்றால் வலப்பக்கம், பிழை என்றால் இடப்பக்கம் தள்ளு', si: 'සත්‍ය නම් දකුණට, අසත්‍ය නම් වමට ස්වයිප් කරන්න' },
  t: { en: 'True', ta: 'சரி', si: 'සත්‍ය' },
  f: { en: 'False', ta: 'பிழை', si: 'අසත්‍ය' },
  right: { en: 'Right!', ta: 'சரி!', si: 'නිවැරදියි!' },
  wrong: { en: 'Not quite', ta: 'சரியில்லை', si: 'එතරම් නිවැරදි නැත' },
  poll: { en: '{p}% got this right · {n} answered', ta: '{p}% பேர் சரியாகச் சொன்னார்கள் · {n} பேர் பதிலளித்தனர்', si: '{p}%ක් නිවැරදියි · පිළිතුරු දුන්නේ {n} දෙනෙකි' },
  next: { en: 'Next', ta: 'அடுத்தது', si: 'ඊළඟ' },
  learn: { en: 'Learn it', ta: 'கற்றுக்கொள்', si: 'ඉගෙන ගන්න' },
  streak: { en: 'in a row', ta: 'தொடர்ச்சியாக', si: 'අඛණ්ඩව' },
  score: { en: 'right', ta: 'சரி', si: 'නිවැරදි' },
  feed: { en: 'Practice questions', ta: 'பயிற்சி வினாக்கள்', si: 'පුහුණු ප්‍රශ්න' },
  practice: { en: 'Progress through the chapter', ta: 'பாடத்தில் முன்னேற்றம்', si: 'පරිච්ඡේදයේ ප්‍රගතිය' },
  restart: { en: 'Start this chapter again', ta: 'இந்தப் பாடத்தை மீண்டும் தொடங்கு', si: 'මෙම පරිච්ඡේදය නැවත අරඹන්න' },
  swipeUp: { en: 'Swipe up', ta: 'மேலே தள்ளு', si: 'ඉහළට ස්වයිප් කරන්න' },
  roundDone: { en: 'Chapter finished', ta: 'பாடம் முடிந்தது', si: 'පරිච්ඡේදය අවසන්' },
  allDone: { en: 'You have answered every question in this chapter right!', ta: 'இந்தப் பாடத்தின் எல்லா வினாக்களுக்கும் சரியாகப் பதிலளித்தாய்!', si: 'මෙම පරිච්ඡේදයේ සියලු ප්‍රශ්නවලට ඔබ නිවැරදිව පිළිතුරු දුන්නා!' },
  chapters: { en: 'Practise a chapter', ta: 'ஒரு பாடத்தைப் பயிற்சி செய்', si: 'පරිච්ඡේදයක් පුහුණු වන්න' },
  pick: { en: 'Pick a chapter: its questions, one at a time. Swipe up for the next.', ta: 'ஒரு பாடத்தைத் தெரிவு செய்: அதன் வினாக்கள், ஒவ்வொன்றாக. அடுத்ததற்கு மேலே தள்ளு.', si: 'පරිච්ඡේදයක් තෝරන්න: එහි ප්‍රශ්න, එකින් එක. ඊළඟටට ඉහළට ස්වයිප් කරන්න.' },
  grade: { en: 'Grade', ta: 'தரம்', si: 'ශ්‍රේණිය' },
  save: { en: 'Save this question', ta: 'இந்த வினாவைச் சேமி', si: 'මෙම ප්‍රශ්නය සුරකින්න' },
  unsave: { en: 'Remove from saved', ta: 'சேமித்ததிலிருந்து நீக்கு', si: 'සුරැකියෙන් ඉවත් කරන්න' },
  saved: { en: 'Saved questions', ta: 'சேமித்த வினாக்கள்', si: 'සුරැකි ප්‍රශ්න' },
  savedNone: { en: 'Nothing saved yet. Tap the bookmark in the corner of a question to keep it here.', ta: 'இன்னும் எதுவும் சேமிக்கவில்லை. வினாவின் மூலையிலுள்ள புத்தகக்குறியைத் தொட்டால் இங்கே இருக்கும்.', si: 'තවම කිසිවක් සුරකා නැත. ප්‍රශ්නයක කොනේ ඇති පිටුසන තට්ටු කළොත් එය මෙහි තබා ගනී.' },
  savedDone: { en: 'That is all you saved', ta: 'சேமித்தவை இவ்வளவுதான்', si: 'ඔබ සුරැකියේ ඇත්තේ මෙපමණයි' },
};

const load = (): Record<string, Answer> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const loadSaved = (): string[] => { try { const s = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(s) ? s.filter((x) => typeof x === 'string') : []; } catch { return []; } };

/**
 * Practice: a chapter's questions, one per screen, swiped up like a reel (tap a chapter and its questions start at once).
 * Each question fits the screen: the picture gives way first, so nothing inside a card scrolls. Every answer is checked at
 * once with a one-line reason and how many students got it right (the API keeps each student's first answer). A bookmark in
 * the corner keeps a question for later (#saved). Answers and bookmarks are kept on this device.
 */
export default function LearningFeed({ chapters, pools = [] }: { chapters: Chapter[]; pools?: Pool[] }) {
  const lang = useStore($lang);
  const t = (x: Tri | string) => (typeof x === 'string' ? x : x[lang] || x.en);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const every = new Map(pools.flatMap((p) => p.cards).map((c) => [c.id, c] as const));

  // #<chapter> in the address: a round of that chapter's questions; #saved: the bookmarked ones; anything else: the chapter list
  const [mode, setMode] = useState('');
  const [deck, setDeck] = useState<FeedCard[]>([]);
  const [cur, setCur] = useState(0);                 // the card on screen
  const [round, setRound] = useState(0);             // counts the times a deck is dealt, so a new order is drawn afresh, not moved about
  const [recent, setRecent] = useState<boolean[]>([]);  // this visit's answers, right or wrong, in order (for the streak)
  const [swiped, setSwiped] = useState(false);          // has the student moved on from the first card yet
  const toTop = () => { box.current?.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => box.current?.scrollTo({ top: 0, behavior: 'instant' })); };   // again once the new order is drawn
  const start = (slug: string, cards: FeedCard[]) => {
    setDeck(cards);
    setMode(slug);
    setCur(0);
    setRecent([]);
    setSwiped(false);
    setRound((r) => r + 1);
    toTop();
  };
  const deal = (slug: string, a: Record<string, Answer>) => {
    const pool = pools.find((p) => p.slug === slug);
    if (!pool) { setMode(''); setDeck([]); return; }
    const mix = <X,>(xs: X[]) => xs.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    // every question of the chapter, in a random order: the ones not answered yet first, then the ones answered wrong (they
    // come back to try again), then the ones already right
    const fresh = mix(pool.cards.filter((c) => !a[c.id]));
    const again = mix(pool.cards.filter((c) => a[c.id] && !a[c.id]!.right));
    const done = mix(pool.cards.filter((c) => a[c.id]?.right));
    if (again.length) { const b = { ...a }; again.forEach((c) => delete b[c.id]); save(b); }
    start(slug, [...fresh, ...again, ...done]);
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
    setAnswers(load());
    setSaved(loadSaved());
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h === SAVED) start(SAVED, loadSaved().map((id) => every.get(id)).filter(Boolean) as FeedCard[]);   // newest first, as saved
      else if (pools.some((p) => p.slug === h)) deal(h, load());
      else { setMode(''); setDeck([]); setCur(0); setRecent([]); setAnswers(load()); setSaved(loadSaved()); box.current?.scrollTo({ top: 0, behavior: 'instant' }); }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  const list = mode ? deck : [];
  const save = (a: Record<string, Answer>) => { setAnswers(a); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ } };
  const toggleSave = (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [id, ...saved];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const answer = (card: FeedCard, choice: number) => {
    if (answers[card.id]) return;
    const right = choice === card.correct;
    save({ ...answers, [card.id]: { choice, right } });
    setRecent((r) => [...r, right]);
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

  // the streak: answers right in a row, in order, up to the last one answered
  const answered = list.filter((c) => answers[c.id]);
  let streak = 0;
  for (const r of recent) streak = r ? streak + 1 : 0;
  const right = answered.filter((c) => answers[c.id]!.right).length;

  // which card is on screen: the one across the middle of the feed; and the keys for a computer: down / up (or J / K)
  useEffect(() => {
    const root = box.current;
    if (!root || !mode) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { const k = Number((e.target as HTMLElement).dataset.i); if (!Number.isNaN(k)) { setCur(k); if (k > 0) setSwiped(true); } }
    }), { root, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    root.querySelectorAll('.fd-card[data-i]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mode, deck.length, round]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!mode || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j', up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k';
      if (!down && !up) return;
      e.preventDefault();
      goTo(Math.max(0, Math.min(list.length, cur + (down ? 1 : -1))));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, cur, list.length]);

  /** After an answer: the verdict, the reason, and what share of students got it right (short, so the card still fits the screen). */
  const why = (card: { why: Tri; correct: number }, a: Answer) => {
    const total = (a.counts || []).reduce((x, y) => x + y, 0);
    const pct = total ? Math.round((100 * (a.counts![card.correct] || 0)) / total) : 0;
    return (
      <div class={'fd-result ' + (a.right ? 'ok' : 'no')} role="status">
        <p class="fd-why"><b class="fd-verdict">{a.right ? '✓ ' + t(W.right) : '✗ ' + t(W.wrong)}</b> {t(card.why)}</p>
        {total > 0 && <p class="fd-poll">{t(W.poll).replace('{p}', String(pct)).replace('{n}', String(total))}</p>}
      </div>
    );
  };

  // every chapter with practice questions, by grade, with how many of its questions this student has got right
  const grades = [...new Set(pools.map((p) => gradeOf(p.lesson)))];
  const savedCount = saved.filter((id) => every.has(id)).length;
  const chooser = (
    <div class="fd-pools">
      <a class="btn fd-pool fd-savedlink" href={'#' + SAVED}><span>🔖 {t(W.saved)}</span><small>{savedCount}</small></a>
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

  const here = list[cur];
  const isSaved = !!here && saved.includes(here.id);
  const shown = Math.min(cur + 1, list.length);
  return (
    <div class={'fd' + (mode ? '' : ' is-list')} ref={box} aria-label={t(W.feed)}>
      {mode && (
        <div class="fd-hud">
          {list.length > 0 && <div class="fd-progress" role="progressbar" aria-label={t(W.practice)} aria-valuemin={1} aria-valuemax={list.length} aria-valuenow={shown}><i style={{ width: (100 * shown / list.length) + '%' }} /></div>}
          <div class="fd-score" aria-live="polite">✓ {right}/{answered.length} · 🔥 {streak}{list.length > 0 && <span class="fd-pos"> · {shown} / {list.length}</span>}</div>
          {here && (
            <button type="button" class={'fd-save' + (isSaved ? ' is-on' : '')} aria-pressed={isSaved} aria-label={t(isSaved ? W.unsave : W.save)} onClick={() => toggleSave(here.id)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" /></svg>
            </button>
          )}
        </div>
      )}
      {list.map((card, i) => {
        const ch = byId.get(card.lesson);
        const a = answers[card.id];
        return (
          <section class={'fd-card is-' + card.type + (a ? ' is-answered' : '')} key={round + ':' + card.id} data-card={card.id} data-i={i} aria-label={`${i + 1} / ${list.length}: ${t(card.type === 'tf' ? W.tf : W.quick)}`}>
            <div class="fd-inner">
              <p class="fd-kind">{t(card.type === 'tf' ? W.tf : W.quick)}{mode === SAVED && ch && <span> · {t(ch.title)}</span>}</p>
              {card.type === 'mcq' ? (
                <>
                  {card.figure && <FigureSvg figure={card.figure} label={t(card.question)} />}
                  <h2 class="fd-q fd-focus" tabIndex={-1}>{t(card.question)}</h2>
                  <Options card={card} t={t} answer={a} onAnswer={(k) => answer(card, k)} />
                </>
              ) : (
                <TrueFalse card={card} t={t} answer={a} onAnswer={(k) => answer(card, k)} />
              )}
              {a && why(card, a)}
            </div>
            <div class="fd-foot">
              {ch && <a href={ch.url + '#notes'}>{t(W.learn)} →</a>}
              {a
                ? <button type="button" class="btn primary fd-next" onClick={() => goTo(i + 1)}>{t(W.next)} ↓</button>
                : i === 0 && !swiped && <span class="fd-cue" aria-hidden="true"><i>⌃</i> {t(W.swipeUp)}</span>}
            </div>
          </section>
        );
      })}
      {mode ? (
        <section class="fd-card fd-end" data-i={list.length}>
          <div class="fd-inner">
            {mode === SAVED ? (
              <>
                <h2 class="fd-q fd-focus" tabIndex={-1}>🔖 {t(list.length ? W.savedDone : W.saved)}</h2>
                {!list.length && <p class="fd-tip">{t(W.savedNone)}</p>}
              </>
            ) : (
              <>
                <h2 class="fd-q fd-focus" tabIndex={-1}>🎉 {t(list.length ? W.roundDone : W.allDone)}</h2>
                {list.length > 0 && <p class="fd-big">{right} / {answered.length} {t(W.score)}</p>}
                {list.length > 0 && <button type="button" class="btn primary" onClick={() => restart(mode)}>{t(W.restart)}</button>}
              </>
            )}
            <a class="btn" href="#chapters">{t(W.chapters)}</a>
          </div>
        </section>
      ) : (
        <div class="fd-listpage">
          <h2 class="fd-q fd-focus" tabIndex={-1}>{t(W.chapters)}</h2>
          <p class="fd-tip">{t(W.pick)}</p>
          {chooser}
        </div>
      )}
    </div>
  );
}

type T = (x: Tri | string) => string;

/** Tap one option; then the right one is marked, and the one chosen if it was wrong. */
function Options({ card, t, answer, onAnswer }: { card: { options: Tri[]; correct: number }; t: T; answer?: Answer; onAnswer: (k: number) => void }) {
  return (
    <div class="fd-opts">
      {card.options.map((o, k) => {
        const cls = answer ? (k === card.correct ? ' is-right' : k === answer.choice ? ' is-wrong' : ' is-dim') : '';
        return <button type="button" class={'fd-opt' + cls} aria-pressed={answer?.choice === k} disabled={!!answer} onClick={() => onAnswer(k)}>{t(o)}</button>;
      })}
    </div>
  );
}

/** A statement to swipe: right for true, left for false (or the two buttons). */
function TrueFalse({ card, t, answer, onAnswer }: { card: Extract<FeedCard, { type: 'tf' }>; t: T; answer?: Answer; onAnswer: (k: number) => void }) {
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
    </>
  );
}
