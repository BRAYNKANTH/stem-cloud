// Progress v2 on the new pages (docs/migration-plan-astro.md, section 3.5). What the student does becomes an event in
// an outbox on the device (IndexedDB, so it survives going offline and closing the page), shown at once, and sent to
// POST /api/v2/events in batches: every 1.5 s while there is something to send, when the page is hidden and when the
// device comes back online. The server applies each event id once and only ever moves forward, so sending again is
// harmless. One-time rewards (a question right for the first time, the lesson finished) have a fixed event id, so a
// reload or a second device can never count them twice.
import { atom, map } from 'nanostores';

export interface V2Event {
  id: string;
  type: 'step_open' | 'step_done' | 'answer' | 'game' | 'xp' | 'badge' | 'day' | 'prefs';
  at: number;
  [k: string]: unknown;
}

export interface LessonProgress {
  steps: Record<string, { opened: number | null; done: number | null }>;
  questions: Record<string, { attempts: number; correct: boolean; first_try: boolean }>;
}

/** XP: the server's total plus what is waiting in the outbox. */
export const $xp = atom<number | null>(null);
/** The lesson on screen, as the server knows it plus this device's events. */
export const $lesson = map<LessonProgress>({ steps: {}, questions: {} });
/** The latest reward, for the "+10 XP" message. */
export const $reward = atom<{ amount: number; n: number } | null>(null);

const DB = 'stem-progress';
const STORE = 'outbox';
const OWNER = 'stem_outbox_owner';
let user: number | null = null;
let lessonId = '';
let sending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let rewards = 0;

const now = () => Math.floor(Date.now() / 1000);

/** A random id for an event that may happen many times (an answer, opening a step). */
export function randomId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return 'e' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** A fixed id for something that counts once (FNV-1a of the description), so repeating it is a duplicate. */
export function onceId(what: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < what.length; i++) {
    h1 = Math.imul(h1 ^ what.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ what.charCodeAt(i), 2246822519);
  }
  return 'o' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + what.length.toString(36);
}

// ------------------------------------------------------------------ the outbox (IndexedDB; memory if it is not available)
let memory: V2Event[] = [];
function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = t.onabort = () => resolve(undefined);
  });
}
async function pending(): Promise<V2Event[]> {
  const all = await tx<V2Event[]>('readonly', (s) => s.getAll());
  return all ?? memory;
}
async function put(e: V2Event): Promise<void> {
  memory = [...memory.filter((x) => x.id !== e.id), e];
  await tx('readwrite', (s) => { s.put(e); });
}
async function drop(ids: string[]): Promise<void> {
  memory = memory.filter((x) => !ids.includes(x.id));
  await tx('readwrite', (s) => { ids.forEach((i) => s.delete(i)); });
}
async function clear(): Promise<void> {
  memory = [];
  await tx('readwrite', (s) => { s.clear(); });
}

// ------------------------------------------------------------------ sending
async function flush(keepalive = false): Promise<void> {
  if (sending || user === null || !navigator.onLine) return;
  const batch = (await pending()).slice(0, 200);
  if (!batch.length) return;
  sending = true;
  try {
    const r = await fetch('/api/v2/events', {
      method: 'POST', credentials: 'same-origin', keepalive,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' },
      body: JSON.stringify({ events: batch }),
    });
    if (r.ok) {
      // applied, already seen, or refused for good: none of them needs sending again
      await drop(batch.map((e) => e.id));
    }
  } catch {
    /* offline: try again later */
  } finally {
    sending = false;
  }
  if ((await pending()).length) schedule();
}
function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, 1500);
}

/** Records an event: on screen at once, in the outbox until the server has it. */
export async function record(e: Omit<V2Event, 'at'> & { at?: number }): Promise<void> {
  const ev = { at: now(), ...e } as V2Event;
  applyLocally(ev);
  if (user === null) return;               // not signed in (the page is login-only, so only while it is starting)
  await put(ev);
  schedule();
}

function applyLocally(e: V2Event): void {
  const l = $lesson.get();
  if ((e.type === 'step_open' || e.type === 'step_done') && e.lesson === lessonId) {
    const s = l.steps[e.step as string] ?? { opened: null, done: null };
    $lesson.setKey('steps', { ...l.steps, [e.step as string]: { opened: s.opened ?? e.at, done: e.type === 'step_done' ? s.done ?? e.at : s.done } });
  }
  if (e.type === 'answer') {
    const q = l.questions[e.question as string] ?? { attempts: 0, correct: false, first_try: false };
    $lesson.setKey('questions', { ...l.questions, [e.question as string]: { attempts: q.attempts + 1, correct: q.correct || !!e.correct, first_try: q.attempts === 0 ? !!e.correct : q.first_try } });
  }
}

/** The lesson on screen (set by start). */
export const currentLesson = (): string => lessonId;

/** XP once for this reason (a fixed event id): shown at once, counted by the server only the first time. */
export async function reward(reason: string, amount: number): Promise<void> {
  const id = onceId('xp:' + lessonId + ':' + reason);
  const seen = await pending();
  if (seen.some((e) => e.id === id) || claimed.has(id)) return;
  claimed.add(id);
  try {
    localStorage.setItem('stem_claimed', JSON.stringify([...claimed].slice(-2000)));
  } catch {
    /* private mode */
  }
  $xp.set(($xp.get() ?? 0) + amount);
  $reward.set({ amount, n: ++rewards });
  await record({ id, type: 'xp', source: reason.slice(0, 120).replace(/[^a-z0-9._:/-]/g, '-').replace(/^-+|-+$/g, '') || 'lesson', amount });
}
const claimed = new Set<string>();

// ------------------------------------------------------------------ starting a page
/** Who is signed in, the lesson on screen, and what the server already has; then today's activity day. */
export async function start(lesson: string): Promise<void> {
  lessonId = lesson;
  try {
    for (const id of JSON.parse(localStorage.getItem('stem_claimed') || '[]')) claimed.add(id);
  } catch {
    /* private mode */
  }
  try {
    const me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null));
    user = me?.user?.id ?? null;
  } catch {
    user = null;
  }
  // a shared phone: what another student left in the outbox is theirs, not this student's
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER);
    if (user !== null) localStorage.setItem(OWNER, String(user));
  } catch {
    /* private mode */
  }
  if (user !== null && owner !== null && owner !== String(user)) {
    await clear();
    claimed.clear();
    try {
      localStorage.removeItem('stem_claimed');
    } catch {
      /* private mode */
    }
  }
  if (user === null) return;
  const waiting = await pending();
  try {
    const [sum, les] = await Promise.all([
      fetch('/api/v2/progress/summary', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/v2/progress?lesson=' + encodeURIComponent(lesson), { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (sum) $xp.set(sum.xp + waiting.filter((e) => e.type === 'xp').reduce((n, e) => n + (e.amount as number), 0));
    if (les) $lesson.set({ steps: les.steps, questions: les.questions });
  } catch {
    /* offline: what the device has */
  }
  waiting.forEach(applyLocally);
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await record({ id: onceId('day:' + day), type: 'day', day });
  void flush();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { void flush(true); last(); }
  });
  window.addEventListener('pagehide', () => { void flush(true); last(); });
}

/**
 * Leaving the page: this page's events (memory: written at once, before the outbox's own write has finished) go in one
 * keepalive request too, whether or not a batch is on its way, so an event made just before leaving (the last chip of
 * a game) is not lost if the page goes before the outbox has it. Sending one twice is harmless (the server applies an
 * event id once); the outbox drops them when its own batch is answered.
 */
function last(): void {
  if (user === null || !memory.length) return;
  try {
    void fetch('/api/v2/events', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' },
      body: JSON.stringify({ events: memory.slice(-200) }),
    }).catch(() => {});
  } catch {
    /* the browser refused it: the outbox still has what it wrote */
  }
}
