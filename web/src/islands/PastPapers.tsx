import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs, setLang } from '../stores/prefs';
import { onceId, record, reward, start as startProgress } from '../stores/progress';

/*
 * Past papers: the O/L Science papers' physics questions (content/past-papers/physics/), organised by the lesson
 * chapters they test, and by year for full-paper practice.
 *  - Chapters (the home): each chapter's questions from every year, with the student's progress on them; a chapter
 *    opens its question list, and "Practise this chapter" makes a set of up to 10 (to revisit first, then new ones).
 *  - Years: a year's paper as before, with paper practice (no time limit).
 *  - A question: choose, check, and every option shows whether and why it is right; then the explanation in parts
 *    (the answer, the idea, step by step, the common mistake, a similar question, where to learn it).
 * Drafts stay on this device; attempts and bookmarks sync to the account through the existing API (/api/past-papers/*),
 * under the same device key as before (stem_pp_physics_<user id>). A question answered right for the first time is
 * worth 5 XP, once, and every question of a chapter right earns a badge (progress v2).
 * The questions are English and Tamil; Sinhala shows where it has been translated, English otherwise.
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
}
interface Bank { year: number; scope: string; questions: Question[]; editorialNote?: Tx; coverageNote?: Tx; keySource?: string; sourcePdf?: string; papers: { id: string; instructions: Tx }[] }
interface Result { type: 'mcq' | 'written'; choice?: number | null; correct?: boolean; correctChoice?: number; answers?: Record<string, string>; selfCheck?: string | null; mode?: string }
interface Attempt { id: string; question: string; result: Result; at: number }
interface Draft { answers: Record<string, string>; choice?: number | null; touched?: boolean }
interface Exam { scope: string; year: number; paper: string; responses: Record<string, Draft>; selected: string[]; submitted?: boolean; score?: number | null; result?: string; finishing?: boolean }
interface Pending { id: string; question: string; mode: string; choice?: number | null; answers?: Record<string, string>; selfCheck?: string | null }
interface State { drafts: Record<string, Draft>; events: Attempt[]; pending: Pending[]; bookmarks: string[]; bookmarkPending: Record<string, boolean>; exam: Exam | null; year?: number }
/** A lesson chapter (content/catalog.json): its page file stem (the questions' "lessons"), grade, number, title, new page. */
export interface Chapter { key: string; grade: number; number: string; title: { en: string; ta?: string; si?: string }; url: string }
type Status = 'right' | 'revisit' | 'tried' | 'new';
type View = { kind: 'home'; tab: 'chapters' | 'years' } | { kind: 'chapter'; key: string } | { kind: 'year'; year: number } | { kind: 'set'; key: string };

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + '_' + Math.random().toString(36).slice(2));
const hasResponse = (r?: Result) => !!r && (r.type === 'mcq' ? Number.isInteger(r.choice) : Object.values(r.answers || {}).some((s) => s.trim()));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const chaptersOf = (q: Question) => [...new Set([...(q.lessons || []), ...(q.parts || []).flatMap((p) => p.lessons || [])])];
const SET_SIZE = 10;
const OTHER = 'other';

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
  if ((m = h.match(/^chapter\/([a-z0-9-]+)$/))) return { kind: 'chapter', key: m[1]! };
  if ((m = h.match(/^practise\/([a-z0-9-]+)$/))) return { kind: 'set', key: m[1]! };
  if ((m = h.match(/^year\/(\d{4})$/))) return { kind: 'year', year: Number(m[1]) };
  if (h === 'years') return { kind: 'home', tab: 'years' };
  return { kind: 'home', tab: 'chapters' };
}
function hashOf(v: View): string {
  return v.kind === 'chapter' ? '#chapter/' + v.key : v.kind === 'set' ? '#practise/' + v.key : v.kind === 'year' ? '#year/' + v.year : v.tab === 'years' ? '#years' : '#chapters';
}

export default function PastPapers({ chapters = [] }: { chapters?: Chapter[] }) {
  const pageLang = useStore($lang);
  const lang: Lang = pageLang === 'ta' ? 'ta' : pageLang === 'si' ? 'si' : 'en';
  /** Interface words in the three languages. */
  const t = (en: string, ta: string, si?: string) => (lang === 'ta' ? ta : lang === 'si' ? si || en : en);
  const tr = (o: Tx) => (o && (o[lang] || o.en)) || '';
  const qLabel = (q: Question) => t(`${q.year} · Paper ${q.paper} · Q${q.number}`, `${q.year} · தாள் ${q.paper} · வினா ${q.number}`, `${q.year} · ${q.paper} පත්‍රය · ප්‍රශ්න ${q.number}`);
  const chapterName = (c: Chapter) => (c.title[lang] || c.title.en);
  const byKey = useMemo(() => new Map(chapters.map((c) => [c.key, c])), [chapters]);

  const [user, setUser] = useState<number | null | undefined>(undefined);
  const [banks, setBanks] = useState<Record<number, Bank>>({});
  const [catalog, setCatalog] = useState<{ papers: { year: number; examLabel: string; bank: string; scope: string }[] } | null>(null);
  const [st, setSt] = useState<State | null>(null);
  const [view, setView] = useState<View>({ kind: 'home', tab: 'chapters' });
  const [current, setCurrent] = useState<string | undefined>();
  const [chip, setChip] = useState<'' | 'mcq' | 'written' | 'new' | 'revisit' | 'saved'>('');
  const [yearChip, setYearChip] = useState(0);
  const [set, setSet] = useState<{ key: string; ids: string[]; i: number; done: boolean } | null>(null);
  const [msg, setMsg] = useState<{ text: string; retry?: boolean }>({ text: '' });
  const [dialog, setDialog] = useState<{ title: string; text: string; done: (ok: boolean) => void } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLElement>(null);
  const syncing = useRef(false);
  const keyRef = useRef('');
  const stRef = useRef<State | null>(null);
  stRef.current = st;

  const bank = useMemo(() => Object.values(banks).flatMap((b) => b.questions), [banks]);
  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const active = !!st?.exam && !st.exam.submitted;

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
    return [...ev].reverse().find((e) => hasResponse(e.result)) || ev.at(-1);   // an unanswered exam entry must not hide an earlier written response
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
        ? t('Session expired. Sign in again to sync; drafts remain on this device.', 'அமர்வு காலாவதியானது. ஒத்திசைக்க மீண்டும் உள்நுழைக; வரைவு சாதனத்தில் உள்ளது.', 'සැසිය කල් ඉකුත් විය. සමමුහුර්ත කිරීමට නැවත පුරනය වන්න; කෙටුම්පත් මෙම උපාංගයේ ඇත.')
        : t('Saved on this device; account sync is pending.', 'இச்சாதனத்தில் சேமிக்கப்பட்டது; கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.', 'මෙම උපාංගයේ සුරැකිණි; ගිණුමට සමමුහුර්ත කිරීම පොරොත්තුවෙන්.'), retry: true });
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

  function enqueue(s: State, events: Pending[]) {
    events.forEach((e) => {
      const q = byId.get(e.question)!;
      const result: Result = q.type === 'mcq'
        ? { type: 'mcq', choice: e.choice, correct: e.choice === q.correct, correctChoice: q.correct, mode: e.mode }
        : { type: 'written', answers: e.answers, selfCheck: e.selfCheck, mode: e.mode };
      mergeEvents(s, [{ id: e.id, question: e.question, result, at: Date.now() }]);
    });
    s.pending.push(...events);
    persist(s);
    for (const e of events) {
      const q = byId.get(e.question)!;
      if (e.mode === 'practice' && status(s, q) === 'right') rewardRight(s, q);
    }
    void sync();
  }

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    loadPrefs();
    void startProgress('past-papers');
    // a lesson's "past paper questions" link (?lesson=<chapter>) opens that chapter
    const fromLesson = new URLSearchParams(location.search).get('lesson') || '';
    if (fromLesson && !location.hash) history.replaceState(null, '', location.pathname + '#chapter/' + fromLesson);
    const fromUrl = () => { setView(viewFromHash()); setCurrent(undefined); setChip(''); setYearChip(0); };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    (async () => {
      const me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
      s = Object.assign({ drafts: {}, events: [], pending: [], bookmarks: [], bookmarkPending: {}, exam: null }, s);
      if (s.exam) delete s.exam.finishing;                 // a reload must not keep an in-memory submission lock
      try {
        const r = await fetch('/lessons/past-papers/catalog.json', { credentials: 'same-origin' });
        if (!r.ok || r.redirected) throw new Error('catalog');
        const cat = await r.json();
        const entries = cat.papers.filter((p: { bank?: string; scope?: string }) => p.bank && p.scope === 'physics');
        const loaded: Bank[] = await Promise.all(entries.map(async (p: { bank: string }) => {
          const b = await fetch(p.bank, { credentials: 'same-origin' });
          if (!b.ok || b.redirected) throw new Error('bank');
          const bk: Bank = await b.json();
          if (bk.scope !== 'physics') throw new Error('scope');
          bk.questions.forEach((q) => (q.year = bk.year));
          return bk;
        }));
        const all = Object.fromEntries(loaded.map((b) => [b.year, b])) as Record<number, Bank>;
        const ids = new Map(loaded.flatMap((b) => b.questions).map((q) => [q.id, q]));
        const clean = (qid: string, a?: Record<string, string>) => Object.fromEntries(Object.entries(a || {}).filter(([l]) => ids.get(qid)?.parts?.some((p) => p.label === l)));
        s.drafts = Object.fromEntries(Object.entries(s.drafts).filter(([q]) => ids.has(q)).map(([q, d]) => [q, { ...d, answers: clean(q, d.answers) }]));
        s.events = s.events.filter((e) => ids.has(e.question)).map((e) => ({ ...e, result: { ...e.result, ...(e.result.type === 'written' ? { answers: clean(e.question, e.result.answers) } : {}) } }));
        s.pending = s.pending.filter((e) => ids.has(e.question)).map((e) => {
          if (!e.answers) return e;
          const answers = clean(e.question, e.answers);
          return { ...e, answers, id: JSON.stringify(answers) === JSON.stringify(e.answers) ? e.id : newId() };
        });
        s.bookmarks = s.bookmarks.filter((q) => ids.has(q));
        s.bookmarkPending = Object.fromEntries(Object.entries(s.bookmarkPending).filter(([q]) => ids.has(q)));
        if (s.exam && s.exam.scope !== 'physics') {
          for (const [q, d] of Object.entries(s.exam.responses || {})) if (ids.has(q)) s.drafts[q] = { ...d, answers: clean(q, d.answers) };
          s.exam = null;
        }
        if (s.exam) s.exam.year = s.exam.year || 2015;
        // an unfinished paper practice continues where it was
        if (s.exam && !s.exam.submitted && all[s.exam.year]) { setView({ kind: 'year', year: s.exam.year }); history.replaceState(null, '', '#year/' + s.exam.year); }
        setCatalog(cat);
        setBanks(all);
        persist(s);
        try {
          const remote = await api('state');
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
          setMsg({ text: t('Using saved device data. Account sync is pending.', 'சாதனத் தரவு பயன்படுகிறது. கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.', 'උපාංගයේ සුරැකි දත්ත භාවිත වේ. ගිණුමට සමමුහුර්ත කිරීම පොරොත්තුවෙන්.'), retry: true });
        }
      } catch {
        setMsg({ text: t('Question bank could not load. Connect and reload this page.', 'வினா வங்கி ஏற்றப்படவில்லை. இணைப்பைப் பெற்று மீளேற்றவும்.', 'ප්‍රශ්න බැංකුව පූරණය නොවීය. සම්බන්ධ වී මෙම පිටුව නැවත පූරණය කරන්න.') });
      }
    })();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('popstate', fromUrl); };
  }, []);

  const go = (v: View) => {
    if (hashOf(v) !== location.hash) history.pushState(null, '', hashOf(v));
    setView(v);
    setCurrent(undefined);
    setChip('');
    setYearChip(0);
    window.scrollTo({ top: 0 });
  };
  // OTHER: the few questions no chapter teaches (a measuring apparatus, diffusion, the gas laws)
  const inChapter = (key: string) => bank.filter((q) => (key === OTHER ? !chaptersOf(q).length : chaptersOf(q).includes(key))).sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper) || a.number - b.number);
  // a practice set is made when its view opens: up to 10, to revisit first, then not tried, then answered, then right
  useEffect(() => {
    if (view.kind !== 'set' || !st || !bank.length || (set && set.key === view.key)) return;
    const order: Status[] = ['revisit', 'new', 'tried', 'right'];
    const ids = inChapter(view.key).sort((a, b) => order.indexOf(status(st, a)) - order.indexOf(status(st, b))).slice(0, SET_SIZE).map((q) => q.id);
    setSet({ key: view.key, ids, i: 0, done: false });
  }, [view, st, bank]);
  const confirm = (title: string, text: string) => new Promise<boolean>((resolve) => setDialog({ title, text, done: resolve }));
  useEffect(() => {
    if (dialog && dlg.current && !dlg.current.open) dlg.current.showModal();
  }, [dialog]);

  // ---------------------------------------------------------------- the questions on show
  const listed = useMemo(() => {
    if (!st) return [] as Question[];
    let qs: Question[] = view.kind === 'chapter' ? inChapter(view.key) : view.kind === 'year' ? bank.filter((q) => q.year === view.year) : [];
    if (view.kind === 'year' && active) qs = qs.filter((q) => q.paper === st.exam!.paper);
    else if (view.kind !== 'home') {
      qs = qs.filter((q) => (!chip || (chip === 'mcq' && q.type === 'mcq') || (chip === 'written' && q.type === 'written') || (chip === 'new' && status(st, q) === 'new')
        || (chip === 'revisit' && status(st, q) === 'revisit') || (chip === 'saved' && st.bookmarks.includes(q.id))) && (!yearChip || q.year === yearChip));
    }
    return qs;
  }, [st, bank, view, chip, yearChip, active]);

  if (user === null) return <p class="pp-status" role="status">{t('Please sign in to use Past Papers.', 'கடந்த வினாத்தாள்களைப் பயன்படுத்த உள்நுழைக.', 'අතීත ප්‍රශ්න පත්‍ර භාවිතයට පුරනය වන්න.')}</p>;
  if (!st || !catalog || !bank.length) return <p class="pp-status" role="status">{msg.text || t('Loading question bank…', 'வினா வங்கி ஏற்றப்படுகிறது…', 'ප්‍රශ්න බැංකුව පූරණය වෙමින්…')}</p>;

  const draft = (x: Question): Draft => {
    const s = st;
    if (active && s.exam!.selected.includes(x.id)) return s.exam!.responses[x.id] || (s.exam!.responses[x.id] = { answers: {} });
    const d = s.drafts[x.id] || (s.drafts[x.id] = { answers: {}, choice: null });
    const prev = latest(s, x);
    if (!d.touched && prev) {
      if (x.type === 'mcq') d.choice = prev.result.choice;
      else d.answers = clone(prev.result.answers || {});
    }
    return d;
  };
  const stats = (qs: Question[]) => {
    const n = { total: qs.length, right: 0, revisit: 0, tried: 0, mcq: 0, mcqRight: 0 };
    for (const q of qs) {
      const s = status(st, q);
      if (s === 'right') n.right++; else if (s === 'revisit') n.revisit++; else if (s === 'tried') n.tried++;
      if (q.type === 'mcq' && s !== 'new') { n.mcq++; if (s === 'right') n.mcqRight++; }
    }
    return { ...n, done: n.right + n.revisit + n.tried };
  };
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const statusWord = (s: Status) => ({ right: t('Right', 'சரி', 'නිවැරදියි'), revisit: t('To revisit', 'மீண்டும் பார்க்க', 'නැවත බලන්න'), tried: t('Answered', 'விடையளித்தது', 'පිළිතුරු දුන්'), new: t('Not tried', 'முயற்சிக்காதது', 'උත්සාහ නොකළ') })[s];
  const bookmark = (q: Question) => { const s = clone(st); const on = !s.bookmarks.includes(q.id); s.bookmarks = s.bookmarks.filter((x) => x !== q.id); if (on) s.bookmarks.push(q.id); s.bookmarkPending[q.id] = on; persist(s); void sync(); };
  const header = (
    <div class="pp-top">
      <div class="pp-toggles" role="group" aria-label="Language">
        <button type="button" class="btn" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">English</button>
        <button type="button" class="btn" aria-pressed={lang === 'ta'} onClick={() => setLang('ta')} lang="ta">தமிழ்</button>
        <button type="button" class="btn" aria-pressed={lang === 'si'} onClick={() => setLang('si')} lang="si">සිංහල</button>
      </div>
      {msg.text && <p id="pp-status" class="pp-msg" role="status">{msg.text}{msg.retry && <> <button type="button" class="btn" onClick={() => void sync()}>{t('Retry sync', 'மீண்டும் ஒத்திசைக்கவும்', 'නැවත සමමුහුර්ත කරන්න')}</button></>}</p>}
    </div>
  );
  const questionView = (q: Question, opts: { index: number; count: number; onGo: (i: number) => void; inSet?: boolean }) => (
    <QuestionView key={q.id + (active ? ':exam' : '')} q={q} d={draft(q)} prev={latest(st, q)} active={active && !!st.exam?.selected.includes(q.id)} lang={lang} t={t} tr={tr} qLabel={qLabel}
                  chapters={chaptersOf(q).map((k) => byKey.get(k)).filter((c): c is Chapter => !!c)} chapterName={chapterName}
                  bookmarked={st.bookmarks.includes(q.id)} onBookmark={() => bookmark(q)}
                  onDraft={(d) => { const s = clone(st); if (active && s.exam!.selected.includes(q.id)) s.exam!.responses[q.id] = d; else s.drafts[q.id] = d; persist(s); }}
                  onCheck={(choice) => enqueue(clone(st), [{ id: newId(), question: q.id, mode: 'practice', choice }])}
                  onSaveWritten={(answers, check) => {
                    if (!Object.values(answers).some((a) => a.trim())) { setMsg({ text: t('Write an answer before saving an attempt.', 'முயற்சியைச் சேமிக்குமுன் விடை எழுதவும்.', 'උත්සාහය සුරැකීමට පෙර පිළිතුරක් ලියන්න.') }); return; }
                    enqueue(clone(st), [{ id: newId(), question: q.id, mode: 'practice', answers: clone(answers), selfCheck: check }]);
                  }}
                  {...opts} />
  );
  const list = (qs: Question[], cur: Question | undefined, pick: (id: string) => void) => (
    <nav id="pp-list" class="pp-qlist" aria-label={t('Questions', 'வினாக்கள்', 'ප්‍රශ්න')}>
      {qs.map((x) => {
        const s = status(st, x);
        const exam = active && st.exam!.selected.includes(x.id);
        return (
          <button type="button" key={x.id} data-q={x.id} class={'pp-qitem is-' + (exam ? 'new' : s)} aria-current={x.id === cur?.id ? 'true' : 'false'} onClick={() => pick(x.id)}>
            <span class="pp-dot" aria-hidden="true" />
            <span class="pp-qitem-main"><b>{qLabel(x)}</b><small>{(x.type === 'mcq' ? t('Multiple choice', 'தெரிவு வினா', 'බහුවරණ') : t('Written', 'எழுத்து', 'ලිඛිත')) + (exam ? '' : ' · ' + statusWord(s))}{st.bookmarks.includes(x.id) ? ' · ★' : ''}</small></span>
          </button>
        );
      })}
    </nav>
  );
  const chips = (years: number[]) => (
    <div class="pp-chips" role="group" aria-label={t('Show', 'காட்டு', 'පෙන්වන්න')}>
      {([['', t('All', 'எல்லாம்', 'සියල්ල')], ['mcq', t('Multiple choice', 'தெரிவு வினா', 'බහුවරණ')], ['written', t('Written', 'எழுத்து', 'ලිඛිත')], ['new', t('Not tried', 'முயற்சிக்காதது', 'උත්සාහ නොකළ')],
        ['revisit', t('To revisit', 'மீண்டும் பார்க்க', 'නැවත බලන්න')], ['saved', t('Bookmarked', 'சேமித்தவை', 'පොත් සලකුණු')]] as [typeof chip, string][]).map(([k, label]) => (
        <button type="button" class="pp-chip" aria-pressed={chip === k} onClick={() => { setChip(k); setCurrent(undefined); }}>{label}</button>
      ))}
      {years.length > 1 && (
        <label class="pp-chip-select"><span class="pp-sr">{t('Year', 'ஆண்டு', 'වර්ෂය')}</span>
          <select value={String(yearChip)} onChange={(e) => { setYearChip(Number((e.target as HTMLSelectElement).value)); setCurrent(undefined); }}>
            <option value="0">{t('All years', 'எல்லா ஆண்டுகளும்', 'සියලු වසර')}</option>
            {years.map((y) => <option value={String(y)}>{y}</option>)}
          </select></label>
      )}
    </div>
  );
  const browse = (qs: Question[], years: number[], empty: string) => {
    const cur = qs.find((x) => x.id === current) || qs[0];
    return (
      <>
        {!active && chips(years)}
        <div class="pp-layout">
          {list(qs, cur, (id) => { setCurrent(id); setTimeout(() => area.current?.focus(), 0); })}
          <section id="pp-question" class="pp-card" ref={area} tabIndex={-1} aria-label={cur ? qLabel(cur) : undefined}>
            {!cur ? <p>{empty}</p> : questionView(cur, { index: qs.indexOf(cur), count: qs.length, onGo: (i) => { setCurrent(qs[i]!.id); setTimeout(() => area.current?.focus(), 0); } })}
          </section>
        </div>
      </>
    );
  };

  // ---------------------------------------------------------------- views
  const yearsWithBank = catalog.papers.filter((p) => p.bank && p.scope === 'physics' && banks[p.year]);
  const all = stats(bank);
  let body;

  if (view.kind === 'home') {
    const grades = [...new Set(chapters.map((c) => c.grade))].sort();
    body = (
      <>
        <header class="pp-hero">
          <h1>{t('Past Papers', 'கடந்த பரீட்சை வினாத்தாள்கள்', 'අතීත ප්‍රශ්න පත්‍ර')}</h1>
          <p>{t('O/L Science physics questions from 2015 to 2023, sorted by chapter, with full explanations.', 'சா/த விஞ்ஞான பௌதிகவியல் வினாக்கள் 2015–2023, அத்தியாய வாரியாக, முழு விளக்கங்களுடன்.', '2015–2023 සා/පෙළ විද්‍යාව භෞතික විද්‍යා ප්‍රශ්න, පරිච්ඡේද අනුව, සම්පූර්ණ පැහැදිලි කිරීම් සමඟ.')}</p>
          <div class="pp-overall" aria-label={t('Your progress', 'உங்கள் முன்னேற்றம்', 'ඔබේ ප්‍රගතිය')}>
            <div><b>{all.done}</b><span>/ {all.total} {t('answered', 'விடையளித்தவை', 'පිළිතුරු දුන්')}</span></div>
            <div><b>{pct(all.mcqRight, all.mcq)}%</b><span>{t('multiple choice right', 'தெரிவு வினாக்கள் சரி', 'බහුවරණ නිවැරදි')}</span></div>
            <div><b>{all.revisit}</b><span>{t('to revisit', 'மீண்டும் பார்க்க', 'නැවත බැලීමට')}</span></div>
          </div>
        </header>
        <div class="pp-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view.tab === 'chapters'} onClick={() => go({ kind: 'home', tab: 'chapters' })}>{t('By chapter', 'அத்தியாய வாரியாக', 'පරිච්ඡේද අනුව')}</button>
          <button type="button" role="tab" aria-selected={view.tab === 'years'} onClick={() => go({ kind: 'home', tab: 'years' })}>{t('By year', 'ஆண்டு வாரியாக', 'වර්ෂය අනුව')}</button>
        </div>
        {view.tab === 'chapters' ? grades.map((g) => (
          <section class="pp-grade" aria-labelledby={'pp-grade-' + g}>
            <h2 id={'pp-grade-' + g}>{t('Grade ' + g, 'தரம் ' + g, g + ' ශ්‍රේණිය')}</h2>
            <div class="pp-cards">
              {chapters.filter((c) => c.grade === g).map((c) => {
                const qs = inChapter(c.key), s = stats(qs);
                if (!qs.length) return null;
                return (
                  <button type="button" class="pp-chapter" data-chapter={c.key} onClick={() => go({ kind: 'chapter', key: c.key })}>
                    <span class="pp-chapter-no">{t('Chapter ' + c.number, 'அத்தியாயம் ' + c.number, 'පරිච්ඡේදය ' + c.number)}</span>
                    <b>{chapterName(c)}</b>
                    <span class="pp-bar" aria-hidden="true"><i style={{ width: pct(s.done, s.total) + '%' }} /></span>
                    <span class="pp-chapter-meta">{t(`${s.done} of ${s.total} answered`, `${s.total} இல் ${s.done} விடையளித்தவை`, `${s.total} න් ${s.done} පිළිතුරු දුන්`)}
                      {s.revisit > 0 && <em class="pp-revisit">{t(`${s.revisit} to revisit`, `${s.revisit} மீண்டும் பார்க்க`, `${s.revisit} නැවත බැලීමට`)}</em>}
                      {s.total > 0 && s.right === s.total && <em class="pp-done">{t('All right!', 'எல்லாம் சரி!', 'සියල්ල නිවැරදියි!')}</em>}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )).concat(inChapter(OTHER).length ? [(
          <section class="pp-grade" aria-labelledby="pp-grade-other">
            <h2 id="pp-grade-other">{t('Not in a chapter', 'அத்தியாயத்தில் இல்லாதவை', 'පරිච්ඡේදයක නැති')}</h2>
            <div class="pp-cards">
              {(() => { const s = stats(inChapter(OTHER)); return (
                <button type="button" class="pp-chapter" data-chapter={OTHER} onClick={() => go({ kind: 'chapter', key: OTHER })}>
                  <span class="pp-chapter-no">{t('Measuring, diffusion, gases', 'அளவீடு, பரவல், வாயுக்கள்', 'මිනුම්, විසරණය, වායු')}</span>
                  <b>{t('Other questions', 'பிற வினாக்கள்', 'වෙනත් ප්‍රශ්න')}</b>
                  <span class="pp-bar" aria-hidden="true"><i style={{ width: pct(s.done, s.total) + '%' }} /></span>
                  <span class="pp-chapter-meta">{t(`${s.done} of ${s.total} answered`, `${s.total} இல் ${s.done} விடையளித்தவை`, `${s.total} න් ${s.done} පිළිතුරු දුන්`)}</span>
                </button>); })()}
            </div>
          </section>
        )] : []) : (
          <div class="pp-cards">
            {yearsWithBank.map((p) => {
              const s = stats(bank.filter((q) => q.year === p.year));
              return (
                <button type="button" class="pp-chapter" data-year={p.year} onClick={() => go({ kind: 'year', year: p.year })}>
                  <span class="pp-chapter-no">{t('O/L Science', 'சா/த விஞ்ஞானம்', 'සා/පෙළ විද්‍යාව')}</span>
                  <b>{p.examLabel}</b>
                  <span class="pp-bar" aria-hidden="true"><i style={{ width: pct(s.done, s.total) + '%' }} /></span>
                  <span class="pp-chapter-meta">{t(`${s.done} of ${s.total} answered`, `${s.total} இல் ${s.done} விடையளித்தவை`, `${s.total} න් ${s.done} පිළිතුරු දුන්`)}</span>
                </button>
              );
            })}
          </div>
        )}
        <details class="pp-notice">
          <summary>{t('About these answers', 'இவ்விடைகள் பற்றி', 'මෙම පිළිතුරු ගැන')}</summary>
          <p>{t('The multiple-choice answers follow the Department of Examinations keys. The written answers and the explanations are model answers written for learning, not an official marking scheme; teacher review is pending.',
            'தெரிவு விடைகள் பரீட்சைத் திணைக்கள விடைக்குறிப்புகளின்படி. எழுத்து விடைகளும் விளக்கங்களும் கற்றலுக்காக எழுதப்பட்ட மாதிரி விடைகள்; அதிகாரபூர்வ புள்ளித்திட்டம் அல்ல; ஆசிரியர் மீளாய்வு நிலுவையில்.',
            'බහුවරණ පිළිතුරු විභාග දෙපාර්තමේන්තුවේ පිළිතුරු අනුව ය. ලිඛිත පිළිතුරු හා පැහැදිලි කිරීම් ඉගෙනීම සඳහා ලියූ ආදර්ශ පිළිතුරු ය; නිල ලකුණු දීමේ පටිපාටියක් නොවේ; ගුරු සමාලෝචනය පොරොත්තුවෙන්.')}</p>
        </details>
      </>
    );
  } else if (view.kind === 'chapter' || view.kind === 'set') {
    const c = byKey.get(view.key);
    const qs = inChapter(view.key);
    const s = stats(qs);
    const title = c ? chapterName(c) : view.key === OTHER ? t('Other questions', 'பிற வினாக்கள்', 'වෙනත් ප්‍රශ්න') : view.key;
    const back = <button type="button" class="pp-back" onClick={() => go({ kind: 'home', tab: 'chapters' })}>← {t('All chapters', 'எல்லா அத்தியாயங்களும்', 'සියලු පරිච්ඡේද')}</button>;
    if (view.kind === 'set') {
      const run = set && set.key === view.key ? set : null;
      if (!run) {
        body = <p class="pp-status">{t('Preparing your set…', 'உங்கள் பயிற்சி தயாராகிறது…', 'ඔබේ කට්ටලය සූදානම් වෙමින්…')}</p>;
      } else if (run.done) {
        const rows = run.ids.map((id) => byId.get(id)!).filter(Boolean);
        const r = rows.filter((q) => status(st, q) === 'right').length;
        body = (
          <>
            {back}
            <section class="pp-card pp-summary" aria-live="polite">
              <h1>{t('Set finished', 'பயிற்சி முடிந்தது', 'කට්ටලය අවසන්')} · {title}</h1>
              <p class="pp-score"><b>{r}</b> / {rows.length} {t('right', 'சரி', 'නිවැරදියි')}</p>
              <ul class="pp-summary-list">{rows.map((q) => <li class={'is-' + status(st, q)}><span class="pp-dot" aria-hidden="true" />{qLabel(q)} · {statusWord(status(st, q))}</li>)}</ul>
              <div class="pp-row">
                <button type="button" class="btn primary" onClick={() => { setSet(null); go({ kind: 'set', key: view.key }); }}>{t('Another set', 'இன்னொரு பயிற்சி', 'තවත් කට්ටලයක්')}</button>
                <button type="button" class="btn" onClick={() => go({ kind: 'chapter', key: view.key })}>{t('Back to the chapter', 'அத்தியாயத்துக்குத் திரும்பு', 'පරිච්ඡේදයට ආපසු')}</button>
              </div>
            </section>
          </>
        );
      } else {
        const q = byId.get(run.ids[run.i]!)!;
        body = (
          <>
            {back}
            <div class="pp-set-head">
              <h1>{t('Practise', 'பயிற்சி', 'පුහුණුව')}: {title}</h1>
              <span class="pp-bar" aria-hidden="true"><i style={{ width: pct(run.i, run.ids.length) + '%' }} /></span>
              <p>{t(`Question ${run.i + 1} of ${run.ids.length}`, `வினா ${run.i + 1} / ${run.ids.length}`, `ප්‍රශ්නය ${run.i + 1} / ${run.ids.length}`)}</p>
            </div>
            <section id="pp-question" class="pp-card" ref={area} tabIndex={-1}>
              {questionView(q, { index: run.i, count: run.ids.length, inSet: true,
                onGo: (i) => { if (i >= run.ids.length) setSet({ ...run, done: true }); else setSet({ ...run, i: Math.max(0, i) }); window.scrollTo({ top: 0 }); } })}
            </section>
          </>
        );
      }
    } else {
      const years = [...new Set(qs.map((q) => q.year))].sort((a, b) => b - a);
      body = (
        <>
          {back}
          <header class="pp-chapter-head">
            <span class="pp-chapter-no">{c ? t(`Grade ${c.grade} · Chapter ${c.number}`, `தரம் ${c.grade} · அத்தியாயம் ${c.number}`, `${c.grade} ශ්‍රේණිය · පරිච්ඡේදය ${c.number}`) : ''}</span>
            <h1>{title}</h1>
            <div class="pp-overall">
              <div><b>{s.done}</b><span>/ {s.total} {t('answered', 'விடையளித்தவை', 'පිළිතුරු දුන්')}</span></div>
              <div><b>{pct(s.mcqRight, s.mcq)}%</b><span>{t('multiple choice right', 'தெரிவு வினாக்கள் சரி', 'බහුවරණ නිවැරදි')}</span></div>
              <div><b>{s.revisit}</b><span>{t('to revisit', 'மீண்டும் பார்க்க', 'නැවත බැලීමට')}</span></div>
            </div>
            <div class="pp-row">
              <button type="button" class="btn primary pp-start" onClick={() => { setSet(null); go({ kind: 'set', key: view.key }); }}>{t(`Practise this chapter (${Math.min(SET_SIZE, qs.length)})`, `இந்த அத்தியாயத்தைப் பயிற்சி செய் (${Math.min(SET_SIZE, qs.length)})`, `මෙම පරිච්ඡේදය පුහුණු වන්න (${Math.min(SET_SIZE, qs.length)})`)}</button>
              {c && <a class="btn" href={c.url}>{t('Open the lesson', 'பாடத்தைத் திற', 'පාඩම විවෘත කරන්න')}</a>}
            </div>
          </header>
          {browse(listed, years, t('No questions here. Try another filter.', 'இங்கு வினாக்கள் இல்லை. வேறு வடிகட்டியை முயற்சிக்கவும்.', 'මෙහි ප්‍රශ්න නැත. වෙනත් පෙරහනක් උත්සාහ කරන්න.'))}
        </>
      );
    }
  } else {
    // a year's paper, with paper practice
    const yb = banks[view.year];
    const examResult = (e: Exam) => (e.year || 2015) + ' · ' + t('Paper submitted. ', 'தாள் சமர்ப்பிக்கப்பட்டது. ', 'පත්‍රය ඉදිරිපත් කළා. ') + (e.paper === 'I'
      ? t(`${e.score}/${e.selected.length} correct. Review individual explanations below.`, `${e.score}/${e.selected.length} சரி. கீழே தனித்தனி விளக்கங்களை மீள்பார்க.`, `${e.score}/${e.selected.length} නිවැරදියි. පහත එක් එක් පැහැදිලි කිරීම බලන්න.`)
      : t(`${e.selected.length} written questions saved for self-checking; no automatic marks.`, `${e.selected.length} எழுத்து வினாக்கள் தன்னிலை மதிப்பீட்டிற்குச் சேமிக்கப்பட்டன; தானியங்கி புள்ளிகள் இல்லை.`, `ලිඛිත ප්‍රශ්න ${e.selected.length} ස්වයං ඇගයීමට සුරැකිණි; ස්වයංක්‍රීය ලකුණු නැත.`));
    const startExam = async (paper: string) => {
      const p = yb!.papers.find((x) => x.id === paper);
      if (!p || !(await confirm(t('Start paper practice ' + paper, 'தாள் பயிற்சி ' + paper + ' தொடங்குக', paper + ' පත්‍ර පුහුණුව අරඹන්න'), tr(p.instructions)))) return;
      const s = clone(stRef.current!);
      s.exam = { scope: 'physics', year: view.year, paper, responses: {}, selected: yb!.questions.filter((x) => x.paper === paper).map((x) => x.id) };
      persist(s);
      setCurrent(undefined);
    };
    const finishExam = async () => {
      const s0 = stRef.current!;
      if (!s0.exam || s0.exam.submitted || s0.exam.finishing) return;
      s0.exam.finishing = true;
      if (!(await confirm(t('Submit this paper?', 'இத்தாளைச் சமர்ப்பிக்கவா?', 'මෙම පත්‍රය ඉදිරිපත් කරන්නද?'), t('Unanswered multiple-choice questions receive zero. Model answers become available after submission.', 'விடையற்ற தெரிவு வினாக்களுக்கு பூச்சியம். சமர்ப்பித்த பின் மாதிரி விடைகள் கிடைக்கும்.', 'පිළිතුරු නොදුන් බහුවරණ ප්‍රශ්නවලට ශුන්‍යයයි. ඉදිරිපත් කළ පසු ආදර්ශ පිළිතුරු ලැබේ.')))) {
        delete s0.exam.finishing;
        return;
      }
      const s = clone(stRef.current!);
      const e = s.exam!;
      const events: Pending[] = e.selected.map((id) => {
        const r = e.responses[id] || { answers: {} };
        return Object.assign({ id: newId(), question: id, mode: 'exam' }, e.paper === 'I' ? { choice: r.choice ?? null } : { answers: clone(r.answers || {}), selfCheck: null });
      });
      e.score = e.paper === 'I' ? events.filter((a) => a.choice === byId.get(a.question)!.correct).length : null;
      e.submitted = true;
      delete e.finishing;
      e.result = examResult(e);
      for (const id of e.selected) {       // keep submitted responses as practice drafts, to review what was written
        const r = e.responses[id];
        if (r && (Number.isInteger(r.choice) || Object.values(r.answers || {}).some((x) => x.trim()))) s.drafts[id] = clone(r);
      }
      enqueue(s, events);
    };
    const leaveExam = async () => {
      if (!(await confirm(t('Leave paper practice?', 'தாள் பயிற்சியிலிருந்து வெளியேறவா?', 'පත්‍ර පුහුණුවෙන් ඉවත් වන්නද?'), t('Your responses remain as drafts; no score will be recorded.', 'விடைகள் வரைவாக இருக்கும்; புள்ளிகள் பதிவாகாது.', 'ඔබේ පිළිතුරු කෙටුම්පත් ලෙස පවතී; ලකුණු සටහන් නොවේ.')))) return;
      const s = clone(stRef.current!);
      for (const id of Object.keys(s.exam!.responses)) s.drafts[id] = s.exam!.responses[id]!;
      s.exam = null;
      persist(s);
    };
    const examAnswered = active ? st.exam!.selected.filter((id) => {
      const r = st.exam!.responses[id];
      return st.exam!.paper === 'I' ? Number.isInteger(r?.choice) : Object.values(r?.answers || {}).some((x) => x.trim());
    }).length : 0;
    const label = yearsWithBank.find((p) => p.year === view.year)?.examLabel || String(view.year);
    body = !yb ? <p>{t('This year is not available.', 'இந்த ஆண்டு கிடைக்கவில்லை.', 'මෙම වර්ෂය ලබා ගත නොහැක.')}</p> : (
      <>
        {!active && <button type="button" class="pp-back" onClick={() => go({ kind: 'home', tab: 'years' })}>← {t('All years', 'எல்லா ஆண்டுகளும்', 'සියලු වසර')}</button>}
        <header class="pp-chapter-head">
          <span class="pp-chapter-no">{t('O/L Science · physics questions', 'சா/த விஞ்ஞானம் · பௌதிகவியல் வினாக்கள்', 'සා/පෙළ විද්‍යාව · භෞතික විද්‍යා ප්‍රශ්න')}</span>
          <h1>{label}</h1>
          {tr(yb.coverageNote) && <p class="pp-muted">{tr(yb.coverageNote)}</p>}
          {!active ? (
            <div class="pp-row pp-exam-actions">
              <button type="button" class="btn primary" onClick={() => void startExam('I')}>{t('Paper I practice · multiple choice', 'தாள் I பயிற்சி · தெரிவு வினாக்கள்', 'I පත්‍ර පුහුණුව · බහුවරණ')}</button>
              <button type="button" class="btn" onClick={() => void startExam('II')}>{t('Paper II practice · written', 'தாள் II பயிற்சி · எழுத்து', 'II පත්‍ර පුහුණුව · ලිඛිත')}</button>
            </div>
          ) : (
            <section class="pp-exam-bar" aria-label="Paper practice">
              <h2>{t('Paper practice ', 'தாள் பயிற்சி ', 'පත්‍ර පුහුණුව ') + st.exam!.paper + ' · ' + t('no time limit', 'நேர வரம்பு இல்லை', 'කාල සීමාවක් නැත')}</h2>
              <p>{t(`${examAnswered} of ${st.exam!.selected.length} questions have a response.`, `${st.exam!.selected.length} வினாக்களில் ${examAnswered} இற்கு விடை உள்ளது.`, `ප්‍රශ්න ${st.exam!.selected.length} න් ${examAnswered} කට පිළිතුරු ඇත.`)}</p>
              <div class="pp-row">
                <button type="button" class="btn primary" onClick={() => void finishExam()}>{t('Submit paper', 'தாளைச் சமர்ப்பிக்கவும்', 'පත්‍රය ඉදිරිපත් කරන්න')}</button>
                <button type="button" class="btn" onClick={() => void leaveExam()}>{t('Leave paper practice', 'தாள் பயிற்சியிலிருந்து வெளியேறுக', 'පත්‍ර පුහුණුවෙන් ඉවත් වන්න')}</button>
              </div>
            </section>
          )}
          {st.exam?.submitted && (st.exam.year || 2015) === view.year && <p class="pp-result" role="status">{st.exam.score !== undefined ? examResult(st.exam) : st.exam.result}</p>}
        </header>
        {browse(listed, [], t('No questions here. Try another filter.', 'இங்கு வினாக்கள் இல்லை. வேறு வடிகட்டியை முயற்சிக்கவும்.', 'මෙහි ප්‍රශ්න නැත. වෙනත් පෙරහනක් උත්සාහ කරන්න.'))}
      </>
    );
  }

  return (
    <div class="pp-app">
      {header}
      {body}
      <dialog ref={dlg} class="pp-dialog" aria-labelledby="pp-confirm-title" aria-describedby="pp-confirm-text"
              onClose={() => { const d = dialog; setDialog(null); d?.done(dlg.current?.returnValue === 'ok'); }}>
        <form method="dialog">
          <h2 id="pp-confirm-title">{dialog?.title}</h2>
          <p id="pp-confirm-text">{dialog?.text}</p>
          <div class="pp-row">
            <button class="btn" value="cancel">{t('Cancel', 'இரத்து', 'අවලංගු කරන්න')}</button>
            <button class="btn primary" value="ok">{t('Continue', 'தொடர்க', 'ඉදිරියට')}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

interface ViewProps {
  q: Question; d: Draft; prev?: Attempt; active: boolean; lang: Lang; bookmarked: boolean; index: number; count: number; inSet?: boolean;
  chapters: Chapter[]; chapterName: (c: Chapter) => string;
  t: (en: string, ta: string, si?: string) => string; tr: (o: Tx) => string; qLabel: (q: Question) => string;
  onBookmark: () => void; onDraft: (d: Draft) => void; onCheck: (choice: number) => void;
  onSaveWritten: (answers: Record<string, string>, check: string | null) => void; onGo: (i: number) => void;
}

function QuestionView(p: ViewProps) {
  const { q, t, tr, active, lang } = p;
  const [d, setD] = useState<Draft>(() => clone(p.d));
  const [hint, setHint] = useState(false);
  const reveal = !active && !!p.prev && hasResponse(p.prev.result) && q.type === 'mcq';
  const update = (next: Draft) => {
    const n = { ...next, touched: true };
    setD(n);
    p.onDraft(n);
  };
  const learn = (item: { references?: Ref[]; textbookReferenceStatus?: string }) => {
    const books = (item.references || []).filter((r) => r.kind === 'textbook').sort((a, b) => (a.language === lang ? 0 : 1) - (b.language === lang ? 0 : 1));
    const range = (r: Ref) => (r.printedPages![0] === r.printedPages![1] ? String(r.printedPages![0]) : r.printedPages!.join('–'));
    return (
      <div class="pp-x pp-x-learn">
        <h4>{t('Learn it', 'கற்றுக்கொள்', 'ඉගෙන ගන්න')}</h4>
        {p.chapters.length > 0 && <ul class="pp-learn-links">{p.chapters.map((c) => <li><a href={c.url}>{t(`Grade ${c.grade} · Chapter ${c.number}: `, `தரம் ${c.grade} · அத்தியாயம் ${c.number}: `, `${c.grade} ශ්‍රේණිය · පරිච්ඡේදය ${c.number}: `) + p.chapterName(c)}</a></li>)}</ul>}
        {books.length > 0 && <details><summary>{t('Textbook pages', 'பாடநூல் பக்கங்கள்', 'පෙළපොත් පිටු')}</summary>
          <ul class="pp-book-references">{books.map((r) => (
            <li><a class="pp-book-ref" href={r.url} target="_blank" rel="noopener">{tr(r.title) + ' · ' + (r.language === 'ta' ? t('Tamil', 'தமிழ்', 'දෙමළ') : t('English', 'ஆங்கிலம்', 'ඉංග්‍රීසි')) + ' · ' + t('p. ', 'ப. ', 'පි. ') + range(r)} ↗</a>
              <span class="pp-muted"> {tr(r.section)} · {r.support === 'direct' ? t('supports this answer', 'இவ்விடையை ஆதரிக்கிறது', 'මෙම පිළිතුරට සහාය දක්වයි') : t('related reading', 'தொடர்புடைய வாசிப்பு', 'අදාළ කියවීම')}</span></li>))}</ul></details>}
      </div>
    );
  };
  /** The explanation in parts: the idea, step by step, why it works, the common mistake, a similar question, where to learn it. */
  const explain = (item: { detailedExplanation?: Teaching; steps?: Tx[]; references?: Ref[]; textbookReferenceStatus?: string }, answer?: Tx, diagram?: string) => {
    const dx = item.detailedExplanation;
    // a part that only repeats what is already shown is left out (some answers repeat their one step and reasoning)
    const seen = new Set<string>();
    const fresh = (x: string) => { const k = x.replace(/\s+/g, ' ').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; };
    const ans = answer && tr(answer) && fresh(tr(answer)) ? tr(answer) : '';
    const idea = dx && fresh(tr(dx.concept)) ? tr(dx.concept) : '';
    const steps = (item.steps || []).map((x) => tr(x)).filter((x) => fresh(x));
    const why = dx && fresh(tr(dx.reasoning)) ? tr(dx.reasoning) : '';
    return (
      <div class="pp-explain">
        {(ans || diagram) && <div class="pp-x pp-x-answer"><h4>{t('The answer', 'விடை', 'පිළිතුර')}</h4>{ans && <p>{ans}</p>}
          {diagram && <div class="pp-diagram" dangerouslySetInnerHTML={{ __html: diagram }} />}</div>}
        {idea && <div class="pp-x pp-x-idea"><h4>{t('The idea', 'கருத்து', 'අදහස')}</h4><p>{idea}</p></div>}
        {steps.length > 0 && <div class="pp-x pp-x-steps"><h4>{t('Step by step', 'படிப்படியாக', 'පියවරෙන් පියවර')}</h4><ol>{steps.map((x) => <li>{x}</li>)}</ol></div>}
        {why && <div class="pp-x pp-x-why"><h4>{t('Why it works', 'இது ஏன் சரி', 'එය හරි ඇයි')}</h4><p>{why}</p></div>}
        {dx && tr(dx.commonMistake) && <div class="pp-x pp-x-mistake"><h4>{t('Watch out', 'கவனம்', 'පරෙස්සමින්')}</h4><p>{tr(dx.commonMistake)}</p></div>}
        {dx && tr(dx.practice?.question) && <details class="pp-x pp-x-try"><summary>{t('Try one like it', 'இதே போன்ற ஒன்றை முயற்சி செய்', 'මෙවැනි එකක් උත්සාහ කරන්න')}</summary><p>{tr(dx.practice.question)}</p>
          <details><summary>{t('Show the answer', 'விடையைக் காட்டு', 'පිළිතුර පෙන්වන්න')}</summary><p>{tr(dx.practice.answer)}</p></details></details>}
        {learn(item)}
      </div>
    );
  };
  const scan = (
    <details class="pp-scan">
      <summary>{t('Original paper pages', 'மூல வினாத்தாள் பக்கங்கள்', 'මුල් ප්‍රශ්න පත්‍ර පිටු')}</summary>
      <p class="pp-muted">{t('The original Science paper (Tamil); it may include other subjects.', 'மூல விஞ்ஞான வினாத்தாள் (தமிழ்); பிற பாடங்களும் இருக்கலாம்.', 'මුල් විද්‍යා ප්‍රශ්න පත්‍රය (දෙමළ); වෙනත් විෂයයන් ද තිබිය හැක.')}</p>
      {q.pages.map((n) => {
        const url = '/lessons/past-papers/' + q.year + '/page-' + String(n).padStart(2, '0') + '.jpg';
        return <a href={url} target="_blank" rel="noopener"><img src={url} loading="lazy" alt={t('Original paper, page ' + n, 'மூலத்தாள், பக்கம் ' + n, 'මුල් පත්‍රය, පිටුව ' + n)} /></a>;
      })}
    </details>
  );
  const nav = (
    <div class="pp-row pp-nav">
      {!p.inSet && <button type="button" class="btn" disabled={p.index === 0} onClick={() => p.onGo(p.index - 1)}>← {t('Previous', 'முந்தையது', 'පෙර')}</button>}
      <button type="button" class={'btn' + (p.inSet && (reveal || q.type === 'written') ? ' primary' : '')} disabled={!p.inSet && p.index === p.count - 1} onClick={() => p.onGo(p.index + 1)}>
        {p.inSet && p.index === p.count - 1 ? t('Finish the set', 'பயிற்சியை முடி', 'කට්ටලය අවසන් කරන්න') : t('Next', 'அடுத்தது', 'ඊළඟ')} →</button>
    </div>
  );

  const right = reveal && p.prev!.result.correct;
  return (
    <article class="pp-q">
      <div class="pp-qhead">
        <div>
          <h2>{p.qLabel(q)}</h2>
          <span class="pp-tag">{(q.type === 'mcq' ? t('Multiple choice', 'தெரிவு வினா', 'බහුවරණ') : t('Written', 'எழுத்து', 'ලිඛිත')) + (q.marks ? ' · ' + q.marks + ' ' + t('marks', 'புள்ளிகள்', 'ලකුණු') : '')}</span>
        </div>
        <button type="button" class="btn pp-bookmark" aria-pressed={p.bookmarked} onClick={p.onBookmark}>{p.bookmarked ? '★ ' + t('Saved', 'சேமிக்கப்பட்டது', 'සුරැකිණි') : '☆ ' + t('Save', 'சேமி', 'සුරකින්න')}</button>
      </div>
      <p class="pp-prompt">{tr(q.prompt)}</p>
      {q.figure && <figure><a href={q.figure} target="_blank" rel="noopener"><img src={q.figure} alt={t('Diagram for question ' + q.number, 'வினா ' + q.number + ' இன் படம்', 'ප්‍රශ්නය ' + q.number + ' සඳහා රූපය')} /></a>
        <figcaption>{t('From the original paper; option numbers follow it.', 'மூலத்தாளிலிருந்து; தெரிவு எண்கள் அதன்படி.', 'මුල් පත්‍රයෙන්; විකල්ප අංක එය අනුගමනය කරයි.')}</figcaption></figure>}
      {q.sourceDescription && <p class="pp-muted">{tr(q.sourceDescription)}</p>}
      {q.type === 'mcq' ? (
        <>
          <fieldset class="pp-options">
            <legend class="pp-sr">{t('Choose one answer', 'ஒரு விடையைத் தேர்க', 'එක් පිළිතුරක් තෝරන්න')}</legend>
            {q.options!.map((o, i) => {
              const mark = reveal ? (i === q.correct ? 'is-right' : i === p.prev!.result.choice ? 'is-wrong' : '') : '';
              return (
                <label class={'pp-opt ' + mark + (d.choice === i ? ' is-chosen' : '')}>
                  <input type="radio" name="pp-choice" value={i} checked={d.choice === i} onChange={() => update({ ...d, choice: i })} />
                  <span class="pp-opt-no" aria-hidden="true">{reveal && i === q.correct ? '✓' : reveal && i === p.prev!.result.choice ? '✗' : i + 1}</span>
                  <span class="pp-opt-text">{tr(o)}{reveal && q.optionExplanations?.[i] && <small class="pp-opt-why">{tr(q.optionExplanations[i])}</small>}</span>
                </label>
              );
            })}
          </fieldset>
          {!active && (
            <div class="pp-row">
              <button type="button" class="btn primary pp-check" disabled={!Number.isInteger(d.choice)} onClick={() => { p.onCheck(d.choice!); setD({ ...d, touched: false }); }}>
                {reveal ? t('Check again', 'மீண்டும் சரிபார்', 'නැවත පරීක්ෂා කරන්න') : t('Check answer', 'விடையைச் சரிபார்க்கவும்', 'පිළිතුර පරීක්ෂා කරන්න')}</button>
              {!reveal && tr(q.hint) && <button type="button" class="btn" aria-expanded={hint} onClick={() => setHint(!hint)}>💡 {t('Hint', 'குறிப்பு', 'ඉඟිය')}</button>}
            </div>
          )}
          {hint && !reveal && <p class="pp-hint">{tr(q.hint)}</p>}
          {reveal && (
            <section class="pp-feedback" aria-live="polite">
              <p class={'pp-verdict ' + (right ? 'is-right' : 'is-wrong')}>{right ? '🎉 ' + t('Right!', 'சரி!', 'නිවැරදියි!') : t(`Not quite. The answer is ${q.correct! + 1}.`, `சரியில்லை. விடை ${q.correct! + 1}.`, `එතරම් නොවේ. පිළිතුර ${q.correct! + 1} යි.`)}</p>
              {q.editorialWarning && <p class="pp-notice">{tr(q.editorialWarning)}</p>}
              {explain(q, q.explanation)}
            </section>
          )}
          {scan}
        </>
      ) : (
        <>
          {q.parts!.map((part, i) => (
            <section class="pp-part">
              <h3>{part.label}</h3>
              <p class="pp-prompt">{tr(part.prompt)}</p>
              <label for={`pp-answer-${i}`} class="pp-muted">{t('Your answer', 'உங்கள் விடை', 'ඔබේ පිළිතුර')}</label>
              <textarea id={`pp-answer-${i}`} data-part={part.label} maxLength={2000} value={d.answers[part.label] || ''}
                        onInput={(e) => update({ ...d, answers: { ...d.answers, [part.label]: (e.target as HTMLTextAreaElement).value } })} />
              {!active && <>
                {tr(part.hint) && <details class="pp-hint-box"><summary>💡 {t('Hint', 'குறிப்பு', 'ඉඟිය')}</summary><p>{tr(part.hint)}</p></details>}
                <details class="pp-solution"><summary>{t('Show the model answer', 'மாதிரி விடையைக் காட்டு', 'ආදර්ශ පිළිතුර පෙන්වන්න')}</summary>
                  {explain(part, part.answer, q.year === 2015 ? DIAGRAMS[q.number + '|' + part.label] : undefined)}</details>
              </>}
            </section>
          ))}
          {!active && (
            <div class="pp-selfcheck">
              <p>{t('After checking the model answer, how did you do?', 'மாதிரி விடையைப் பார்த்த பின், எப்படிச் செய்தீர்கள்?', 'ආදර්ශ පිළිතුර බැලීමෙන් පසු, ඔබ කෙසේ කළාද?')}</p>
              <div class="pp-row">
                <button type="button" class="btn primary" onClick={() => p.onSaveWritten(d.answers, 'understood')}>✓ {t('I got it', 'புரிந்தது', 'මට තේරුණා')}</button>
                <button type="button" class="btn" onClick={() => p.onSaveWritten(d.answers, 'needs-work')}>↻ {t('Needs more practice', 'மேலும் பயிற்சி தேவை', 'තව පුහුණුව අවශ්‍යයි')}</button>
                <button type="button" class="btn" onClick={() => p.onSaveWritten(d.answers, null)}>{t('Just save my answer', 'விடையை மட்டும் சேமி', 'පිළිතුර පමණක් සුරකින්න')}</button>
              </div>
            </div>
          )}
          {scan}
        </>
      )}
      {nav}
    </article>
  );
}
