// Sinhala for English strings, as public/static/si.js (and tools/sinhala.py) look them up in a translation memory:
// 1) the exact text, 2) the same with its numbers lifted out ("v = {0} m/s"), 3) built from short phrases ("~Next:").
// The labs build sentences at run time ("Speeding up! v = 3.2 m/s"), so they look them up the same way, in a small
// part of the dictionaries the page gives them (labSinhala): the exact strings they use, the templates and the phrases.

export type SiDict = Record<string, string>;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function swap(str: string, from: string, to: string): string {
  let out = '', i = 0, j: number;
  while ((j = str.indexOf(from, i)) >= 0) {
    const before = j ? str.charAt(j - 1) : ' ', after = str.charAt(j + from.length) || ' ';
    const okB = !/[A-Za-z]/.test(before) || !/[A-Za-z]/.test(from.charAt(0));
    const okA = !/[A-Za-z]/.test(after) || !/[A-Za-z]/.test(from.charAt(from.length - 1));
    out += str.slice(i, j) + (okB && okA ? to : from);
    i = j + from.length;
  }
  return out + str.slice(i);
}

/** A lookup over one or more dictionaries (later ones do not override earlier ones' exact entries). */
export function makeLookup(...dicts: SiDict[]): (en: string) => string | null {
  const dict: SiDict = {}, phrases: [string, string][] = [], prefixes: [string, string][] = [], cache = new Map<string, string | null>();
  for (const d of dicts) {
    for (const [k, v] of Object.entries(d)) {
      if (k.startsWith('~')) phrases.push([k.slice(1), v]);
      else if (k.endsWith('{*}')) prefixes.push([k.slice(0, -3), v]);
      else if (!(norm(k) in dict)) dict[norm(k)] = v;
    }
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  return (en: string) => {
    const k = norm(en);
    if (!k) return null;
    if (k in dict) return dict[k]!;
    if (cache.has(k)) return cache.get(k)!;
    for (const [p, v] of prefixes) if (k.startsWith(p) && k.length > p.length) return v.replace('{*}', k.slice(p.length));
    let out: string | null = null;
    const nums: string[] = [];
    const t = k.replace(/\d+(?:\.\d+)?/g, (m) => { nums.push(m); return '{' + (nums.length - 1) + '}'; });
    if (nums.length && t in dict) out = dict[t]!.replace(/\{(\d+)\}/g, (m, i) => nums[+i] ?? m);
    if (out === null && k.length <= 160 && phrases.length) {
      let r = k;
      for (const [f, to] of phrases) r = swap(r, f, to);
      if (r !== k && !/[A-Za-z]{2,}/.test(r.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ''))) out = r;
    }
    cache.set(k, out);
    return out;
  };
}

/** The part of the dictionaries a lab needs: its own strings' translations, every number template and every phrase. */
export function labSinhala(strings: string[], ...dicts: SiDict[]): SiDict {
  const full = makeLookup(...dicts), out: SiDict = {};
  for (const d of dicts) for (const [k, v] of Object.entries(d)) if (k.startsWith('~') || k.includes('{')) out[k] = v;
  for (const s of strings) {
    const v = full(s);
    if (v) out[norm(s)] = v;
  }
  return out;
}
