// Speech for the lesson islands, ported from public/static/voice.js: the phone's own voice (speechSynthesis) with the
// same voice choice, the same rules that make symbols and units sayable, sentence chunks, and recorded lines. Used by
// the story's voices now and by read-aloud (VoiceReader, milestone 5.3).
import type { Lang } from '../stores/prefs';

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
export const hasTTS = (): boolean => !!synth && typeof SpeechSynthesisUtterance !== 'undefined';

let voices: SpeechSynthesisVoice[] = [];
function loadVoices(): void {
  try {
    voices = synth?.getVoices() ?? [];
  } catch {
    voices = [];
  }
}
if (synth) {
  loadVoices();
  try {
    synth.addEventListener('voiceschanged', loadVoices);
  } catch {
    synth.onvoiceschanged = loadVoices;
  }
}

const vlang = (v: SpeechSynthesisVoice) => String(v.lang || '').replace('_', '-').toLowerCase();
const FEMALE = /female|zira|heera|neerja|swara|pallavi|sonia|susan|hazel|samantha|karen|lekha|vani|kalpana|aditi|raveena|priya/i;
const MALE = /\bmale\b|ravi|prabhat|valluvar|hemant|david|mark|guy|daniel|alex|rishi|kumar|madhur/i;

export function hasVoice(lg: Lang): boolean {
  loadVoices();
  return voices.some((v) => vlang(v).startsWith(lg));
}

/** Who speaks: R = Raja (lower), C = Chittu (higher), nobody = the narrator. */
export type Who = 'R' | 'C' | undefined;

function store(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function pickVoice(lg: Lang, who: Who): SpeechSynthesisVoice | null {
  const saved = store('stem_voice_' + lg);                    // the voice the student chose
  if (saved) {
    const sv = voices.find((v) => v.name === saved);
    if (sv) return sv;
  }
  const prefixes = lg === 'ta' ? ['ta'] : lg === 'si' ? ['si'] : ['en-in', 'en-gb', 'en-us', 'en'];
  for (const pre of prefixes) {
    const m = voices.filter((v) => vlang(v).startsWith(pre));
    if (!m.length) continue;
    const good = m.filter((v) => /google|natural|online|neural/i.test(v.name));
    const pool = good.length ? good : m;
    const want = who === 'C' ? FEMALE : who === 'R' ? MALE : null;
    const w = want ? pool.find((v) => want.test(v.name)) : undefined;
    return w ?? pool[0] ?? null;
  }
  return null;
}

// ------------------------------------------------------------------ make symbols and units sayable (voice.js, unchanged)
type Rule = [RegExp, string];
const EN: Rule[] = [
  [/(\d)\s*m\s*s\s*[-−]\s*2\b/g, '$1 metres per second squared'], [/(\d)\s*m\s*s\s*[-−]\s*1\b/g, '$1 metres per second'],
  [/m\s*\/\s*s\s*[²2]/g, 'metres per second squared'], [/m\s*\/\s*s\b/g, 'metres per second'], [/m\s*s\s*[-−]\s*2\b/g, 'metres per second squared'], [/m\s*s\s*[-−]\s*1\b/g, 'metres per second'],
  [/(\d)\s*N\s*m\b/g, '$1 newton metres'], [/(\d)\s*N\b/g, '$1 newtons'], [/(\d)\s*kg\b/g, '$1 kilograms'], [/(\d)\s*km\b/g, '$1 kilometres'], [/(\d)\s*cm\b/g, '$1 centimetres'],
  [/(\d)\s*m\b/g, '$1 metres'], [/(\d)\s*s\b/g, '$1 seconds'], [/(\d)\s*g\b/g, '$1 grams'], [/(\d)\s*°\s*C\b/g, '$1 degrees celsius'], [/(\d)\s*°/g, '$1 degrees'],
  [/F\s*=\s*m\s*a\b/g, 'F equals m a'], [/μ/g, ' mu '], [/Δ/g, ' delta '], [/θ/g, ' theta '], [/√/g, ' square root of '],
  [/×/g, ' times '], [/÷/g, ' divided by '], [/\s[−–-]\s(?=\d)/g, ' minus '], [/=/g, ' equals '], [/\+/g, ' plus '], [/≈/g, ' approximately '], [/≤/g, ' less than or equal to '], [/≥/g, ' greater than or equal to '],
  [/²/g, ' squared'], [/³/g, ' cubed'], [/→|⟶|⇒/g, ', '],
];
const TA: Rule[] = [
  [/(\d)\s*m\s*s\s*[-−]\s*2\b/g, '$1 மீட்டர் பெர் செகண்ட் ஸ்கொயர்'], [/(\d)\s*m\s*s\s*[-−]\s*1\b/g, '$1 மீட்டர் பெர் செகண்ட்'],
  [/m\s*\/\s*s\s*[²2]/g, 'மீட்டர் பெர் செகண்ட் ஸ்கொயர்'], [/m\s*\/\s*s\b/g, 'மீட்டர் பெர் செகண்ட்'],
  [/(\d)\s*N\s*m\b/g, '$1 நியூட்டன் மீட்டர்'], [/(\d)\s*N\b/g, '$1 நியூட்டன்'], [/(\d)\s*kg\b/g, '$1 கிலோகிராம்'], [/(\d)\s*km\b/g, '$1 கிலோமீட்டர்'], [/(\d)\s*cm\b/g, '$1 சென்டிமீட்டர்'],
  [/(\d)\s*m\b/g, '$1 மீட்டர்'], [/(\d)\s*s\b/g, '$1 விநாடி'], [/(\d)\s*g\b/g, '$1 கிராம்'], [/(\d)\s*°/g, '$1 டிகிரி'],
  [/F\s*=\s*m\s*a\b/g, 'எஃப் சமம் எம் ஏ'], [/μ/g, ' மியூ '], [/Δ/g, ' டெல்டா '], [/θ/g, ' தீட்டா '], [/√/g, ' வர்க்கமூலம் '],
  [/×/g, ' பெருக்கல் '], [/÷/g, ' வகுத்தல் '], [/\s[−–-]\s(?=\d)/g, ' கழித்தல் '], [/=/g, ' சமம் '], [/\+/g, ' கூட்டல் '], [/≈/g, ' கிட்டத்தட்ட '],
  [/²/g, ' ஸ்கொயர்'], [/³/g, ' கியூப்'], [/→|⟶|⇒/g, ', '],
];
const SI: Rule[] = [
  [/m\s*s\s*[-−]\s*2\b/g, 'තත්පර වර්ගයකට මීටර්'], [/m\s*s\s*[-−]\s*1\b/g, 'තත්පරයකට මීටර්'],
  [/(\d)\s*kg\b/g, '$1 කිලෝග්‍රෑම්'], [/(\d)\s*cm\b/g, '$1 සෙන්ටිමීටර්'], [/(\d)\s*km\b/g, '$1 කිලෝමීටර්'], [/(\d)\s*N\b/g, '$1 නිව්ටන්'], [/(\d)\s*Hz\b/g, '$1 හර්ට්ස්'], [/(\d)\s*J\b/g, '$1 ජූල්'], [/(\d)\s*W\b/g, '$1 වොට්'], [/(\d)\s*V\b/g, '$1 වෝල්ට්'], [/(\d)\s*A\b/g, '$1 ඇම්පියර්'], [/(\d)\s*m\b/g, '$1 මීටර්'], [/(\d)\s*s\b/g, '$1 තත්පර'], [/(\d)\s*°\s*C\b/g, '$1 සෙල්සියස් අංශක'],
  [/μ/g, ' මියු '], [/λ/g, ' ලැම්ඩා '], [/θ/g, ' තීටා '], [/Δ/g, ' ඩෙල්ටා '], [/×/g, ' ගුණ කිරීම '], [/÷/g, ' බෙදීම '], [/=/g, ' සමානයි '], [/²/g, ' වර්ගය '], [/³/g, ' ඝනය '], [/√/g, ' වර්ගමූලය '],
];
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4' };

export function speakable(text: string, lg: Lang): string {
  let t = String(text).replace(/[₀-₄]/g, (c) => ' ' + SUB[c]);
  t = t.replace(/[←-⇿⌀-⏿☀-➿⬀-⯿️‍]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, ' ');     // emoji and arrows, ticks
  for (const [rx, to] of lg === 'ta' ? TA : lg === 'si' ? SI : EN) t = t.replace(rx, to);
  if (lg === 'ta') t = t.replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** Sentences, split further if very long (some engines stop after about 15 s). */
export function chunks(t: string): string[] {
  const out: string[] = [];
  for (let x of t.match(/[^.!?…]+[.!?…]*\s*/g) ?? [t]) {
    x = x.trim();
    if (!x) continue;
    while (x.length > 190) {
      let cut = x.lastIndexOf(',', 190);
      if (cut < 60) cut = x.lastIndexOf(' ', 190);
      if (cut < 60) cut = 190;
      out.push(x.slice(0, cut + 1));
      x = x.slice(cut + 1).trim();
    }
    if (x) out.push(x);
  }
  return out;
}

// ------------------------------------------------------------------ speaking
let gen = 0;
let audio: HTMLAudioElement | null = null;

export function rate(lg: Lang): number {
  return parseFloat(store('stem_rate') ?? '') || (lg === 'ta' ? 1.1 : 1);    // spoken Tamil is brisk; a slow voice sounds like a news reader
}

/** Stops whatever is speaking or playing. */
export function silence(): void {
  gen++;
  try {
    synth?.cancel();
  } catch {
    /* nothing to stop */
  }
  if (audio) {
    try {
      audio.pause();
    } catch {
      /* already stopped */
    }
    audio = null;
  }
}

/** Says the text with the phone's voice, sentence by sentence. */
export function speak(text: string, lg: Lang, who?: Who, done?: () => void): void {
  silence();
  const my = gen;
  const parts = chunks(speakable(text, lg));
  if (!hasTTS() || !parts.length) {
    done?.();
    return;
  }
  loadVoices();
  let i = 0;
  const next = () => {
    if (my !== gen) return;
    if (i >= parts.length) {
      done?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(parts[i++]!);
    const v = pickVoice(lg, who);
    u.lang = lg === 'ta' ? 'ta-IN' : lg === 'si' ? 'si-LK' : 'en-IN';
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = rate(lg);
    u.pitch = who === 'R' ? 1.12 : who === 'C' ? 1.3 : 1;
    u.onend = next;
    u.onerror = () => {
      if (my === gen) next();
    };
    try {
      synth!.speak(u);
    } catch {
      done?.();
    }
  };
  next();
}

/** Plays a recording; calls fallback (for the phone's voice) if it cannot be played. */
export function play(src: string, lg: Lang, fallback: () => void): void {
  silence();
  const my = gen;
  const a = new Audio(src);
  a.playbackRate = rate(lg);
  try {
    a.preservesPitch = true;
  } catch {
    /* older browsers */
  }
  audio = a;
  const fail = () => {
    if (my === gen) {
      audio = null;
      fallback();
    }
  };
  a.addEventListener('error', fail);
  a.play()?.catch(fail);
}

/** A short message at the bottom of the screen (voice.js toast), for a missing voice. */
export function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'stem-toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  (document.querySelector('.lc') ?? document.body).appendChild(t);      // inside .lc, where its styles are
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 5200);
}

export const NO_TAMIL_VOICE = 'Tamil voice is not installed on this phone. Open Settings, then Text-to-speech (Google), and download the Tamil voice. English reading works now.';
export const NO_SINHALA_VOICE = 'මෙම දුරකථනයේ සිංහල හඬ ස්ථාපනය කර නැත. Settings > Text-to-speech (Google) වෙත ගොස් සිංහල හඬ බාගන්න.';

/** voice.js needTamilVoice: true (and a message) when the phone has no voice for the language. */
export function missingVoice(lg: Lang): boolean {
  if (lg === 'en' || !hasTTS()) return false;
  if (hasVoice(lg)) return false;
  toast(lg === 'ta' ? NO_TAMIL_VOICE : NO_SINHALA_VOICE);
  return true;
}
