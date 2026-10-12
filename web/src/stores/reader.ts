// Read-aloud for a lesson step (public/static/voice.js, "read-aloud for a step"): reads the step's text block by block
// with the phone's voice, the block being read highlighted; tapping a block reads from there. The text is the step's
// content in the student's language as the page shows it (every language is in the page and only the chosen one is
// visible), so what is read is exactly what is on screen. Shared by the Listen button (LessonPlayer) and the reading
// controls (VoiceControls).
import { atom } from 'nanostores';
import { $lang } from './prefs';
import { hasTTS, missingVoice, rate as defaultRate, silence, speak, toast, voicesFor, setVoice, currentVoice } from '../lib/speech';
import { pick, type Tri } from '../lib/lesson-ui';

export interface Reading {
  on: boolean;
  paused: boolean;
  i: number;
  n: number;
  rate: number;
}
export const $reading = atom<Reading>({ on: false, paused: false, i: -1, n: 0, rate: 1 });
export const RATES = [0.9, 1, 1.1, 1.25, 1.5];

const W = {
  noTTS: { en: 'This browser cannot read aloud.', ta: 'இந்த பிரவுசர் படிச்சுக் காட்ட முடியாது.' },
  nothing: { en: 'Nothing to read here.', ta: 'இங்க படிக்க எதுவும் இல்ல.' },
  noVoice: { en: 'No other voice found on this phone.', ta: 'இந்த போன்ல வேற குரல் இல்ல.' },
  voice: { en: 'Voice: ', ta: 'குரல்: ' },
} satisfies Record<string, Tri>;

const SEL = 'h2,h3,h4,p,li,dt,dd,blockquote,figcaption,th,td,.sub,.work,.note,.exq > span:not(.exnum),.qlead,.qpart > .qt,.qz-q,.qz-opt,.qz-explain,.ctitle,.flabel,.fmath,.fnote,.llabel,.ltext,.final-answer,.step-content';
const SKIP = 'nav,button:not(.qz-opt),script,style,svg,.so-player,.so-hint,.stem-toast,.lframe,.kind,.bs-pic,#stem-vp,#stem-qsheet,.stem-lightbox';

let list: HTMLElement[] = [];
let stamp = 0;
const L = (t: Tri) => pick(t, $lang.get());
const calm = () => document.documentElement.classList.contains('stem-calm');

function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
  return null;
}

/** The visible text blocks of the current step (or of the whole lesson on one page), innermost blocks only. */
function collect(): HTMLElement[] {
  const roots = [...document.querySelectorAll<HTMLElement>('.lc section.lstep')].filter((s) => s.offsetParent !== null);
  const all = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>(SEL)]).filter((e) => {
    if (e.closest(SKIP) || e.offsetParent === null || !e.getClientRects().length) return false;
    const t = (e.innerText || '').trim();
    return t.length > 1 && /[\p{L}\p{N}]/u.test(t);
  });
  return all.filter((e) => !all.some((o) => o !== e && e.contains(o)));
}

function firstInView(l: HTMLElement[]): number {
  const top = document.querySelector('.lhead')?.getBoundingClientRect().bottom ?? 0;
  const k = l.findIndex((e) => e.getBoundingClientRect().bottom > top + 30);
  return k < 0 ? 0 : k;
}

function clearHi(): void {
  for (const e of document.querySelectorAll('.stem-reading')) e.classList.remove('stem-reading');
}

function set(p: Partial<Reading>): void {
  $reading.set({ ...$reading.get(), ...p });
}

export function stop(): void {
  stamp++;
  silence();
  clearHi();
  list = [];
  set({ on: false, paused: false, i: -1, n: 0 });
}

export function readAt(i: number): void {
  if (i < 0) i = 0;
  if (i >= list.length) return stop();
  clearHi();
  const el = list[i]!;
  el.classList.add('stem-reading');
  el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
  set({ on: true, paused: false, i, n: list.length });
  const me = ++stamp;
  speak(el.innerText, $lang.get(), undefined, () => {
    const r = $reading.get();
    if (me === stamp && r.on && !r.paused) readAt(r.i + 1);
  }, $reading.get().rate);
}

export function start(): void {
  if (!hasTTS()) return toast(L(W.noTTS));
  if (missingVoice($lang.get())) return;
  list = collect();
  if (!list.length) return toast(L(W.nothing));
  set({ rate: parseFloat(store('stem_rate') ?? '') || defaultRate($lang.get()) });
  readAt(firstInView(list));
}

export function pause(): void {
  stamp++;
  silence();
  set({ paused: true });
}

export function resume(): void {
  readAt($reading.get().i);
}

/** The Listen button: start, pause or go on. */
export function toggle(): void {
  const r = $reading.get();
  if (!r.on) start();
  else if (r.paused) resume();
  else pause();
}

export function step(d: 1 | -1): void {
  stamp++;
  readAt($reading.get().i + d);
}

export function nextRate(): void {
  const r = $reading.get();
  const rate = RATES[(RATES.indexOf(r.rate) + 1) % RATES.length]!;
  store('stem_rate', String(rate));
  set({ rate });
  if (!r.paused) readAt(r.i);
}

/** Cycles through the voices installed on this phone for the language, remembered per language (stem_voice_<lang>). */
export function nextVoice(): void {
  const lg = $lang.get();
  const all = voicesFor(lg);
  if (!all.length) {
    if (!missingVoice(lg)) toast(L(W.noVoice));
    return;
  }
  const k = all.indexOf(currentVoice(lg) as SpeechSynthesisVoice);
  const v = all[(k + 1) % all.length]!;
  setVoice(lg, v.name);
  toast(L(W.voice) + v.name + (all.length > 1 ? ` (${all.indexOf(v) + 1}/${all.length})` : ''));
  const r = $reading.get();
  if (r.on && !r.paused) readAt(r.i);
}

if (typeof document !== 'undefined') {
  // while reading, tapping any block reads on from there
  document.addEventListener('click', (e) => {
    if (!$reading.get().on) return;
    const t = e.target as Element;
    if (t.closest('button:not(.qz-opt), a, input, select, #stem-vp, .lbar')) return;
    const k = list.findIndex((x) => x.contains(t));
    if (k >= 0) {
      stamp++;
      readAt(k);
    }
  });
  // a new language or a hidden page stops reading (voice.js)
  $lang.listen(() => stop());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && $reading.get().on) stop();
  });
  window.addEventListener('pagehide', () => stop());
}
