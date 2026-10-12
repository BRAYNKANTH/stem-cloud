import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs, setLang } from '../stores/prefs';

/*
 * Past papers (public/static/past-papers.js, ported): the O/L Science papers' physics questions by year, with filters,
 * practice (MCQ check with explanations; written answers with model answers and a self-check) and paper practice
 * without a time limit. Drafts stay on this device; attempts and bookmarks sync to the account through the existing
 * API (/api/past-papers/*), which keeps them apart from lesson XP. The device keeps the same state under the same key
 * as the current page (stem_pp_physics_<user id>), so a student can move between the two pages.
 * The bank is English and Tamil: Sinhala shows English until the papers are translated.
 */

type Lang2 = 'en' | 'ta';
type Tx = { en?: string; ta?: string } | undefined;
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

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' };
const TOPIC_TA: Record<string, string> = {
  'Acids and bases': 'அமிலங்களும் காரங்களும்', 'Atomic structure': 'அணுக் கட்டமைப்பு', 'Biodiversity': 'உயிர்ப்பல்வகைமை', 'Measurement': 'அளவீடு',
  'Energy': 'சக்தி', 'Friction': 'உராய்வு', 'Electromagnetism': 'மின்காந்தவியல்', 'Electromagnetic induction': 'மின்காந்தத் தூண்டல்',
};
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + '_' + Math.random().toString(36).slice(2));
const hasResponse = (r?: Result) => !!r && (r.type === 'mcq' ? Number.isInteger(r.choice) : Object.values(r.answers || {}).some((s) => s.trim()));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// The model diagrams the current page draws for four 2015 written parts (copied unchanged).
const DIAGRAMS: Record<string, string> = {
  '3|C(iii)': '<svg class="pp-model-diagram" viewBox="0 0 400 260" role="img" aria-label="Charles law graph: volume V vertically, absolute temperature T in kelvin horizontally; straight line through origin"><g fill="none" stroke="black" stroke-width="2"><path d="M60 30V215H360 M55 40L60 30L65 40 M350 210L360 215L350 220 M60 215L320 50"/></g><g font-size="17" fill="black"><text x="28" y="35">V</text><text x="300" y="245">T (K)</text><text x="42" y="240">0</text><text x="100" y="55">Constant pressure</text></g></svg>',
  '4|C(ii)': '<svg class="pp-model-diagram" viewBox="0 0 400 160" role="img" aria-label="Two-input OR gate: inputs A and B, output Q"><path d="M105 35 Q150 80 105 125 Q220 135 260 80 Q220 25 105 35Z" fill="none" stroke="black" stroke-width="3"/><path d="M40 55H120 M40 105H120 M260 80H350" stroke="black" stroke-width="3"/><text x="15" y="60">A</text><text x="15" y="110">B</text><text x="360" y="85">Q</text></svg>',
  '4|B(v)(a)': '<svg class="pp-model-diagram" viewBox="0 0 480 260" role="img" aria-label="Ohm law model circuit: battery switch rheostat ammeter and resistor in series; voltmeter across resistor"><g fill="none" stroke="black" stroke-width="2"><path d="M45 60H110 M110 45V75 M122 35V85 M122 60H170 M170 60L200 40 M200 60H230 M280 60H335 M375 60H430V205H330 M255 205H45V60 M255 205V140H278 M307 140H330V205"/><rect x="230" y="49" width="50" height="22"/><path d="M235 82L275 38 M267 40L275 38L274 47"/><circle cx="355" cy="60" r="20"/><rect x="255" y="193" width="75" height="24"/><circle cx="292" cy="140" r="16"/></g><g fill="black" font-size="17"><text x="349" y="66">A</text><text x="286" y="146">V</text><text x="270" y="239">R</text><text x="90" y="112">Battery</text><text x="160" y="25">Switch</text><text x="230" y="112">Rheostat</text></g></svg>',
  '10|iii(a)': '<svg class="pp-model-diagram" viewBox="0 0 440 170" role="img" aria-label="Photodiode: incoming light arrows, anode left positive, cathode bar right negative; conventional terminal labels"><g fill="none" stroke="black" stroke-width="3"><path d="M35 110H170 M220 110H400 M170 85L215 110L170 135Z M220 83V137 M210 25L182 64 M238 30L210 68 M183 52L182 64L194 60 M211 56L210 68L222 64"/></g><g font-size="16" fill="black"><text x="20" y="150">Anode (+)</text><text x="300" y="150">Cathode (−)</text><text x="40" y="25">Incoming light</text></g></svg>',
};

export default function PastPapers() {
  const pageLang = useStore($lang);
  const lang: Lang2 = pageLang === 'ta' ? 'ta' : 'en';
  const t = (en: string, ta: string) => (lang === 'ta' ? ta : en);
  const tr = (o: Tx) => (o && (o[lang] || o.en)) || '';
  const subject = (s: string) => ({ biology: t('Biology', 'உயிரியல்'), chemistry: t('Chemistry', 'இரசாயனவியல்'), physics: t('Physics', 'பௌதிகவியல்') } as Record<string, string>)[s] || s;
  const topicName = (s: string) => (lang === 'ta' ? TOPIC_TA[s] || s : s);
  const qLabel = (q: Question) => t(`Paper ${q.paper} · Q${q.number}`, `தாள் ${q.paper} · வினா ${q.number}`);

  const [user, setUser] = useState<number | null | undefined>(undefined);
  const [banks, setBanks] = useState<Record<number, Bank>>({});
  const [catalog, setCatalog] = useState<{ papers: { year: number; examLabel: string; bank: string; scope: string }[] } | null>(null);
  const [st, setSt] = useState<State | null>(null);
  const [year, setYearState] = useState(2015);
  const [current, setCurrent] = useState<string | undefined>();
  const [f, setF] = useState({ type: '', topic: '', review: '', search: '' });
  const [lesson, setLesson] = useState('');
  const [msg, setMsg] = useState<{ text: string; retry?: boolean }>({ text: '' });
  const [dialog, setDialog] = useState<{ title: string; text: string; done: (ok: boolean) => void } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLElement>(null);
  const list = useRef<HTMLElement>(null);
  const syncing = useRef(false);
  const keyRef = useRef('');
  const stRef = useRef<State | null>(null);
  stRef.current = st;

  const bank = useMemo(() => ({ questions: Object.values(banks).flatMap((b) => b.questions) }), [banks]);
  const byId = useMemo(() => new Map(bank.questions.map((q) => [q.id, q])), [bank]);
  const yearBank = banks[year];
  const active = !!st?.exam && !st.exam.submitted;

  const persist = (next: State) => {
    stRef.current = next;
    setSt({ ...next });
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(next));
    } catch {
      setMsg({ text: t('Device storage is full. Keep this page open and connect to save your answers.', 'சாதனச் சேமிப்பு நிரம்பியுள்ளது. பக்கத்தைத் திறந்து வைத்து விடைகளைச் சேமிக்க இணைக்கவும்.') });
    }
  };
  const latest = (s: State, q: Question) => {
    const ev = s.events.filter((e) => e.question === q.id);
    return [...ev].reverse().find((e) => hasResponse(e.result)) || ev.at(-1);   // an unanswered exam entry must not hide an earlier written response
  };
  const weak = (s: State, q: Question) => {
    const r = latest(s, q)?.result;
    return !!r && (r.type === 'mcq' ? !r.correct : r.selfCheck === 'needs-work');
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
      setMsg({ text: t('Saved to your account. Unsubmitted drafts stay on this device.', 'உங்கள் கணக்கில் சேமிக்கப்பட்டது. சமர்ப்பிக்காத வரைவுகள் இச்சாதனத்தில் உள்ளன.') });
    } catch (e) {
      setMsg({ text: (e as { code?: number }).code === 401
        ? t('Session expired. Sign in again to sync; drafts remain on this device.', 'அமர்வு காலாவதியானது. ஒத்திசைக்க மீண்டும் உள்நுழைக; வரைவு சாதனத்தில் உள்ளது.')
        : t('Saved on this device; account sync is pending.', 'இச்சாதனத்தில் சேமிக்கப்பட்டது; கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.'), retry: true });
    } finally {
      syncing.current = false;
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
    void sync();
  }

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    loadPrefs();
    setLesson(new URLSearchParams(location.search).get('lesson') || '');
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
        let y = Number(s.exam && !s.exam.submitted ? s.exam.year : s.year || 2015);
        if (!all[y]) y = 2015;
        setCatalog(cat);
        setBanks(all);
        setYearState(y);
        persist(s);
        setMsg({ text: t('Drafts save on this device. Saved attempts sync to your account.', 'வரைவுகள் இச்சாதனத்தில் சேமிக்கப்படும். சேமித்த முயற்சிகள் கணக்கிற்கு ஒத்திசைக்கப்படும்.') });
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
          setMsg({ text: t('Using saved device data. Account sync is pending.', 'சாதனத் தரவு பயன்படுகிறது. கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.'), retry: true });
        }
      } catch {
        setMsg({ text: t('Question bank could not load. Connect and reload this page.', 'வினா வங்கி ஏற்றப்படவில்லை. இணைப்பைப் பெற்று மீளேற்றவும்.') });
      }
    })();
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // ---------------------------------------------------------------- the questions on show
  const visible = useMemo(() => {
    if (!st) return [];
    const search = f.search.trim().toLowerCase();
    return bank.questions.filter((q) => q.year === year && (active ? q.paper === st.exam!.paper :
      (!f.type || q.type === f.type) && (!f.topic || q.topics.includes(f.topic)) && (!lesson || q.lessons.includes(lesson)) &&
      (!search || JSON.stringify([q.prompt, q.topics, q.parts?.map((p) => p.prompt)]).toLowerCase().includes(search)) &&
      (!f.review || (f.review === 'saved' && st.bookmarks.includes(q.id)) || (f.review === 'weak' && weak(st, q)) || (f.review === 'unattempted' && !hasResponse(latest(st, q)?.result)))));
  }, [st, bank, year, f, lesson, active]);
  const q = visible.find((x) => x.id === current) || visible[0];
  useEffect(() => {
    if (q && q.id !== current) setCurrent(q.id);
  }, [q?.id]);

  const confirm = (title: string, text: string) => new Promise<boolean>((resolve) => setDialog({ title, text, done: resolve }));
  useEffect(() => {
    if (dialog && dlg.current && !dlg.current.open) dlg.current.showModal();
  }, [dialog]);

  if (user === null) return <p class="pp-status" role="status">{t('Please sign in to use Past Papers.', 'கடந்த வினாத்தாள்களைப் பயன்படுத்த உள்நுழைக.')}</p>;
  if (!st || !yearBank || !catalog) return <p class="pp-status" role="status">{msg.text || t('Loading question bank…', 'வினா வங்கி ஏற்றப்படுகிறது…')}</p>;

  const draft = (x: Question): Draft => {
    const s = st;
    if (active) return s.exam!.responses[x.id] || (s.exam!.responses[x.id] = { answers: {} });
    const d = s.drafts[x.id] || (s.drafts[x.id] = { answers: {}, choice: null });
    const prev = latest(s, x);
    if (!d.touched && prev) {
      if (x.type === 'mcq') d.choice = prev.result.choice;
      else d.answers = clone(prev.result.answers || {});
    }
    return d;
  };
  const chooseYear = (y: number) => {
    const s = clone(st);
    s.year = y;
    setYearState(y);
    setCurrent(undefined);
    persist(s);
  };
  const setFilter = (k: keyof typeof f, v: string) => {
    setF({ ...f, [k]: v });
    setCurrent(undefined);
  };
  const go = (id: string, focus = true) => {
    setCurrent(id);
    if (focus) setTimeout(() => area.current?.focus(), 0);
  };
  const rows = yearBank.questions;
  const attempted = rows.filter((x) => hasResponse(latest(st, x)?.result));
  const mcqs = attempted.filter((x) => x.type === 'mcq');
  const right = mcqs.filter((x) => latest(st, x)!.result.correct).length;
  const saved = rows.filter((x) => st.bookmarks.includes(x.id)).length;
  const topics = [...new Set(rows.flatMap((x) => x.topics))].sort();

  const examResult = (e: Exam) => (e.year || 2015) + ' · ' + t('Paper submitted. ', 'தாள் சமர்ப்பிக்கப்பட்டது. ') + (e.paper === 'I'
    ? t(`${e.score}/${e.selected.length} correct. Review individual explanations below.`, `${e.score}/${e.selected.length} சரி. கீழே தனித்தனி விளக்கங்களை மீள்பார்க.`)
    : t(`${e.selected.length} written questions saved for self-checking; no automatic marks.`, `${e.selected.length} எழுத்து வினாக்கள் தன்னிலை மதிப்பீட்டிற்குச் சேமிக்கப்பட்டன; தானியங்கி புள்ளிகள் இல்லை.`));
  async function startExam(paper: string) {
    const p = yearBank!.papers.find((x) => x.id === paper);
    if (!p || !(await confirm(t('Start paper practice ' + paper, 'தாள் பயிற்சி ' + paper + ' தொடங்குக'), tr(p.instructions)))) return;
    const s = clone(stRef.current!);
    s.exam = { scope: 'physics', year, paper, responses: {}, selected: yearBank!.questions.filter((x) => x.paper === paper).map((x) => x.id) };
    persist(s);
    setCurrent(undefined);
  }
  async function finishExam() {
    const s0 = stRef.current!;
    if (!s0.exam || s0.exam.submitted || s0.exam.finishing) return;
    s0.exam.finishing = true;
    if (!(await confirm(t('Submit this paper?', 'இத்தாளைச் சமர்ப்பிக்கவா?'), t('Unanswered MCQs receive zero. Model answers become available after submission.', 'விடையற்ற தெரிவு வினாக்களுக்கு பூச்சியம். சமர்ப்பித்த பின் மாதிரி விடைகள் கிடைக்கும்.')))) {
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
  }
  async function leaveExam() {
    if (!(await confirm(t('Leave paper practice?', 'தாள் பயிற்சியிலிருந்து வெளியேறவா?'), t('Your responses remain as drafts; no score will be recorded.', 'விடைகள் வரைவாக இருக்கும்; புள்ளிகள் பதிவாகாது.')))) return;
    const s = clone(stRef.current!);
    for (const id of Object.keys(s.exam!.responses)) s.drafts[id] = s.exam!.responses[id]!;
    s.exam = null;
    persist(s);
  }
  const examAnswered = active ? st.exam!.selected.filter((id) => {
    const r = st.exam!.responses[id];
    return st.exam!.paper === 'I' ? Number.isInteger(r?.choice) : Object.values(r?.answers || {}).some((x) => x.trim());
  }).length : 0;

  return (
    <div class="pp-app">
      <div class="pp-toggles" role="group" aria-label="Language">
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">English</button>
        <button type="button" aria-pressed={lang === 'ta'} onClick={() => setLang('ta')} lang="ta">தமிழ்</button>
      </div>
      <h1>{t('Past Papers', 'கடந்த பரீட்சை வினாத்தாள்கள்')}</h1>
      <p>{t('O/L Science · Physics questions only', 'சா/த விஞ்ஞானம் · பௌதிகவியல் வினாக்கள் மட்டும்')}</p>
      <p id="pp-status" role="status">{msg.text}{msg.retry && <> <button type="button" onClick={() => void sync()}>{t('Retry sync', 'மீண்டும் ஒத்திசைக்கவும்')}</button></>}</p>
      {tr(yearBank.coverageNote) && <p class="pp-notice">{tr(yearBank.coverageNote)}</p>}
      <details class="pp-notice">
        <summary>{t('Model answers · teacher review pending', 'மாதிரி விடைகள் · ஆசிரியர் மீளாய்வு நிலுவையில்')}</summary>
        <p>{tr(yearBank.editorialNote)}</p>
        {yearBank.keySource && <a href={yearBank.keySource} target="_blank" rel="noopener">{t('Department of Examinations MCQ key', 'பரீட்சைத் திணைக்களத் தெரிவு விடைகள்')}</a>}
        {yearBank.sourcePdf && <p><a href={yearBank.sourcePdf} target="_blank" rel="noopener">{t('Open original Science PDF (all subjects)', 'மூலத் தமிழ் PDF ஐத் திறக்கவும்')}</a></p>}
      </details>

      {!active && (
        <section aria-label="Question filters">
          <label><span>{t('Year', 'ஆண்டு')}</span>
            <select value={String(year)} onChange={(e) => chooseYear(Number((e.target as HTMLSelectElement).value))}>
              {catalog.papers.filter((p) => p.bank && p.scope === 'physics').map((p) => <option value={String(p.year)}>{p.examLabel}</option>)}
            </select>
          </label>
          <details class="pp-filter-panel" open={typeof innerWidth === 'number' && innerWidth > 760}>
            <summary>{t('Filter questions', 'வினாக்களை வடிகட்டுக')}</summary>
            <div class="pp-filters">
              <label><span>{t('Question type', 'வினா வகை')}</span>
                <select value={f.type} onChange={(e) => setFilter('type', (e.target as HTMLSelectElement).value)}>
                  <option value="">{t('All types', 'எல்லா வகைகளும்')}</option><option value="mcq">{t('MCQ', 'தெரிவு')}</option><option value="written">{t('Written', 'எழுத்து')}</option>
                </select></label>
              <label><span>{t('Topic', 'தலைப்பு')}</span>
                <select value={f.topic} onChange={(e) => setFilter('topic', (e.target as HTMLSelectElement).value)}>
                  <option value="">{t('All topics', 'எல்லாத் தலைப்புகளும்')}</option>{topics.map((s) => <option value={s}>{topicName(s)}</option>)}
                </select></label>
              <label><span>{t('Review', 'மீள்பார்வை')}</span>
                <select value={f.review} onChange={(e) => setFilter('review', (e.target as HTMLSelectElement).value)}>
                  <option value="">{t('All questions', 'எல்லா வினாக்களும்')}</option><option value="saved">{t('Bookmarked', 'சேமிப்புகள்')}</option>
                  <option value="weak">{t('Needs practice', 'பயிற்சி தேவை')}</option><option value="unattempted">{t('Not attempted', 'முயற்சிக்காதவை')}</option>
                </select></label>
              <label><span>{t('Search (Tamil / English)', 'தேடல் (தமிழ் / ஆங்கிலம்)')}</span>
                <input type="search" maxLength={120} value={f.search} onInput={(e) => setFilter('search', (e.target as HTMLInputElement).value)} /></label>
            </div>
            {lesson && <p>{t('Showing questions linked to this lesson. Clear filters to see the whole paper.', 'இப்பாடத்துடன் இணைந்த வினாக்கள். முழுத்தாளுக்கும் வடிகட்டிகளை நீக்கவும்.')}</p>}
            <button type="button" onClick={() => { setF({ type: '', topic: '', review: '', search: '' }); setLesson(''); setCurrent(undefined); }}>{t('Clear filters', 'வடிகட்டிகளை நீக்கவும்')}</button>
          </details>
          <p class="pp-stats">{t(`${attempted.length}/${rows.length} questions attempted · ${right}/${mcqs.length} latest MCQs correct · ${saved} bookmarked`,
            `${rows.length} இல் ${attempted.length} வினாக்கள் முயற்சிக்கப்பட்டன · அண்மைய தெரிவு விடைகள் ${right}/${mcqs.length} சரி · ${saved} சேமிப்புகள்`)}</p>
          <div class="pp-exam-actions">
            <button type="button" onClick={() => void startExam('I')}>{t('Physics MCQ practice · no time limit', 'பௌதிகவியல் தெரிவுப் பயிற்சி · நேர வரம்பு இல்லை')}</button>
            <button type="button" onClick={() => void startExam('II')}>{t('Physics written practice · no time limit', 'பௌதிகவியல் எழுத்துப் பயிற்சி · நேர வரம்பு இல்லை')}</button>
          </div>
        </section>
      )}
      {active && (
        <section class="pp-exam-bar" aria-label="Paper practice">
          <h2>{st.exam!.year + ' · ' + t('Paper practice ', 'தாள் பயிற்சி ') + st.exam!.paper}</h2>
          <p>{tr(yearBank.papers.find((p) => p.id === st.exam!.paper)?.instructions)}</p>
          <p>{t(`${examAnswered}/${st.exam!.selected.length} selected questions have a response.`, `${st.exam!.selected.length} தெரிவு வினாக்களில் ${examAnswered} இற்கு விடை உள்ளது.`)}</p>
          <button type="button" onClick={() => void finishExam()}>{t('Submit paper', 'தாளைச் சமர்ப்பிக்கவும்')}</button>
          <button type="button" onClick={() => void leaveExam()}>{t('Leave paper practice', 'தாள் பயிற்சியிலிருந்து வெளியேறுக')}</button>
        </section>
      )}
      {st.exam?.submitted && (st.exam.year || 2015) === year && <p class="pp-result" role="status">{st.exam.score !== undefined ? examResult(st.exam) : st.exam.result}</p>}

      <p id="pp-nav-help" class="pp-sr">{t('Use arrow keys to browse question buttons; Enter opens the question.', 'அம்புக்குறி விசைகளால் வினா பொத்தான்களை உலாவுக; Enter வினாவைத் திறக்கும்.')}</p>
      <div class="pp-layout">
        <nav id="pp-list" ref={list} aria-label="Question navigation" aria-describedby="pp-nav-help">
          {visible.map((x, i) => {
            const prev = latest(st, x);
            const meta = active && x.paper === 'II' ? (st.exam!.selected.includes(x.id) ? ' ✓' : t(' · optional', ' · தெரிவு'))
              : prev ? (weak(st, x) ? ' · ↻' : hasResponse(prev.result) ? ' · ✓' : t(' · not answered', ' · விடையில்லை')) : '';
            return (
              <button type="button" key={x.id} data-q={x.id} tabIndex={x.id === q?.id ? 0 : -1} aria-current={x.id === q?.id ? 'true' : 'false'}
                      onClick={() => go(x.id)}
                      onKeyDown={(e) => {
                        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
                        e.preventDefault();
                        const n = Math.max(0, Math.min(visible.length - 1, i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1)));
                        go(visible[n]!.id, false);
                        setTimeout(() => { const b = list.current?.querySelector<HTMLElement>('[aria-current=true]'); b?.focus(); b?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, 0);
                      }}>
                {qLabel(x)}<span class="pp-nav-meta">{x.subjects.map(subject).join(' · ') + meta}</span>
              </button>
            );
          })}
        </nav>
        <section id="pp-question" ref={area} tabIndex={-1} aria-label={q ? qLabel(q) : undefined}>
          {!q ? <p>{t('No matching questions. Try clearing the filters.', 'பொருந்தும் வினாக்கள் இல்லை. வடிகட்டிகளை நீக்கவும்.')}</p>
            : <QuestionView key={q.id + (active ? ':exam' : '')} q={q} d={draft(q)} prev={latest(st, q)} active={active} lang={lang} t={t} tr={tr} subject={subject} topicName={topicName} qLabel={qLabel}
                            bookmarked={st.bookmarks.includes(q.id)}
                            onBookmark={() => { const s = clone(st); const on = !s.bookmarks.includes(q.id); s.bookmarks = s.bookmarks.filter((x) => x !== q.id); if (on) s.bookmarks.push(q.id); s.bookmarkPending[q.id] = on; persist(s); void sync(); }}
                            onDraft={(d) => { const s = clone(st); if (active) s.exam!.responses[q.id] = d; else s.drafts[q.id] = d; persist(s); }}
                            onDraftNote={() => setMsg({ text: t('Draft saved on this device. Submit or save an attempt to sync it.', 'வரைவு இச்சாதனத்தில் சேமிக்கப்பட்டது. ஒத்திசைக்க முயற்சியைச் சேமிக்கவும் அல்லது சமர்ப்பிக்கவும்.') })}
                            onCheck={(choice) => enqueue(clone(st), [{ id: newId(), question: q.id, mode: 'practice', choice }])}
                            onSaveWritten={(answers, check) => {
                              if (!Object.values(answers).some((a) => a.trim())) { setMsg({ text: t('Write an answer before saving an attempt.', 'முயற்சியைச் சேமிக்குமுன் விடை எழுதவும்.') }); return; }
                              enqueue(clone(st), [{ id: newId(), question: q.id, mode: 'practice', answers: clone(answers), selfCheck: check }]);
                            }}
                            index={visible.indexOf(q)} count={visible.length} onGo={(i) => go(visible[i]!.id)} />}
        </section>
      </div>
      <p class="pp-foot">{t('Written answers use self-checking. Past-paper attempts do not award lesson XP.', 'எழுத்து விடைகளுக்குத் தன்னிலை மதிப்பீடு. வினாத்தாள் முயற்சிகளுக்குப் பாட XP வழங்கப்படாது.')}</p>
      <dialog ref={dlg} aria-labelledby="pp-confirm-title" aria-describedby="pp-confirm-text"
              onClose={() => { const d = dialog; setDialog(null); d?.done(dlg.current?.returnValue === 'ok'); }}>
        <form method="dialog">
          <h2 id="pp-confirm-title">{dialog?.title}</h2>
          <p id="pp-confirm-text">{dialog?.text}</p>
          <button value="cancel">{t('Cancel', 'இரத்து')}</button>
          <button value="ok">{t('Continue', 'தொடர்க')}</button>
        </form>
      </dialog>
    </div>
  );
}

interface ViewProps {
  q: Question; d: Draft; prev?: Attempt; active: boolean; lang: Lang2; bookmarked: boolean; index: number; count: number;
  t: (en: string, ta: string) => string; tr: (o: Tx) => string; subject: (s: string) => string; topicName: (s: string) => string; qLabel: (q: Question) => string;
  onBookmark: () => void; onDraft: (d: Draft) => void; onDraftNote: () => void; onCheck: (choice: number) => void;
  onSaveWritten: (answers: Record<string, string>, check: string | null) => void; onGo: (i: number) => void;
}

function QuestionView(p: ViewProps) {
  const { q, t, tr, active, lang } = p;
  const [d, setD] = useState<Draft>(() => clone(p.d));
  const reveal = !active && p.prev;
  const update = (next: Draft) => {
    const n = { ...next, touched: true };
    setD(n);
    p.onDraft(n);
  };
  const steps = (list?: Tx[]) => (list?.length ? <ol>{list.map((s) => <li>{tr(s)}</li>)}</ol> : null);
  const worked = (list?: Tx[]) => (list?.length ? <><h4>{t('Worked steps', 'விடை காணும் படிகள்')}</h4>{steps(list)}</> : null);
  const intro = (item: { detailedExplanation?: Teaching }) => item.detailedExplanation && (
    <div class="pp-teaching">
      <h4>{t('Concept to understand', 'புரிந்துகொள்ள வேண்டிய கருத்து')}</h4><p>{tr(item.detailedExplanation.concept)}</p>
      <h4>{t('Why this works', 'இது ஏன் பொருந்துகிறது')}</h4><p>{tr(item.detailedExplanation.reasoning)}</p>
    </div>
  );
  const lessonLinks = (ids?: string[]) => (ids?.length ? <p>{t('Review lesson: ', 'பாடத்தை மீள்பார்க: ')}{ids.map((s, k) => <>{k > 0 && ' · '}<a href={`/lessons/${encodeURIComponent(s)}.html`}>{s.replace(/^(g\d+-)?(chapter|unit)-\d+-/, '').replaceAll('-', ' ')}</a></>)}</p> : null);
  const tail = (item: { detailedExplanation?: Teaching; references?: Ref[]; textbookReferenceStatus?: string; lessons?: string[] }) => {
    const dx = item.detailedExplanation;
    if (!dx) return lessonLinks(item.lessons);
    const refs = (item.references || []).filter((r) => r.kind === 'lesson');
    const books = (item.references || []).filter((r) => r.kind === 'textbook').sort((a, b) => (a.language === lang ? 0 : 1) - (b.language === lang ? 0 : 1));
    const range = (r: Ref) => (r.printedPages![0] === r.printedPages![1] ? String(r.printedPages![0]) : r.printedPages!.join('–'));
    const coverage = item.textbookReferenceStatus === 'not-matched' ? t('No matching passage verified in the supplied textbooks for this answer.', 'இவ்விடைக்கு வழங்கிய பாடநூல்களில் பொருத்தமான பகுதி உறுதிப்படுத்தப்படவில்லை.')
      : item.textbookReferenceStatus === 'related-only' ? t('The linked pages explain related principles; they do not directly verify the complete answer.', 'இணைத்த பக்கங்கள் தொடர்புடைய தத்துவங்களை விளக்குகின்றன; முழு விடையையும் நேரடியாக உறுதிப்படுத்தவில்லை.') : '';
    return (
      <>
        <aside class="pp-mistake"><h4>{t('Common mistake', 'பொதுவான தவறு')}</h4><p>{tr(dx.commonMistake)}</p></aside>
        <details class="pp-similar"><summary>{t('Try a similar question', 'இதே போன்ற வினாவை முயற்சிக்கவும்')}</summary><p>{tr(dx.practice.question)}</p>
          <details><summary>{t('Show practice answer', 'பயிற்சி விடையைக் காட்டவும்')}</summary><p>{tr(dx.practice.answer)}</p></details></details>
        <div class="pp-references">
          {refs.length > 0 && <><h4>{t('Lesson chapter references', 'பாட அத்தியாய மேற்கோள்கள்')}</h4>
            <ul>{refs.map((r) => <li><a href={r.url}>{t(`Grade ${r.grade} · Chapter ${r.chapter}: `, `தரம் ${r.grade} · அத்தியாயம் ${r.chapter}: `) + tr(r.title)}</a></li>)}</ul></>}
          <h4>{t('Textbook references', 'பாடநூல் மேற்கோள்கள்')}</h4>
          {books.length > 0 && <ul class="pp-book-references">{books.map((r) => (
            <li><a class="pp-book-ref" href={r.url} target="_blank" rel="noopener">{tr(r.title) + ' · ' + (r.language === 'ta' ? t('Tamil', 'தமிழ்') : t('English', 'ஆங்கிலம்')) + ' · ' + t('printed p. ', 'அச்சுப் ப. ') + range(r)} ↗</a>
              <p>{tr(r.section)} · {r.support === 'direct' ? t('Supports this answer', 'இவ்விடையை ஆதரிக்கிறது') : t('Related reading', 'தொடர்புடைய வாசிப்பு')}</p>
              {r.note && <p class="pp-muted">{tr(r.note)}</p>}</li>))}</ul>}
          {coverage && <p class="pp-muted">{coverage}</p>}
          {books.length > 0 && <p class="pp-muted">{t('Links open the matching PDF page. Printed page numbers differ between Tamil and English editions. These pages support learning; the worked solution remains a model answer.', 'இணைப்புகள் பொருத்தமான PDF பக்கத்தைத் திறக்கும். தமிழ், ஆங்கிலப் பதிப்புகளில் அச்சுப் பக்க எண்கள் வேறுபடும். இவை கற்றலை ஆதரிக்கும்; விடை மாதிரி விடையாகவே உள்ளது.')}</p>}
        </div>
      </>
    );
  };
  const scan = (
    <details class="pp-scan">
      <summary>{t('Original Science source pages · may include other subjects', 'மூலத் தமிழ் பக்கங்கள் · பெரிதாக்க முழுப்படத்தைத் திறக்கவும்')}</summary>
      {q.pages.map((n) => {
        const url = '/lessons/past-papers/' + q.year + '/page-' + String(n).padStart(2, '0') + '.jpg';
        return <><a href={url} target="_blank" rel="noopener">{t('Open source page ' + n + ' ↗', 'மூலப் பக்கம் ' + n + ' ↗')}</a>
          <img src={url} loading="lazy" alt={t('Original Tamil paper, PDF page ' + n + '; digital question text follows the scan.', 'மூலத் தமிழ் வினாத்தாள், PDF பக்கம் ' + n + '; இலக்க வினா உரை கீழே உள்ளது.')} /></>;
      })}
    </details>
  );

  return (
    <>
      <div class="pp-qhead">
        <div><h2>{p.qLabel(q)}</h2><span class="pp-tag">{q.topics.map(p.topicName).join(' · ')}{q.marks ? ' · ' + q.marks + ' ' + t('source marks', 'மூலப் புள்ளிகள்') : ''}</span></div>
        <button type="button" aria-pressed={p.bookmarked} onClick={p.onBookmark}>{t('Bookmark', 'சேமிக்கவும்')}</button>
      </div>
      <p>{tr(q.prompt)}</p>
      {q.figure && <figure><a href={q.figure} target="_blank" rel="noopener"><img src={q.figure} alt={t('Original diagram or typography for question ' + q.number + '; open image for detail.', 'வினா ' + q.number + ' இன் மூலப் படம்; விவரத்திற்கு படத்தைத் திறக்கவும்.')} /></a>
        <figcaption>{t('Original question panel — option numbers follow the scan.', 'மூல வினாப் பகுதி — தெரிவு எண்கள் மூலத்தாளின் வரிசையில்.')}</figcaption></figure>}
      {q.sourceDescription && <p class="pp-muted">{tr(q.sourceDescription)}</p>}
      {q.type === 'mcq' ? (
        <>
          <fieldset class="pp-options"><legend>{t('Choose one answer', 'ஒரு விடையைத் தேர்க')}</legend>
            {q.options!.map((o, i) => <label><input type="radio" name="pp-choice" value={i} checked={d.choice === i} onChange={() => update({ ...d, choice: i })} /><span>{i + 1}. {tr(o)}</span></label>)}
          </fieldset>
          {!active && <><button type="button" class="pp-check" disabled={!Number.isInteger(d.choice)} onClick={() => p.onCheck(d.choice!)}>{t('Check answer', 'விடையைச் சரிபார்க்கவும்')}</button>
            <details><summary>{t('Hint', 'குறிப்பு')}</summary><p>{tr(q.hint)}</p></details></>}
          {reveal && (
            <section class="pp-feedback">
              <h3>{p.prev!.result.correct ? t('Correct on your last attempt', 'அண்மைய முயற்சி சரி') : t('Review your last attempt', 'அண்மைய முயற்சியை மீள்பார்க')}</h3>
              <p>{t('Correct option', 'சரியான தெரிவு')}: {q.correct! + 1}</p>
              {q.editorialWarning && <p class="pp-notice">{tr(q.editorialWarning)}</p>}
              <p>{tr(q.explanation)}</p>
              {intro(q)}{worked(q.steps)}
              <details><summary>{t('Why the other options do not fit', 'ஏனைய தெரிவுகள் ஏன் பொருந்தவில்லை')}</summary><ol>{(q.optionExplanations || []).map((o) => <li>{tr(o)}</li>)}</ol></details>
              {tail(q)}
            </section>
          )}
          {scan}
        </>
      ) : (
        <>
          {scan}
          {q.parts!.map((part, i) => (
            <section class="pp-part">
              <h3>{part.label} · {p.subject(part.subject)}</h3>
              <p>{tr(part.prompt)}</p>
              <label for={`pp-answer-${i}`}>{t('Your answer', 'உங்கள் விடை')}</label>
              <textarea id={`pp-answer-${i}`} data-part={part.label} maxLength={2000} value={d.answers[part.label] || ''}
                        onInput={(e) => { update({ ...d, answers: { ...d.answers, [part.label]: (e.target as HTMLTextAreaElement).value } }); p.onDraftNote(); }} />
              {!active && <>
                <details><summary>{t('Hint', 'குறிப்பு')}</summary><p>{tr(part.hint)}</p></details>
                <details class="pp-solution"><summary>{t('Show model answer · self-check', 'மாதிரி விடை · தன்னிலை மதிப்பீடு')}</summary>
                  <div class="pp-feedback"><p>{tr(part.answer)}</p>{intro(part)}{worked(part.steps)}
                    {q.year === 2015 && DIAGRAMS[q.number + '|' + part.label] && <div dangerouslySetInnerHTML={{ __html: DIAGRAMS[q.number + '|' + part.label]! }} />}
                    {tail(part)}</div></details>
              </>}
            </section>
          ))}
          {!active && <>
            <div class="pp-row">
              <button type="button" onClick={() => p.onSaveWritten(d.answers, null)}>{t('Save written attempt', 'எழுத்து முயற்சியைச் சேமிக்கவும்')}</button>
              <button type="button" onClick={() => p.onSaveWritten(d.answers, 'needs-work')}>{t('Needs more practice', 'மேலும் பயிற்சி தேவை')}</button>
              <button type="button" onClick={() => p.onSaveWritten(d.answers, 'understood')}>{t('I understand after checking', 'சரிபார்த்த பின் புரிந்தது')}</button>
            </div>
            <p>{t('Self-check only; no automatic written marks.', 'தன்னிலை மதிப்பீடு மட்டும்; தானியங்கி எழுத்துப் புள்ளிகள் இல்லை.')}</p>
          </>}
        </>
      )}
      <div class="pp-row">
        <button type="button" disabled={p.index === 0} onClick={() => p.onGo(p.index - 1)}>{t('Previous question', 'முந்தைய வினா')}</button>
        <button type="button" disabled={p.index === p.count - 1} onClick={() => p.onGo(p.index + 1)}>{t('Next question', 'அடுத்த வினா')}</button>
      </div>
    </>
  );
}
