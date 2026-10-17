import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import FigureSvg, { type Figure } from '../feed/figures';

type Tri = { en: string; ta: string; si: string };
export type FeedCard =
  | { id: string; type: 'mcq'; lesson: string; question: Tri; options: Tri[]; correct: number; why: Tri; figure?: Figure }
  | { id: string; type: 'tf'; lesson: string; statement: Tri; correct: number; why: Tri; figure?: Figure };
export interface Chapter { id: string; title: Tri; url: string }
/** A chapter with practice questions (content/practice): the page knows only this; its questions come from /feed/<slug>.json
 * when it is opened. `prefix` is its questions' id prefix ("hp" for hp-001), to find a saved question's chapter. */
export interface Pool { slug: string; lesson: string; count: number; prefix: string }
/** A question as /feed/<slug>.json sends it. */
interface Q { id: string; type: 'mcq' | 'tf'; q: Tri; options?: Tri[]; correct: number; why: Tri; figure?: Figure }
const toCard = (q: Q, lesson: string): FeedCard => (q.type === 'tf'
  ? { id: q.id, type: 'tf', lesson, statement: q.q, correct: q.correct, why: q.why, figure: q.figure }
  : { id: q.id, type: 'mcq', lesson, question: q.q, options: q.options || [], correct: q.correct, why: q.why, figure: q.figure });
const prefixOf = (id: string) => id.replace(/-\d+$/, '');
const shuffle = <X,>(xs: X[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
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
  questions: { en: 'questions', ta: 'வினாக்கள்', si: 'ප්‍රශ්න' },
  feed: { en: 'Practice questions', ta: 'பயிற்சி வினாக்கள்', si: 'පුහුණු ප්‍රශ්න' },
  place: { en: 'Question', ta: 'வினா', si: 'ප්‍රශ්නය' },
  restart: { en: 'Practise this chapter again', ta: 'இந்தப் பாடத்தை மீண்டும் பயிற்சி செய்', si: 'මෙම පරිච්ඡේදය නැවත පුහුණු වන්න' },
  swipeUp: { en: 'Swipe up', ta: 'மேலே தள்ளு', si: 'ඉහළට ස්වයිප් කරන්න' },
  roundDone: { en: 'Chapter finished', ta: 'பாடம் முடிந்தது', si: 'පරිච්ඡේදය අවසන්' },
  noneHere: { en: 'No questions here yet.', ta: 'இங்கு இன்னும் வினாக்கள் இல்லை.', si: 'මෙහි තවම ප්‍රශ්න නැත.' },
  chapters: { en: 'Practise a chapter', ta: 'ஒரு பாடத்தைப் பயிற்சி செய்', si: 'පරිච්ඡේදයක් පුහුණු වන්න' },
  pick: { en: 'Pick a chapter: its questions, one at a time. Swipe up for the next.', ta: 'ஒரு பாடத்தைத் தெரிவு செய்: அதன் வினாக்கள், ஒவ்வொன்றாக. அடுத்ததற்கு மேலே தள்ளு.', si: 'පරිච්ඡේදයක් තෝරන්න: එහි ප්‍රශ්න, එකින් එක. ඊළඟටට ඉහළට ස්වයිප් කරන්න.' },
  grade: { en: 'Grade', ta: 'தரம்', si: 'ශ්‍රේණිය' },
  save: { en: 'Save this question', ta: 'இந்த வினாவைச் சேமி', si: 'මෙම ප්‍රශ්නය සුරකින්න' },
  unsave: { en: 'Remove from saved', ta: 'சேமித்ததிலிருந்து நீக்கு', si: 'සුරැකියෙන් ඉවත් කරන්න' },
  saved: { en: 'Saved questions', ta: 'சேமித்த வினாக்கள்', si: 'සුරැකි ප්‍රශ්න' },
  savedNone: { en: 'Nothing saved yet. Tap the bookmark in the corner of a question to keep it here.', ta: 'இன்னும் எதுவும் சேமிக்கவில்லை. வினாவின் மூலையிலுள்ள புத்தகக்குறியைத் தொட்டால் இங்கே இருக்கும்.', si: 'තවම කිසිවක් සුරකා නැත. ප්‍රශ්නයක කොනේ ඇති පිටුසන තට්ටු කළොත් එය මෙහි තබා ගනී.' },
  savedDone: { en: 'That is all you saved', ta: 'சேமித்தவை இவ்வளவுதான்', si: 'ඔබ සුරැකියේ ඇත්තේ මෙපමණයි' },
  loading: { en: 'Loading the questions…', ta: 'வினாக்கள் ஏற்றப்படுகின்றன…', si: 'ප්‍රශ්න පූරණය වෙමින්…' },
  loadFail: { en: 'The questions could not load. Check your connection and try again.', ta: 'வினாக்கள் ஏற்றப்படவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சி செய்.', si: 'ප්‍රශ්න පූරණය කළ නොහැකි විය. සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.' },
  retry: { en: 'Try again', ta: 'மீண்டும் முயற்சி', si: 'නැවත උත්සාහ කරන්න' },
  siNote: { en: 'Practice questions are in English and Tamil for now; Sinhala is coming.', ta: 'பயிற்சி வினாக்கள் தற்போது ஆங்கிலத்திலும் தமிழிலும் மட்டும்.', si: 'පුහුණු ප්‍රශ්න දැනට ඉංග්‍රීසියෙන් සහ දෙමළෙන් පමණි; සිංහල ඉක්මනින් එකතු වේ.' },
};

const loadSaved = (): string[] => { try { const s = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(s) ? s.filter((x) => typeof x === 'string') : []; } catch { return []; } };

/**
 * Practice: a chapter's questions, one per screen, swiped up like a reel (tap a chapter and its questions start at once).
 * Each question fits the screen: the picture gives way first, so nothing inside a card scrolls. Every answer is checked at
 * once with a one-line reason and how many students got it right. Nothing is marked as done: an answer lives only while the
 * question is on this page, so every visit starts fresh and any question can be practised again. A bookmark in the corner
 * keeps a question for later (#saved); that is the one thing kept on this device.
 */
export default function LearningFeed({ chapters, pools = [] }: { chapters: Chapter[]; pools?: Pool[] }) {
  const lang = useStore($lang);
  const t = (x: Tri | string) => (typeof x === 'string' ? x : x[lang] || x.en);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const byPrefix = new Map(pools.map((p) => [p.prefix, p.slug]));

  // #<chapter> in the address: a round of that chapter's questions; #saved: the bookmarked ones; anything else: the chapter list
  const [mode, setMode] = useState('');
  const [deck, setDeck] = useState<FeedCard[]>([]);
  const [cur, setCur] = useState(0);                 // the card on screen
  const [round, setRound] = useState(0);             // counts the times a deck is dealt, so a new order is drawn afresh, not moved about
  const [swiped, setSwiped] = useState(false);          // has the student moved on from the first card yet
  const [status, setStatus] = useState<'' | 'loading' | 'error'>('');   // fetching a chapter, or it could not be fetched
  const cache = useRef(new Map<string, FeedCard[]>());    // the chapters fetched on this visit
  const want = useRef('');                               // the deck asked for last (a slower earlier answer is dropped)
  const toTop = () => { box.current?.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => box.current?.scrollTo({ top: 0, behavior: 'instant' })); };   // again once the new order is drawn
  const start = (slug: string, cards: FeedCard[]) => {
    setDeck(cards);
    setMode(slug);
    setCur(0);
    setAnswers({});                                // every visit starts fresh: nothing answered, nothing marked
    setSwiped(false);
    setRound((r) => r + 1);
    toTop();
  };
  /** A chapter's questions: from this visit's copy, else from the server (15 s at most). */
  const fetchPool = async (slug: string): Promise<FeedCard[]> => {
    const hit = cache.current.get(slug);
    if (hit) return hit;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch('/feed/' + encodeURIComponent(slug) + '.json', { credentials: 'same-origin', signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const j: { lesson: string; questions: Q[] } = await r.json();
      const cards = j.questions.map((q) => toCard(q, j.lesson));
      cache.current.set(slug, cards);
      return cards;
    } finally {
      clearTimeout(timer);
    }
  };
  /** Open a deck (a chapter, or the saved questions) once its questions are here. */
  const open = async (slug: string, get: () => Promise<FeedCard[]>) => {
    want.current = slug;
    setMode(slug);
    setDeck([]);
    setStatus('loading');
    try {
      const cards = await get();
      if (want.current !== slug) return;
      setStatus('');
      start(slug, cards);
    } catch {
      if (want.current === slug) setStatus('error');
    }
  };
  // every question of the chapter, in a random order, each time
  const deal = (slug: string) => open(slug, async () => shuffle(await fetchPool(slug)));
  // the saved questions, newest first: only their chapters are fetched
  const dealSaved = () => open(SAVED, async () => {
    const ids = loadSaved();
    const slugs = [...new Set(ids.map((id) => byPrefix.get(prefixOf(id))).filter((x): x is string => !!x))];
    const all = new Map((await Promise.all(slugs.map(fetchPool))).flat().map((c) => [c.id, c] as const));
    return ids.map((id) => all.get(id)).filter((c): c is FeedCard => !!c);
  });
  useEffect(() => {
    loadPrefs();
    try { localStorage.removeItem(KEY); } catch { /* answers used to be kept here: not any more */ }
    setSaved(loadSaved());
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h === SAVED) void dealSaved();
      else if (pools.some((p) => p.slug === h)) void deal(h);
      else { document.documentElement.classList.remove('fd-deep'); want.current = ''; setStatus(''); setMode(''); setDeck([]); setCur(0); setAnswers({}); setSaved(loadSaved()); box.current?.scrollTo({ top: 0, behavior: 'instant' }); }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  const list = mode ? deck : [];
  const toggleSave = (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [id, ...saved];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const answer = (card: FeedCard, choice: number) => {
    if (answers[card.id]) return;
    const right = choice === card.correct;
    setAnswers({ ...answers, [card.id]: { choice, right } });
    if (navigator.vibrate) try { navigator.vibrate(right ? 25 : [30, 60, 30]); } catch { /* not allowed */ }
    fetch('/api/feed/answer', { method: 'POST', credentials: 'same-origin', headers: H, body: JSON.stringify({ card: card.id, choice }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.counts) setAnswers((a) => (a[card.id] ? { ...a, [card.id]: { ...a[card.id]!, counts: j.counts } } : a)); })
      .catch(() => { /* offline: the card still marks the answer */ });
  };
  const goTo = (i: number) => {
    const el = box.current?.querySelectorAll<HTMLElement>('.fd-card')[i];
    if (!el) return;
    el.scrollIntoView({ behavior: document.documentElement.classList.contains('stem-calm') ? 'auto' : 'smooth', block: 'start' });
    el.querySelector<HTMLElement>('.fd-focus')?.focus({ preventScroll: true });
  };

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
  const savedCount = saved.filter((id) => byPrefix.has(prefixOf(id))).length;
  const chooser = (
    <div class="fd-pools">
      <a class="btn fd-pool fd-savedlink" href={'#' + SAVED}><span>🔖 {t(W.saved)}</span><small>{savedCount}</small></a>
      {grades.map((g) => (
        <>
          {g && <h3>{t(W.grade)} {g}</h3>}
          {pools.filter((p) => gradeOf(p.lesson) === g).map((p) => {
            const ch = byId.get(p.lesson);
            return <a class="btn fd-pool" href={'#' + p.slug}><span>{ch ? t(ch.title) : p.slug}</span><small>{p.count} {t(W.questions)}</small></a>;
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
          {list.length > 0 && <div class="fd-score" aria-live="polite"><span class="fd-pos">{t(W.place)} {shown} / {list.length}</span></div>}
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
      {mode && status ? (
        <section class="fd-card fd-end fd-wait" key="wait">   {/* its own key: it goes when the questions come, it does not slide down to become the end card */}
          <div class="fd-inner">
            {status === 'loading'
              ? <p class="fd-tip" role="status">{t(W.loading)}</p>
              : <>
                  <p class="fd-tip" role="alert">{t(W.loadFail)}</p>
                  <button type="button" class="btn primary" onClick={() => (mode === SAVED ? dealSaved() : deal(mode))}>{t(W.retry)}</button>
                  <a class="btn" href="#chapters">{t(W.chapters)}</a>
                </>}
          </div>
        </section>
      ) : mode ? (
        <section class="fd-card fd-end" key="end" data-i={list.length}>
          <div class="fd-inner">
            {mode === SAVED ? (
              <>
                <h2 class="fd-q fd-focus" tabIndex={-1}>🔖 {t(list.length ? W.savedDone : W.saved)}</h2>
                {!list.length && <p class="fd-tip">{t(W.savedNone)}</p>}
              </>
            ) : (
              <>
                <h2 class="fd-q fd-focus" tabIndex={-1}>🎉 {t(list.length ? W.roundDone : W.noneHere)}</h2>
                {list.length > 0 && <button type="button" class="btn primary" onClick={() => void deal(mode)}>{t(W.restart)}</button>}
              </>
            )}
            <a class="btn" href="#chapters">{t(W.chapters)}</a>
          </div>
        </section>
      ) : (
        <div class="fd-listpage">
          <h2 class="fd-q fd-focus" tabIndex={-1}>{t(W.chapters)}</h2>
          <p class="fd-tip">{t(W.pick)}</p>
          {lang === 'si' && <p class="fd-note" role="note">{t(W.siNote)}</p>}
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
