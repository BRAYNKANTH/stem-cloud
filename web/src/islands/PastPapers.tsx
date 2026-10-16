import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import { onceId, record, reward, signedIn, start as startProgress } from '../stores/progress';

/*
 * Past papers: the O/L Science papers' physics questions (content/past-papers/physics/), by the lesson chapters they
 * test. One thing on the screen at a time:
 *  - Home: a "continue" card, the chapters by grade, and the years at the bottom.
 *  - A chapter (or a year): its questions as a list, with a "practise 10" button and four filters.
 *  - A question, on its own screen: choose and check. The verdict comes with one short reason; the full explanation
 *    (the idea, step by step, why it works, the common mistake) is folded away, and opens by itself after a wrong
 *    answer. A written question's parts each show their model answer on request; typing an answer is optional.
 *  - A practice set: up to 10 of a chapter's questions, the ones to revisit first, then a summary.
 * There is no paper (exam) mode any more; a paper someone had started is kept as drafts.
 * Drafts stay on this device; attempts and bookmarks sync to the account through the existing API (/api/past-papers/*),
 * under the same device key as before (stem_pp_physics_<user id>). A question right for the first time is worth 5 XP,
 * once, and every question of a chapter right earns a badge (progress v2).
 */

type Lang = 'en' | 'ta' | 'si';
type Tx = { en?: string; ta?: string; si?: string } | undefined;
interface Ref { kind: string; url: string; grade?: number; chapter?: number | string; title?: Tx; language?: string; printedPages?: number[]; section?: Tx; support?: string; note?: Tx }
interface Teaching { concept: Tx; reasoning: Tx; commonMistake: Tx; practice: { question: Tx; answer: Tx } }
interface Part { label: string; subject: string; prompt: Tx; answer: Tx; hint?: Tx; steps?: Tx[]; lessons?: string[]; detailedExplanation?: Teaching; references?: Ref[]; textbookReferenceStatus?: string }
interface Question {
  id: string; number: number; paper: string; type: 'mcq' | 'written'; subjects: string[]; topics: string[]; lessons: string[]; pages: number[];
  prompt: Tx; options?: Tx[]; correct?: number; explanation?: Tx; optionExplanations?: Tx[]; hint?: Tx; steps?: Tx[]; figure?: string;
  sourceDescription?: Tx; editorialWarning?: Tx; marks?: number; parts?: Part[]; year: number;
  detailedExplanation?: Teaching; references?: Ref[]; textbookReferenceStatus?: string;
  /** From the light file (the lists need only the prompt): the answers and explanations come with the full banks. */
  light?: boolean;
}
interface Bank { year: number; scope: string; questions: Question[]; papers: { id: string; instructions: Tx }[] }
interface Result { type: 'mcq' | 'written'; choice?: number | null; correct?: boolean; correctChoice?: number; answers?: Record<string, string>; selfCheck?: string | null; mode?: string }
interface Attempt { id: string; question: string; result: Result; at: number }
interface Draft { answers: Record<string, string>; choice?: number | null; touched?: boolean }
interface Pending { id: string; question: string; mode: string; choice?: number | null; answers?: Record<string, string>; selfCheck?: string | null }
interface State { drafts: Record<string, Draft>; events: Attempt[]; pending: Pending[]; bookmarks: string[]; bookmarkPending: Record<string, boolean>; exam?: { responses?: Record<string, Draft> } | null }
/** A lesson chapter (content/catalog.json): its page file stem (the questions' "lessons"), grade, number, title, new page. */
export interface Chapter { key: string; grade: number; number: string; title: { en: string; ta?: string; si?: string }; url: string }
type Status = 'right' | 'revisit' | 'tried' | 'new';
type Filter = '' | 'new' | 'revisit' | 'saved';
/** Where the student is: a list is a chapter's or a year's; a question is shown within its list. */
type Place = { kind: 'chapter'; key: string } | { kind: 'year'; year: number };
type View = { kind: 'home' } | (Place & { q?: string }) | { kind: 'set'; key: string };

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + '_' + Math.random().toString(36).slice(2));
/** A written attempt counts once it has an answer or a self-check (typing is optional). */
const hasResponse = (r?: Result) => !!r && (r.type === 'mcq' ? Number.isInteger(r.choice) : !!r.selfCheck || Object.values(r.answers || {}).some((s) => s.trim()));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const chaptersOf = (q: Question) => [...new Set([...(q.lessons || []), ...(q.parts || []).flatMap((p) => p.lessons || [])])];
const SET_SIZE = 10;
const OTHER = 'other';
const LAST = 'stem_pp_last';

// The model diagrams the current page draws for four 2015 written parts (copied unchanged).
const DIAGRAMS: Record<string, string> = {
  '3|C(iii)': '<svg class="pp-model-diagram" viewBox="0 0 400 260" role="img" aria-label="Charles law graph: volume V vertically, absolute temperature T in kelvin horizontally; straight line through origin"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M60 30V215H360 M55 40L60 30L65 40 M350 210L360 215L350 220 M60 215L320 50"/></g><g font-size="17" fill="currentColor"><text x="28" y="35">V</text><text x="300" y="245">T (K)</text><text x="42" y="240">0</text><text x="100" y="55">Constant pressure</text></g></svg>',
  '4|C(ii)': '<svg class="pp-model-diagram" viewBox="0 0 400 160" role="img" aria-label="Two-input OR gate: inputs A and B, output Q"><path d="M105 35 Q150 80 105 125 Q220 135 260 80 Q220 25 105 35Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M40 55H120 M40 105H120 M260 80H350" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><text x="15" y="60">A</text><text x="15" y="110">B</text><text x="360" y="85">Q</text></g></svg>',
  '4|B(v)(a)': '<svg class="pp-model-diagram" viewBox="0 0 480 260" role="img" aria-label="Ohm law model circuit: battery switch rheostat ammeter and resistor in series; voltmeter across resistor"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M45 60H110 M110 45V75 M122 35V85 M122 60H170 M170 60L200 40 M200 60H230 M280 60H335 M375 60H430V205H330 M255 205H45V60 M255 205V140H278 M307 140H330V205"/><rect x="230" y="49" width="50" height="22"/><path d="M235 82L275 38 M267 40L275 38L274 47"/><circle cx="355" cy="60" r="20"/><rect x="255" y="193" width="75" height="24"/><circle cx="292" cy="140" r="16"/></g><g fill="currentColor" font-size="17"><text x="349" y="66">A</text><text x="286" y="146">V</text><text x="270" y="239">R</text><text x="90" y="112">Battery</text><text x="160" y="25">Switch</text><text x="230" y="112">Rheostat</text></g></svg>',
  '10|iii(a)': '<svg class="pp-model-diagram" viewBox="0 0 440 170" role="img" aria-label="Photodiode: incoming light arrows, anode left positive, cathode bar right negative; conventional terminal labels"><g fill="none" stroke="currentColor" stroke-width="3"><path d="M35 110H170 M220 110H400 M170 85L215 110L170 135Z M220 83V137 M210 25L182 64 M238 30L210 68 M183 52L182 64L194 60 M211 56L210 68L222 64"/></g><g font-size="16" fill="currentColor"><text x="20" y="150">Anode (+)</text><text x="300" y="150">Cathode (−)</text><text x="40" y="25">Incoming light</text></g></svg>',
};

function viewFromHash(): View {
  const h = decodeURIComponent(location.hash.slice(1));   // chapter keys are lesson page names, or "other"
  let m: RegExpMatchArray | null;
  if ((m = h.match(/^chapter\/([a-z0-9-]+?)(?:\/(ol\d{4}-[a-z0-9-]+))?$/))) return { kind: 'chapter', key: m[1]!, q: m[2] };
  if ((m = h.match(/^practise\/([a-z0-9-]+)$/))) return { kind: 'set', key: m[1]! };
  if ((m = h.match(/^year\/(\d{4})(?:\/(ol\d{4}-[a-z0-9-]+))?$/))) return { kind: 'year', year: Number(m[1]), q: m[2] };
  return { kind: 'home' };                                  // also the old #chapters and #years
}
function hashOf(v: View): string {
  if (v.kind === 'home') return '#';
  if (v.kind === 'set') return '#practise/' + v.key;
  return (v.kind === 'chapter' ? '#chapter/' + v.key : '#year/' + v.year) + (v.q ? '/' + v.q : '');
}

/**
 * The physics question banks, one request (/lessons/past-papers/all.json: the catalog and every year, packed and compressed
 * on the server, and kept by the browser). If that is not there, the old way: the catalog, then each year.
 */
function loadBanks(): { first: Promise<Bank[]>; full: Promise<Bank[]> } {
  const full = loadFullBanks();
  // the chapter list needs only the light file (a tenth of the size, no answers or explanations): it shows as soon as that
  // is here, while the full banks are still on their way; with no light file, the full ones are waited for
  const first = (async () => {
    try {
      const r = await fetch('/lessons/past-papers/light.json', { credentials: 'same-origin' });
      if (r.ok && !r.redirected) return (Object.values((await r.json()).banks) as Bank[]).map(fixBank);
    } catch { /* wait for the full banks */ }
    return full;
  })();
  return { first, full };
}
const fixBank = (bk: Bank) => { if (bk.scope !== 'physics') throw new Error('scope'); bk.questions.forEach((q) => (q.year = bk.year)); return bk; };
async function loadFullBanks(): Promise<Bank[]> {
  const fix = fixBank;
  try {
    const r = await fetch('/lessons/past-papers/all.json', { credentials: 'same-origin' });
    if (r.ok && !r.redirected) {
      const all = await r.json();
      return (Object.values(all.banks) as Bank[]).map(fix);
    }
  } catch { /* try the old way */ }
  const r = await fetch('/lessons/past-papers/catalog.json', { credentials: 'same-origin' });
  if (!r.ok || r.redirected) throw new Error('catalog');
  const cat = await r.json();
  const entries = cat.papers.filter((p: { bank?: string; scope?: string }) => p.bank && p.scope === 'physics');
  return Promise.all(entries.map(async (p: { bank: string }) => {
    const b = await fetch(p.bank, { credentials: 'same-origin' });
    if (!b.ok || b.redirected) throw new Error('bank');
    return fix(await b.json());
  }));
}

export default function PastPapers({ chapters = [] }: { chapters?: Chapter[] }) {
  const pageLang = useStore($lang);
  const lang: Lang = pageLang === 'ta' ? 'ta' : pageLang === 'si' ? 'si' : 'en';
  /** Interface words in the three languages. */
  const t = (en: string, ta: string, si?: string) => (lang === 'ta' ? ta : lang === 'si' ? si || en : en);
  const tr = (o: Tx) => (o && (o[lang] || o.en)) || '';
  const qLabel = (q: Question) => t(`${q.year} · Paper ${q.paper} · Q${q.number}`, `${q.year} · தாள் ${q.paper} · வினா ${q.number}`, `${q.year} · ${q.paper} පත්‍රය · ප්‍රශ්න ${q.number}`);
  const typeWord = (q: Question) => (q.type === 'mcq' ? t('Multiple choice', 'தெரிவு வினா', 'බහුවරණ') : t('Written', 'எழுத்து', 'ලිඛිත'));
  const chapterName = (c: Chapter) => (c.title[lang] || c.title.en);
  const byKey = useMemo(() => new Map(chapters.map((c) => [c.key, c])), [chapters]);

  const [user, setUser] = useState<number | null | undefined>(undefined);
  const [banks, setBanks] = useState<Record<number, Bank>>({});
  const [st, setSt] = useState<State | null>(null);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [filter, setFilter] = useState<Filter>('');
  const [set, setSet] = useState<{ key: string; ids: string[]; i: number; done: boolean } | null>(null);
  const [msg, setMsg] = useState<{ text: string; retry?: boolean }>({ text: '' });
  const [last, setLast] = useState<Place | null>(null);
  const area = useRef<HTMLElement>(null);
  const syncing = useRef(false);
  const keyRef = useRef('');
  const stRef = useRef<State | null>(null);
  stRef.current = st;

  const bank = useMemo(() => Object.values(banks).flatMap((b) => b.questions), [banks]);
  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const years = useMemo(() => Object.keys(banks).map(Number).sort((a, b) => b - a), [banks]);

  const persist = (next: State) => {
    stRef.current = next;
    setSt({ ...next });
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(next));
    } catch {
      setMsg({ text: t('Device storage is full. Keep this page open and connect to save your answers.', 'சாதனச் சேமிப்பு நிரம்பியுள்ளது. பக்கத்தைத் திறந்து வைத்து விடைகளைச் சேமிக்க இணைக்கவும்.', 'උපාංගයේ ගබඩාව පිරී ඇත. පිළිතුරු සුරැකීමට මෙම පිටුව විවෘතව තබා සම්බන්ධ වන්න.') });
    }
  };
  const latest = (s: State, q: Question) => {
    const ev = s.events.filter((e) => e.question === q.id);
    return [...ev].reverse().find((e) => hasResponse(e.result)) || ev.at(-1);   // an empty entry must not hide an earlier response
  };
  const status = (s: State, q: Question): Status => {
    const r = latest(s, q)?.result;
    if (!r || !hasResponse(r)) return 'new';
    if (r.type === 'mcq') return r.correct ? 'right' : 'revisit';
    return r.selfCheck === 'understood' ? 'right' : r.selfCheck === 'needs-work' ? 'revisit' : 'tried';
  };
  const mergeEvents = (s: State, rows: Attempt[]) => {
    const m = new Map(s.events.map((e) => [e.id, e]));
    rows.forEach((e) => m.set(e.id, e));
    s.events = [...m.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  };

  async function api(path: string, method = 'GET', data?: unknown) {
    const r = await fetch('/api/past-papers/' + path, { method, headers: H, credentials: 'same-origin', body: data ? JSON.stringify(data) : undefined });
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).detail; } catch { /* no body */ }
      throw Object.assign(new Error(detail || 'Sync failed'), { code: r.status });
    }
    return r.json();
  }

  async function sync() {
    if (syncing.current || !stRef.current) return;
    syncing.current = true;
    try {
      let s = stRef.current;
      while (s.pending.length) {
        const batch: Pending[] = [];
        for (const e of s.pending.slice(0, 50)) {
          if (batch.length && new TextEncoder().encode(JSON.stringify({ events: [...batch, e] })).length > 500000) break;
          batch.push(e);
        }
        const result = await api('attempts', 'POST', { events: batch });
        s = clone(stRef.current!);
        mergeEvents(s, result.attempts);
        const sent = new Set(batch.map((e) => e.id));
        s.pending = s.pending.filter((e) => !sent.has(e.id));
        persist(s);
      }
      for (const q of Object.keys(s.bookmarkPending)) {
        const saved = s.bookmarkPending[q]!;
        await api('bookmark', 'PUT', { question: q, saved });
        s = clone(stRef.current!);
        if (s.bookmarkPending[q] === saved) delete s.bookmarkPending[q];
        persist(s);
      }
      setMsg({ text: '' });
    } catch (e) {
      setMsg({ text: (e as { code?: number }).code === 401
        ? t('Session expired. Sign in again to sync; your answers are kept on this device.', 'அமர்வு காலாவதியானது. ஒத்திசைக்க மீண்டும் உள்நுழைக; உங்கள் விடைகள் இச்சாதனத்தில் உள்ளன.', 'සැසිය කල් ඉකුත් විය. සමමුහුර්ත කිරීමට නැවත පුරනය වන්න; ඔබේ පිළිතුරු මෙම උපාංගයේ ඇත.')
        : t('Saved on this device; it will sync to your account when you are online.', 'இச்சாதனத்தில் சேமிக்கப்பட்டது; இணையத்தில் இருக்கும்போது கணக்குடன் ஒத்திசைக்கும்.', 'මෙම උපාංගයේ සුරැකිණි; ඔබ මාර්ගගත වූ විට ගිණුමට සමමුහුර්ත වේ.'), retry: true });
    } finally {
      syncing.current = false;
    }
  }

  /** XP once for a question answered right for the first time, and a badge when every question of a chapter is right. */
  function rewardRight(s: State, q: Question) {
    void reward('pp:' + q.id, 5);
    for (const key of chaptersOf(q)) {
      const qs = bank.filter((x) => chaptersOf(x).includes(key));
      if (qs.length && qs.every((x) => status(s, x) === 'right')) {
        const badge = 'pastpapers:' + key;
        void record({ id: onceId('badge:' + badge), type: 'badge', badge });
      }
    }
  }

  function enqueue(s: State, e: Pending) {
    const q = byId.get(e.question)!;
    const result: Result = q.type === 'mcq'
      ? { type: 'mcq', choice: e.choice, correct: e.choice === q.correct, correctChoice: q.correct, mode: e.mode }
      : { type: 'written', answers: e.answers, selfCheck: e.selfCheck, mode: e.mode };
    mergeEvents(s, [{ id: e.id, question: e.question, result, at: Date.now() }]);
    s.pending.push(e);
    persist(s);
    if (status(s, q) === 'right') rewardRight(s, q);
    void sync();
  }

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    loadPrefs();
    void startProgress('past-papers');
    try { setLast(JSON.parse(localStorage.getItem(LAST) || 'null')); } catch { /* none */ }
    // a lesson's "past paper questions" link (?lesson=<chapter>) opens that chapter
    const fromLesson = new URLSearchParams(location.search).get('lesson') || '';
    if (fromLesson && !location.hash) history.replaceState(null, '', location.pathname + '#chapter/' + fromLesson);
    const fromUrl = () => { setView(viewFromHash()); };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    (async () => {
      // everything starts at once: who is signed in, all the questions (one request, kept on the device), the saved answers
      const meP = signedIn.then((id) => (id === null ? null : { user: { id } }));   // answered by the progress start (one request for who, XP and progress)
      const data = loadBanks();
      const dataP = data.first;
      dataP.catch(() => { /* reported below */ });
      data.full.catch(() => { /* reported below */ });
      const stateP = meP.then((m) => (m?.user?.id ? api('state') : null));
      stateP.catch(() => { /* reported below */ });
      const me = await meP;
      const uid: number | null = me?.user?.id ?? null;
      setUser(uid);
      if (uid === null) return;
      keyRef.current = 'stem_pp_physics_' + uid;
      let s: State;
      try {
        s = JSON.parse(localStorage.getItem(keyRef.current) || localStorage.getItem('stem_pp_' + uid) || '{}');
      } catch {
        s = {} as State;
      }
      s = Object.assign({ drafts: {}, events: [], pending: [], bookmarks: [], bookmarkPending: {} }, s);
      try {
        const loaded: Bank[] = await dataP;
        const all = Object.fromEntries(loaded.map((b) => [b.year, b])) as Record<number, Bank>;
        const ids = new Map(loaded.flatMap((b) => b.questions).map((q) => [q.id, q]));
        const clean = (qid: string, a?: Record<string, string>) => Object.fromEntries(Object.entries(a || {}).filter(([l]) => ids.get(qid)?.parts?.some((p) => p.label === l)));
        // there is no paper mode any more: a paper someone had started keeps its responses as drafts
        for (const [q, d] of Object.entries(s.exam?.responses || {})) if (ids.has(q) && !s.drafts[q]?.touched) s.drafts[q] = { ...d, touched: true };
        delete s.exam;
        s.drafts = Object.fromEntries(Object.entries(s.drafts).filter(([q]) => ids.has(q)).map(([q, d]) => [q, { ...d, answers: clean(q, d.answers) }]));
        s.events = s.events.filter((e) => ids.has(e.question)).map((e) => ({ ...e, result: { ...e.result, ...(e.result.type === 'written' ? { answers: clean(e.question, e.result.answers) } : {}) } }));
        s.pending = s.pending.filter((e) => ids.has(e.question)).map((e) => {
          if (!e.answers) return e;
          const answers = clean(e.question, e.answers);
          return { ...e, answers, id: JSON.stringify(answers) === JSON.stringify(e.answers) ? e.id : newId() };
        });
        s.bookmarks = s.bookmarks.filter((q) => ids.has(q));
        s.bookmarkPending = Object.fromEntries(Object.entries(s.bookmarkPending).filter(([q]) => ids.has(q)));
        setBanks(all);
        persist(s);
        // the full banks replace the light ones when they arrive (a question opens only with its answers and explanations)
        void data.full.then((fb) => setBanks(Object.fromEntries(fb.map((b) => [b.year, b])) as Record<number, Bank>))
          .catch(() => setMsg({ text: t('The questions could not load. Connect to the internet and reload this page.', 'வினாக்கள் ஏற்றப்படவில்லை. இணையத்துடன் இணைந்து பக்கத்தை மீளேற்றவும்.', 'ප්‍රශ්න පූරණය නොවීය. අන්තර්ජාලයට සම්බන්ධ වී මෙම පිටුව නැවත පූරණය කරන්න.') }));
        try {
          const remote = await stateP;
          if (!remote) throw new Error('state');
          const s2 = clone(stRef.current!);
          mergeEvents(s2, remote.attempts);
          s2.bookmarks = remote.bookmarks;
          Object.entries(s2.bookmarkPending).forEach(([q, v]) => {
            s2.bookmarks = s2.bookmarks.filter((x) => x !== q);
            if (v) s2.bookmarks.push(q);
          });
          persist(s2);
          void sync();
        } catch {
          setMsg({ text: t('Using the answers saved on this device. They will sync when you are online.', 'இச்சாதனத்தில் சேமித்த விடைகள் பயன்படுகின்றன. இணையத்தில் இருக்கும்போது ஒத்திசைக்கும்.', 'මෙම උපාංගයේ සුරැකි පිළිතුරු භාවිත වේ. ඔබ මාර්ගගත වූ විට සමමුහුර්ත වේ.'), retry: true });
        }
      } catch {
        setMsg({ text: t('The questions could not load. Connect to the internet and reload this page.', 'வினாக்கள் ஏற்றப்படவில்லை. இணையத்துடன் இணைந்து பக்கத்தை மீளேற்றவும்.', 'ප්‍රශ්න පූරණය නොවීය. අන්තර්ජාලයට සම්බන්ධ වී මෙම පිටුව නැවත පූරණය කරන්න.') });
      }
    })();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('popstate', fromUrl); };
  }, []);

  const placeKey = (v: View) => (v.kind === 'year' ? 'y' + v.year : v.kind === 'home' ? '' : v.key);
  const go = (v: View, replace = false) => {
    if (hashOf(v) !== (location.hash || '#')) history[replace ? 'replaceState' : 'pushState'](null, '', hashOf(v) === '#' ? location.pathname : hashOf(v));
    if (placeKey(v) !== placeKey(view)) setFilter('');   // another chapter or year starts unfiltered
    setView(v);
    window.scrollTo({ top: 0 });
    if (v.kind === 'chapter' || v.kind === 'year' || v.kind === 'set') {
      const place: Place = v.kind === 'year' ? { kind: 'year', year: v.year } : { kind: 'chapter', key: v.key };
      setLast(place);
      try { localStorage.setItem(LAST, JSON.stringify(place)); } catch { /* not kept */ }
    }
  };
  // OTHER: the few questions no physics chapter teaches (a measuring apparatus, diffusion)
  const inChapter = (key: string) => bank.filter((q) => (key === OTHER ? !chaptersOf(q).length : chaptersOf(q).includes(key))).sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper) || a.number - b.number);
  const inYear = (year: number) => bank.filter((q) => q.year === year).sort((a, b) => a.paper.localeCompare(b.paper) || a.number - b.number);
  // while a question is open it has its own Previous / Next: the page's bottom bar steps aside (past-papers/index.astro)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-ppq', view.kind === 'set' || ((view.kind === 'chapter' || view.kind === 'year') && !!view.q));
  }, [view]);
  // a practice set is made when its view opens: up to 10, to revisit first, then not tried, then answered, then right
  useEffect(() => {
    if (view.kind !== 'set' || !st || !bank.length || (set && set.key === view.key)) return;
    const order: Status[] = ['revisit', 'new', 'tried', 'right'];
    const ids = inChapter(view.key).sort((a, b) => order.indexOf(status(st, a)) - order.indexOf(status(st, b))).slice(0, SET_SIZE).map((q) => q.id);
    setSet({ key: view.key, ids, i: 0, done: false });
  }, [view, st, bank]);

  if (user === null) return <p class="pp-status" role="status">{t('Please sign in to use Past Papers.', 'கடந்த வினாத்தாள்களைப் பயன்படுத்த உள்நுழைக.', 'අතීත ප්‍රශ්න පත්‍ර භාවිතයට පුරනය වන්න.')}</p>;
  if (!st || !bank.length) return <p class="pp-status" role="status">{msg.text || t('Loading the questions…', 'வினாக்கள் ஏற்றப்படுகின்றன…', 'ප්‍රශ්න පූරණය වෙමින්…')}</p>;

  const draft = (x: Question): Draft => {
    const d = st.drafts[x.id] || (st.drafts[x.id] = { answers: {}, choice: null });
    const prev = latest(st, x);
    if (!d.touched && prev) {
      if (x.type === 'mcq') d.choice = prev.result.choice;
      else d.answers = clone(prev.result.answers || {});
    }
    return d;
  };
  const stats = (qs: Question[]) => {
    const n = { total: qs.length, right: 0, revisit: 0, tried: 0 };
    for (const q of qs) {
      const s = status(st, q);
      if (s === 'right') n.right++; else if (s === 'revisit') n.revisit++; else if (s === 'tried') n.tried++;
    }
    return { ...n, done: n.right + n.revisit + n.tried };
  };
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const statusWord = (s: Status) => ({ right: t('Right', 'சரி', 'නිවැරදියි'), revisit: t('To revisit', 'மீண்டும் பார்க்க', 'නැවත බලන්න'), tried: t('Done', 'செய்தது', 'කළා'), new: t('Not done', 'செய்யாதது', 'නොකළ') })[s];
  const doneOf = (s: { done: number; total: number }) => t(`${s.done} of ${s.total} done`, `${s.total} இல் ${s.done} செய்தவை`, `${s.total} න් ${s.done} කළා`);
  const bookmark = (q: Question) => { const s = clone(st); const on = !s.bookmarks.includes(q.id); s.bookmarks = s.bookmarks.filter((x) => x !== q.id); if (on) s.bookmarks.push(q.id); s.bookmarkPending[q.id] = on; persist(s); void sync(); };
  const placeTitle = (p: Place) => {
    if (p.kind === 'year') return t(`${p.year} paper`, `${p.year} வினாத்தாள்`, `${p.year} ප්‍රශ්න පත්‍රය`);
    const c = byKey.get(p.key);
    return c ? chapterName(c) : p.key === OTHER ? t('Other questions', 'பிற வினாக்கள்', 'වෙනත් ප්‍රශ්න') : p.key;
  };
  const listOf = (p: Place) => (p.kind === 'year' ? inYear(p.year) : inChapter(p.key));
  const bar = (n: number) => <span class="pp-bar" aria-hidden="true"><i style={{ width: n + '%' }} /></span>;

  const top = (back?: { label: string; to: View }) => (
    <div class="pp-top">
      {back ? <a class="pp-back" href={hashOf(back.to)} onClick={(e) => { e.preventDefault(); go(back.to); }}>← {back.label}</a> : <span />}
      {msg.text && <p id="pp-status" class="pp-msg" role="status">{msg.text}{msg.retry && <> <button type="button" class="pp-link" onClick={() => void sync()}>{t('Try again', 'மீண்டும் முயற்சி', 'නැවත උත්සාහ කරන්න')}</button></>}</p>}
    </div>
  );

  const questionScreen = (q: Question, opts: { index: number; count: number; onGo: (i: number) => void; inSet?: boolean; focus?: string }) => q.light ? (
    <section id="pp-q" class="pp-qscreen" ref={area} tabIndex={-1} aria-label={qLabel(q)}>
      <p class="pp-status" role="status">{t('Getting your questions ready…', 'உங்கள் வினாக்கள் தயாராகின்றன…', 'ඔබේ ප්‍රශ්න සූදානම් වෙමින්…')}</p>
    </section>
  ) : (
    <section id="pp-q" class="pp-qscreen" ref={area} tabIndex={-1} aria-label={qLabel(q)}>
      <QuestionView key={q.id} q={q} d={draft(q)} prev={latest(st, q)} lang={lang} t={t} tr={tr} qLabel={qLabel} typeWord={typeWord}
                    chapterOf={(k) => byKey.get(k)} chapterName={chapterName}
                    bookmarked={st.bookmarks.includes(q.id)} onBookmark={() => bookmark(q)}
                    onDraft={(d) => { const s = clone(st); s.drafts[q.id] = d; persist(s); }}
                    onCheck={(choice) => enqueue(clone(st), { id: newId(), question: q.id, mode: 'practice', choice })}
                    onSelfCheck={(answers, check) => enqueue(clone(st), { id: newId(), question: q.id, mode: 'practice', answers: clone(answers), selfCheck: check })}
                    {...opts} />
    </section>
  );

  // ---------------------------------------------------------------- views
  let body;
  if (view.kind === 'home') {
    const all = stats(bank);
    const grades = [...new Set(chapters.map((c) => c.grade))].sort();
    const lastStats = last ? stats(listOf(last)) : null;
    const card = (key: string, no: string, title: string) => {
      const qs = inChapter(key), s = stats(qs);
      if (!qs.length) return null;
      return (
        <a class={'pp-chapter' + (s.total && s.right === s.total ? ' is-complete' : '')} data-chapter={key} href={'#chapter/' + key} onClick={(e) => { e.preventDefault(); go({ kind: 'chapter', key }); }}>
          <span class="pp-chapter-no">{no}</span>
          <b>{title}</b>
          {bar(pct(s.done, s.total))}
          <span class="pp-chapter-meta">{doneOf(s)}
            {s.revisit > 0 && <em class="pp-revisit">{t(`${s.revisit} to revisit`, `${s.revisit} மீண்டும் பார்க்க`, `${s.revisit} නැවත බැලීමට`)}</em>}
            {s.total > 0 && s.right === s.total && <em class="pp-done">✓ {t('All right', 'எல்லாம் சரி', 'සියල්ල නිවැරදියි')}</em>}</span>
        </a>
      );
    };
    body = (
      <>
        {top()}
        <header class="pp-hero">
          <h1>{t('Past Papers', 'கடந்த பரீட்சை வினாத்தாள்கள்', 'අතීත ප්‍රශ්න පත්‍ර')}</h1>
          <p>{t('Real O/L Science questions, 2015 to 2023, by chapter. Every answer is explained.', 'உண்மையான சா/த விஞ்ஞான வினாக்கள், 2015–2023, அத்தியாய வாரியாக. ஒவ்வொரு விடையும் விளக்கப்பட்டுள்ளது.', 'සැබෑ සා/පෙළ විද්‍යා ප්‍රශ්න, 2015–2023, පරිච්ඡේද අනුව. සෑම පිළිතුරක්ම පැහැදිලි කර ඇත.')}</p>
          <div class="pp-progress" aria-label={t('Your progress', 'உங்கள் முன்னேற்றம்', 'ඔබේ ප්‍රගතිය')}>{bar(pct(all.done, all.total))}<span>{doneOf(all)}</span></div>
        </header>
        {last && lastStats && lastStats.total > 0 && (
          <a class="pp-continue" href={hashOf(last)} onClick={(e) => { e.preventDefault(); go(last); }}>
            <span class="pp-continue-label">{t('Continue', 'தொடர்க', 'ඉදිරියට')}</span>
            <b>{placeTitle(last)}</b>
            <span class="pp-chapter-meta">{doneOf(lastStats)}</span>
            <span class="pp-continue-go" aria-hidden="true">→</span>
          </a>
        )}
        <a class="pp-formulas" href="/formulas/">
          <span aria-hidden="true">Σ</span>
          <span><b>{t('Formula cards', 'சூத்திர அட்டைகள்', 'සූත්‍ර කාඩ්පත්')}</b>
            <small>{t('Every formula with its units and an example, before you start.', 'தொடங்கும் முன் ஒவ்வொரு சூத்திரமும் அலகுகளுடனும் உதாரணத்துடனும்.', 'ආරම්භ කිරීමට පෙර සෑම සූත්‍රයක්ම ඒකක හා උදාහරණයක් සමඟ.')}</small></span>
        </a>
        {grades.map((g) => (
          <section class="pp-grade" aria-labelledby={'pp-grade-' + g}>
            <h2 id={'pp-grade-' + g}>{t('Grade ' + g, 'தரம் ' + g, g + ' ශ්‍රේණිය')}</h2>
            <div class="pp-cards">{chapters.filter((c) => c.grade === g).map((c) => card(c.key, t('Chapter ' + c.number, 'அத்தியாயம் ' + c.number, 'පරිච්ඡේදය ' + c.number), chapterName(c)))}</div>
          </section>
        ))}
        {inChapter(OTHER).length > 0 && (
          <section class="pp-grade" aria-labelledby="pp-grade-other">
            <h2 id="pp-grade-other">{t('Not in a chapter', 'அத்தியாயத்தில் இல்லாதவை', 'පරිච්ඡේදයක නැති')}</h2>
            <div class="pp-cards">{card(OTHER, t('Measuring, diffusion', 'அளவீடு, பரவல்', 'මිනුම්, විසරණය'), t('Other questions', 'பிற வினாக்கள்', 'වෙනත් ප්‍රශ්න'))}</div>
          </section>
        )}
        <section class="pp-years" aria-labelledby="pp-years-h">
          <h2 id="pp-years-h">{t('Or look at one year', 'அல்லது ஒரு ஆண்டைப் பாருங்கள்', 'නැතහොත් එක් වසරක් බලන්න')}</h2>
          <div class="pp-year-row">{years.map((y) => {
            const s = stats(inYear(y));
            return <a class={'pp-year' + (s.done ? ' is-started' : '')} data-year={y} href={'#year/' + y} onClick={(e) => { e.preventDefault(); go({ kind: 'year', year: y }); }}>{y}</a>;
          })}</div>
        </section>
        <details class="pp-about">
          <summary>{t('About these answers', 'இவ்விடைகள் பற்றி', 'මෙම පිළිතුරු ගැන')}</summary>
          <p>{t('The multiple-choice answers follow the Department of Examinations keys. The written answers and the explanations are model answers written for learning, not an official marking scheme.',
            'தெரிவு விடைகள் பரீட்சைத் திணைக்கள விடைக்குறிப்புகளின்படி. எழுத்து விடைகளும் விளக்கங்களும் கற்றலுக்காக எழுதப்பட்ட மாதிரி விடைகள்; அதிகாரபூர்வ புள்ளித்திட்டம் அல்ல.',
            'බහුවරණ පිළිතුරු විභාග දෙපාර්තමේන්තුවේ පිළිතුරු අනුව ය. ලිඛිත පිළිතුරු හා පැහැදිලි කිරීම් ඉගෙනීම සඳහා ලියූ ආදර්ශ පිළිතුරු ය; නිල ලකුණු දීමේ පටිපාටියක් නොවේ.')}</p>
        </details>
      </>
    );
  } else if (view.kind === 'set') {
    const title = placeTitle({ kind: 'chapter', key: view.key });
    const run = set && set.key === view.key ? set : null;
    const back = { label: title, to: { kind: 'chapter', key: view.key } as View };
    if (!run) {
      body = <>{top(back)}<p class="pp-status">{t('Getting your questions ready…', 'உங்கள் வினாக்கள் தயாராகின்றன…', 'ඔබේ ප්‍රශ්න සූදානම් වෙමින්…')}</p></>;
    } else if (run.done) {
      const rows = run.ids.map((id) => byId.get(id)!).filter(Boolean);
      const r = rows.filter((q) => status(st, q) === 'right').length;
      body = (
        <>
          {top(back)}
          <section class="pp-summary" aria-live="polite">
            <p class="pp-summary-icon" aria-hidden="true">{r === rows.length ? '🏆' : r >= rows.length / 2 ? '🌟' : '💪'}</p>
            <h1>{t('Set finished', 'பயிற்சி முடிந்தது', 'කට්ටලය අවසන්')}</h1>
            <p class="pp-score"><b>{r}</b> / {rows.length} {t('right', 'சரி', 'නිවැරදියි')}</p>
            <ul class="pp-summary-list">{rows.map((q) => {
              const s = status(st, q);
              return <li class={'is-' + s}><span class="pp-dot" aria-hidden="true" /><span>{qLabel(q)}</span><em>{statusWord(s)}</em></li>;
            })}</ul>
            <div class="pp-actions">
              <button type="button" class="btn primary" onClick={() => { setSet(null); go({ kind: 'set', key: view.key }, true); }}>{t('Practise 10 more', 'இன்னும் 10 பயிற்சி', 'තවත් 10ක් පුහුණු වන්න')}</button>
              <button type="button" class="btn" onClick={() => go({ kind: 'chapter', key: view.key })}>{t('Back to the chapter', 'அத்தியாயத்துக்குத் திரும்பு', 'පරිච්ඡේදයට ආපසු')}</button>
            </div>
          </section>
        </>
      );
    } else {
      const q = byId.get(run.ids[run.i]!)!;
      body = (
        <>
          {top(back)}
          <div class="pp-set-head">
            {bar(pct(run.i, run.ids.length))}
            <p>{t(`Question ${run.i + 1} of ${run.ids.length}`, `வினா ${run.i + 1} / ${run.ids.length}`, `ප්‍රශ්නය ${run.i + 1} / ${run.ids.length}`)}</p>
          </div>
          {questionScreen(q, { index: run.i, count: run.ids.length, inSet: true, focus: view.key,
            onGo: (i) => { if (i >= run.ids.length) setSet({ ...run, done: true }); else setSet({ ...run, i: Math.max(0, i) }); window.scrollTo({ top: 0 }); } })}
        </>
      );
    }
  } else {
    const place: Place = view.kind === 'year' ? { kind: 'year', year: view.year } : { kind: 'chapter', key: view.key };
    const qs = listOf(place);
    const title = placeTitle(place);
    const open = view.q ? byId.get(view.q) : undefined;
    if (open && qs.includes(open)) {
      // one question, on its own screen, within its list
      const shown = qs.filter((x) => keep(x));
      const list = shown.includes(open) ? shown : qs;
      const i = list.indexOf(open);
      body = (
        <>
          {top({ label: title, to: place })}
          {questionScreen(open, { index: i, count: list.length, focus: place.kind === 'chapter' ? place.key : undefined,
            onGo: (n) => { const nx = list[n]; if (nx) go({ ...place, q: nx.id }, true); } })}
        </>
      );
    } else {
      const c = place.kind === 'chapter' ? byKey.get(place.key) : undefined;
      const s = stats(qs);
      const shown = qs.filter((x) => keep(x));
      const saved = qs.filter((x) => st.bookmarks.includes(x.id)).length;
      const filters: [Filter, string, number][] = [['', t('All', 'எல்லாம்', 'සියල්ල'), qs.length], ['new', t('Not done', 'செய்யாதவை', 'නොකළ'), s.total - s.done],
        ['revisit', t('To revisit', 'மீண்டும் பார்க்க', 'නැවත බලන්න'), s.revisit], ['saved', t('Saved', 'சேமித்தவை', 'සුරැකි'), saved]];
      body = (
        <>
          {top({ label: t('Past Papers', 'கடந்த வினாத்தாள்கள்', 'අතීත ප්‍රශ්න පත්‍ර'), to: { kind: 'home' } })}
          <header class="pp-chapter-head">
            {c && <span class="pp-chapter-no">{t(`Grade ${c.grade} · Chapter ${c.number}`, `தரம் ${c.grade} · அத்தியாயம் ${c.number}`, `${c.grade} ශ්‍රේණිය · පරිච්ඡේදය ${c.number}`)}</span>}
            <h1>{title}</h1>
            <div class="pp-progress">{bar(pct(s.done, s.total))}<span>{doneOf(s)}{s.right > 0 ? ' · ' + t(`${s.right} right`, `${s.right} சரி`, `${s.right} නිවැරදියි`) : ''}</span></div>
            <div class="pp-actions">
              {place.kind === 'chapter' && <button type="button" class="btn primary pp-start" onClick={() => { setSet(null); go({ kind: 'set', key: place.key }); }}>
                ▶ {t(`Practise ${Math.min(SET_SIZE, qs.length)}`, `${Math.min(SET_SIZE, qs.length)} பயிற்சி`, `${Math.min(SET_SIZE, qs.length)}ක් පුහුණුව`)}</button>}
              {c && <a class="btn" href={c.url}>📘 {t('Lesson', 'பாடம்', 'පාඩම')}</a>}
            </div>
          </header>
          <div class="pp-filters" role="group" aria-label={t('Show', 'காட்டு', 'පෙන්වන්න')}>
            {filters.filter(([k, , n]) => !k || n > 0 || filter === k).map(([k, label, n]) => (
              <button type="button" class="pp-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <span class="pp-count">{n}</span></button>
            ))}
          </div>
          {shown.length ? (
            <ol id="pp-list" class="pp-qlist">
              {shown.map((x) => {
                const sx = status(st, x);
                return (
                  <li><a class={'pp-qitem is-' + sx} data-q={x.id} href={hashOf({ ...place, q: x.id })} onClick={(e) => { e.preventDefault(); go({ ...place, q: x.id }); }}>
                    <span class="pp-dot" aria-hidden="true" />
                    <span class="pp-qitem-main">
                      <span class="pp-qitem-meta">{qLabel(x)} · {typeWord(x)}{st.bookmarks.includes(x.id) ? ' · ★' : ''}</span>
                      <span class="pp-qitem-text">{tr(x.type === 'written' && x.parts?.length
                        ? (x.parts.find((pt) => place.kind === 'chapter' && (pt.lessons || []).includes(place.key)) || x.parts[0]!).prompt : x.prompt)}</span>
                    </span>
                    <span class="pp-qitem-status">{statusWord(sx)}</span>
                  </a></li>
                );
              })}
            </ol>
          ) : <p class="pp-empty">{t('Nothing here yet.', 'இங்கு இன்னும் எதுவுமில்லை.', 'මෙහි තවම කිසිවක් නැත.')}</p>}
        </>
      );
    }
  }

  function keep(x: Question) {
    const s = status(st!, x);
    return !filter || (filter === 'new' && s === 'new') || (filter === 'revisit' && s === 'revisit') || (filter === 'saved' && st!.bookmarks.includes(x.id));
  }

  return <div class="pp-app">{body}</div>;
}

interface ViewProps {
  q: Question; d: Draft; prev?: Attempt; lang: Lang; bookmarked: boolean; index: number; count: number; inSet?: boolean;
  /** The chapter the student came from: a written question shows its parts on that chapter first. */
  focus?: string;
  chapterOf: (key: string) => Chapter | undefined; chapterName: (c: Chapter) => string;
  t: (en: string, ta: string, si?: string) => string; tr: (o: Tx) => string; qLabel: (q: Question) => string; typeWord: (q: Question) => string;
  onBookmark: () => void; onDraft: (d: Draft) => void; onCheck: (choice: number) => void;
  onSelfCheck: (answers: Record<string, string>, check: string) => void; onGo: (i: number) => void;
}

function QuestionView(p: ViewProps) {
  const { q, t, tr, lang } = p;
  const [d, setD] = useState<Draft>(() => clone(p.d));
  const [hint, setHint] = useState(false);
  const [again, setAgain] = useState(false);          // "try again": hide the last answer's marks until the next check
  const [others, setOthers] = useState(false);        // the reasons for the options that were neither chosen nor right
  const [shownParts, setShownParts] = useState<Record<string, boolean>>({});
  const reveal = q.type === 'mcq' && !again && !!p.prev && hasResponse(p.prev.result);
  const right = reveal && !!p.prev!.result.correct;
  const update = (next: Draft) => {
    const n = { ...next, touched: true };
    setD(n);
    p.onDraft(n);
  };

  /** The full explanation: the idea, step by step, why it works, the common mistake. Repeats are left out. */
  const explain = (item: { detailedExplanation?: Teaching; steps?: Tx[] }, seenFirst: string[], open: boolean) => {
    const dx = item.detailedExplanation;
    const seen = new Set(seenFirst.map((x) => x.replace(/\s+/g, ' ').trim().toLowerCase()));
    const fresh = (x: string) => { const k = x.replace(/\s+/g, ' ').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; };
    const idea = dx && fresh(tr(dx.concept)) ? tr(dx.concept) : '';
    const steps = (item.steps || []).map((x) => tr(x)).filter((x) => fresh(x));
    const why = dx && fresh(tr(dx.reasoning)) ? tr(dx.reasoning) : '';
    const mistake = dx && fresh(tr(dx.commonMistake)) ? tr(dx.commonMistake) : '';
    if (!idea && !steps.length && !why && !mistake) return null;
    return (
      <details class="pp-more" open={open}>
        <summary>{t('Explain it step by step', 'படிப்படியாக விளக்கு', 'පියවරෙන් පියවර පැහැදිලි කරන්න')}</summary>
        <div class="pp-explain">
          {idea && <div class="pp-x pp-x-idea"><h4>{t('The idea', 'கருத்து', 'අදහස')}</h4><p>{idea}</p></div>}
          {steps.length > 0 && <div class="pp-x pp-x-steps"><h4>{t('Step by step', 'படிப்படியாக', 'පියවරෙන් පියවර')}</h4><ol>{steps.map((x) => <li>{x}</li>)}</ol></div>}
          {why && <div class="pp-x pp-x-why"><h4>{t('Why it works', 'இது ஏன் சரி', 'එය හරි ඇයි')}</h4><p>{why}</p></div>}
          {mistake && <div class="pp-x pp-x-mistake"><h4>{t('Watch out', 'கவனம்', 'පරෙස්සමින්')}</h4><p>{mistake}</p></div>}
        </div>
      </details>
    );
  };
  /** After the answer: a question like it, the lesson, the textbook. */
  const extras = (item: { detailedExplanation?: Teaching; references?: Ref[]; lessons?: string[] }) => {
    const pr = item.detailedExplanation?.practice;
    const lessons = (item.lessons || []).map((k) => p.chapterOf(k)).filter((c): c is Chapter => !!c);
    const books = (item.references || []).filter((r) => r.kind === 'textbook').sort((a, b) => (a.language === lang ? 0 : 1) - (b.language === lang ? 0 : 1));
    const range = (r: Ref) => (r.printedPages![0] === r.printedPages![1] ? String(r.printedPages![0]) : r.printedPages!.join('–'));
    return (
      <div class="pp-extras">
        {pr && tr(pr.question) && <details class="pp-try"><summary>✏️ {t('Try one like it', 'இதே போன்ற ஒன்றை முயற்சி செய்', 'මෙවැනි එකක් උත්සාහ කරන්න')}</summary>
          <p>{tr(pr.question)}</p>
          <details><summary>{t('Show the answer', 'விடையைக் காட்டு', 'පිළිතුර පෙන්වන්න')}</summary><p>{tr(pr.answer)}</p></details></details>}
        {lessons.map((c) => <a class="pp-learn" href={c.url}>📘 {t('Learn it', 'கற்றுக்கொள்', 'ඉගෙන ගන්න')}: {p.chapterName(c)}</a>)}
        {books.length > 0 && <details class="pp-books"><summary>📖 {t('Textbook pages', 'பாடநூல் பக்கங்கள்', 'පෙළපොත් පිටු')}</summary>
          <ul>{books.map((r) => (
            <li><a href={r.url} target="_blank" rel="noopener">{tr(r.title) + ' · ' + (r.language === 'ta' ? t('Tamil', 'தமிழ்', 'දෙමළ') : t('English', 'ஆங்கிலம்', 'ඉංග්‍රීසි')) + ' · ' + t('p. ', 'ப. ', 'පි. ') + range(r)} ↗</a></li>))}</ul></details>}
      </div>
    );
  };
  const scan = q.pages.length > 0 && (
    <details class="pp-scan">
      <summary>{t('See the original paper', 'மூல வினாத்தாளைப் பார்', 'මුල් ප්‍රශ්න පත්‍රය බලන්න')}</summary>
      <p class="pp-muted">{t('The original Science paper (Tamil); it may include other subjects.', 'மூல விஞ்ஞான வினாத்தாள் (தமிழ்); பிற பாடங்களும் இருக்கலாம்.', 'මුල් විද්‍යා ප්‍රශ්න පත්‍රය (දෙමළ); වෙනත් විෂයයන් ද තිබිය හැක.')}</p>
      {q.pages.map((n) => {
        const url = '/lessons/past-papers/' + q.year + '/page-' + String(n).padStart(2, '0') + '.jpg';
        return <a href={url} target="_blank" rel="noopener"><img src={url} loading="lazy" alt={t('Original paper, page ' + n, 'மூலத்தாள், பக்கம் ' + n, 'මුල් පත්‍රය, පිටුව ' + n)} /></a>;
      })}
    </details>
  );
  const done = reveal || (q.type === 'written' && !!p.prev && hasResponse(p.prev.result));
  const nav = (
    <nav class="pp-nav" aria-label={t('Questions', 'வினாக்கள்', 'ප්‍රශ්න')}>
      {p.inSet ? <span /> : <button type="button" class="btn" disabled={p.index === 0} onClick={() => p.onGo(p.index - 1)} aria-label={t('Previous question', 'முந்தைய வினா', 'පෙර ප්‍රශ්නය')}>←</button>}
      <span class="pp-nav-count">{p.index + 1} / {p.count}</span>
      <button type="button" class={'btn' + (done ? ' primary' : '')} disabled={!p.inSet && p.index === p.count - 1} onClick={() => p.onGo(p.index + 1)}>
        {p.inSet && p.index === p.count - 1 ? t('Finish', 'முடி', 'අවසන් කරන්න') : done ? t('Next', 'அடுத்தது', 'ඊළඟ') : t('Skip', 'தவிர்', 'මඟ හරින්න')} →</button>
    </nav>
  );

  const chosen = reveal ? p.prev!.result.choice : null;
  const whyShown = (i: number) => reveal && (i === q.correct || i === chosen || others);
  const checkedSelf = q.type === 'written' && p.prev ? p.prev.result.selfCheck : null;
  const anyShown = Object.values(shownParts).some(Boolean);
  // a written question opened from a chapter shows that chapter's parts; the others are folded away
  const mine = (q.parts || []).filter((x) => !p.focus || (x.lessons || []).includes(p.focus));
  const parts = mine.length ? mine : q.parts || [];
  const rest = (q.parts || []).filter((x) => !parts.includes(x));
  const partView = (part: Part) => {
    const i = q.parts!.indexOf(part);
    const shown = !!shownParts[part.label];
    return (
      <section class="pp-part">
        <h3>{part.label}</h3>
        <p class="pp-prompt">{tr(part.prompt)}</p>
        <label for={`pp-answer-${i}`} class="pp-sr">{t('Your answer', 'உங்கள் விடை', 'ඔබේ පිළිතුර')}</label>
        <textarea id={`pp-answer-${i}`} data-part={part.label} maxLength={2000} rows={3} value={d.answers[part.label] || ''}
                  placeholder={t('Write your answer here (optional)', 'உங்கள் விடையை இங்கே எழுதுக (விரும்பினால்)', 'ඔබේ පිළිතුර මෙහි ලියන්න (අවශ්‍ය නම්)')}
                  onInput={(e) => update({ ...d, answers: { ...d.answers, [part.label]: (e.target as HTMLTextAreaElement).value } })} />
        {!shown ? (
          <div class="pp-actions">
            <button type="button" class="btn pp-show" onClick={() => setShownParts({ ...shownParts, [part.label]: true })}>{t('Show the model answer', 'மாதிரி விடையைக் காட்டு', 'ආදර්ශ පිළිතුර පෙන්වන්න')}</button>
            {tr(part.hint) && <details class="pp-hint-box"><summary>💡 {t('Need a hint?', 'குறிப்பு வேண்டுமா?', 'ඉඟියක් අවශ්‍යද?')}</summary><p>{tr(part.hint)}</p></details>}
          </div>
        ) : (
          <div class="pp-model">
            <h4>{t('Model answer', 'மாதிரி விடை', 'ආදර්ශ පිළිතුර')}</h4>
            <p>{tr(part.answer)}</p>
            {q.year === 2015 && DIAGRAMS[q.number + '|' + part.label] && <div class="pp-diagram" dangerouslySetInnerHTML={{ __html: DIAGRAMS[q.number + '|' + part.label]! }} />}
            {explain(part, [tr(part.answer)], false)}
            {extras(part)}
          </div>
        )}
      </section>
    );
  };
  return (
    <article class="pp-q">
      <div class="pp-qhead">
        <span class="pp-qmeta">{p.qLabel(q)} · {p.typeWord(q)}{q.marks ? ' · ' + q.marks + ' ' + t('marks', 'புள்ளிகள்', 'ලකුණු') : ''}</span>
        <button type="button" class="pp-bookmark" aria-pressed={p.bookmarked} onClick={p.onBookmark}
                aria-label={p.bookmarked ? t('Saved. Tap to remove', 'சேமிக்கப்பட்டது. நீக்கத் தட்டவும்', 'සුරැකිණි. ඉවත් කිරීමට තට්ටු කරන්න') : t('Save this question', 'இவ்வினாவைச் சேமி', 'මෙම ප්‍රශ්නය සුරකින්න')}>{p.bookmarked ? '★' : '☆'}</button>
      </div>
      {/* most written questions open with the same "answer only the physics parts below" note: the parts say enough */}
      {!(q.type === 'written' && /^Answer only the physics subparts/.test(q.prompt?.en || '')) && <p class="pp-prompt">{tr(q.prompt)}</p>}
      {q.figure && <figure><a href={q.figure} target="_blank" rel="noopener"><img src={q.figure} alt={t('Diagram for question ' + q.number, 'வினா ' + q.number + ' இன் படம்', 'ප්‍රශ්නය ' + q.number + ' සඳහා රූපය')} /></a>
        <figcaption>{t('From the original paper; the option numbers follow it.', 'மூலத்தாளிலிருந்து; தெரிவு எண்கள் அதன்படி.', 'මුල් පත්‍රයෙන්; විකල්ප අංක එය අනුගමනය කරයි.')}</figcaption></figure>}
      {q.sourceDescription && <p class="pp-muted">{tr(q.sourceDescription)}</p>}
      {q.type === 'mcq' ? (
        <>
          <fieldset class="pp-options" disabled={reveal}>
            <legend class="pp-sr">{t('Choose one answer', 'ஒரு விடையைத் தேர்க', 'එක් පිළිතුරක් තෝරන්න')}</legend>
            {q.options!.map((o, i) => {
              const mark = reveal ? (i === q.correct ? 'is-right' : i === chosen ? 'is-wrong' : 'is-other') : '';
              return (
                <label class={'pp-opt ' + mark + (!reveal && d.choice === i ? ' is-chosen' : '')}>
                  <input type="radio" name="pp-choice" value={i} checked={d.choice === i} onChange={() => update({ ...d, choice: i })} />
                  <span class="pp-opt-no" aria-hidden="true">{reveal && i === q.correct ? '✓' : reveal && i === chosen ? '✗' : i + 1}</span>
                  <span class="pp-opt-text">{tr(o)}{whyShown(i) && q.optionExplanations?.[i] && <small class="pp-opt-why">{tr(q.optionExplanations[i])}</small>}</span>
                </label>
              );
            })}
          </fieldset>
          {!reveal ? (
            <>
              <div class="pp-actions">
                <button type="button" class="btn primary pp-check" disabled={!Number.isInteger(d.choice)} onClick={() => { p.onCheck(d.choice!); setAgain(false); setOthers(false); setD({ ...d, touched: false }); }}>
                  {t('Check my answer', 'என் விடையைச் சரிபார்', 'මගේ පිළිතුර පරීක්ෂා කරන්න')}</button>
                {tr(q.hint) && <button type="button" class="pp-link" aria-expanded={hint} onClick={() => setHint(!hint)}>💡 {hint ? t('Hide the hint', 'குறிப்பை மறை', 'ඉඟිය සඟවන්න') : t('Need a hint?', 'குறிப்பு வேண்டுமா?', 'ඉඟියක් අවශ්‍යද?')}</button>}
              </div>
              {hint && <p class="pp-hint">{tr(q.hint)}</p>}
            </>
          ) : (
            <section class="pp-feedback" aria-live="polite">
              <div class={'pp-verdict ' + (right ? 'is-right' : 'is-wrong')}>
                <b>{right ? '🎉 ' + t('Right!', 'சரி!', 'නිවැරදියි!') : t(`Not quite. The answer is ${q.correct! + 1}.`, `சரியில்லை. விடை ${q.correct! + 1}.`, `එතරම් නොවේ. පිළිතුර ${q.correct! + 1} යි.`)}</b>
                {tr(q.explanation) && <p>{tr(q.explanation)}</p>}
              </div>
              {q.editorialWarning && <p class="pp-notice">{tr(q.editorialWarning)}</p>}
              <div class="pp-actions">
                {!right && <button type="button" class="btn" onClick={() => { setAgain(true); update({ ...d, choice: null }); }}>↻ {t('Try again', 'மீண்டும் முயற்சி', 'නැවත උත්සාහ කරන්න')}</button>}
                {(q.optionExplanations || []).length > 2 && <button type="button" class="pp-link" aria-expanded={others} onClick={() => setOthers(!others)}>
                  {others ? t('Hide the other options', 'மற்ற தெரிவுகளை மறை', 'අනෙක් විකල්ප සඟවන්න') : t('Why not the others?', 'மற்றவை ஏன் இல்லை?', 'අනෙක්වා ඇයි නොවේ?')}</button>}
              </div>
              {explain(q, [tr(q.explanation)], !right)}
              {extras(q)}
            </section>
          )}
        </>
      ) : (
        <>
          {parts.map(partView)}
          {rest.length > 0 && (
            <details class="pp-rest">
              <summary>{t(`Other parts of this question (${rest.length})`, `இவ்வினாவின் பிற பகுதிகள் (${rest.length})`, `මෙම ප්‍රශ්නයේ අනෙක් කොටස් (${rest.length})`)}</summary>
              {rest.map(partView)}
            </details>
          )}
          {(anyShown || checkedSelf) && (
            <div class="pp-selfcheck">
              <p>{t('Compare with the model answer. How did you do?', 'மாதிரி விடையுடன் ஒப்பிடுக. எப்படிச் செய்தீர்கள்?', 'ආදර්ශ පිළිතුර සමඟ සසඳන්න. ඔබ කෙසේ කළාද?')}</p>
              <div class="pp-actions">
                <button type="button" class="btn" aria-pressed={checkedSelf === 'understood'} onClick={() => p.onSelfCheck(d.answers, 'understood')}>✓ {t('I got it', 'புரிந்தது', 'මට තේරුණා')}</button>
                <button type="button" class="btn" aria-pressed={checkedSelf === 'needs-work'} onClick={() => p.onSelfCheck(d.answers, 'needs-work')}>↻ {t('I need more practice', 'மேலும் பயிற்சி தேவை', 'මට තව පුහුණුව අවශ්‍යයි')}</button>
              </div>
            </div>
          )}
        </>
      )}
      {scan}
      {nav}
    </article>
  );
}
