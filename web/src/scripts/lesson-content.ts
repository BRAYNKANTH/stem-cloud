// The lesson content's own behaviour, from the current lesson pages: worked examples' reveal buttons, textbook questions'
// parts in rows and full-screen diagrams (public/static/questions.js).
//
// Reveal buttons (the lesson pages' "STEP-REVEAL FOR SAMPLE QUESTIONS" script): a worked
// example shows its marking steps one at a time, then "Show final answer". Each language has its own copy of an example
// (components/lesson/T.astro), so what is revealed is kept per example and applied to every copy, and switching
// language keeps the student's place. Without JavaScript everything is shown (styles/lesson.css).
// The activities' "I tried it! (+XP)" buttons stay hidden: the activities have no ids to keep progress under yet.
import { reward } from '../stores/progress';

const shown = new Map<string, number>();      // example id -> marking steps revealed (steps + 1 = final answer shown too)

function apply(card: HTMLElement, n: number): void {
  for (const wrap of card.querySelectorAll<HTMLElement>('[data-qcard]')) {
    const steps = [...wrap.querySelectorAll<HTMLElement>(':scope > .step')];
    steps.forEach((step, i) => {
      step.hidden = i > n;
      step.querySelector('.step-content')?.classList.toggle('hidden', i >= n);
      const t = step.querySelector<HTMLElement>('.step-toggle');
      if (t) t.hidden = i < n;
    });
    const box = wrap.parentElement ?? card;
    box.querySelector('.final-toggle')?.classList.toggle('hidden', n !== steps.length);
    box.querySelector('.final-answer')?.classList.toggle('hidden', n <= steps.length);
  }
}

function setUp(): void {
  for (const card of document.querySelectorAll<HTMLElement>('.lc .qcard[data-ex]')) apply(card, 0);
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('.lc .step-toggle, .lc .final-toggle');
    const card = btn?.closest<HTMLElement>('.qcard[data-ex]');
    if (!btn || !card) return;
    const id = card.dataset.ex!;
    const n = shown.get(id) ?? 0;
    shown.set(id, n + 1);
    apply(card, n + 1);
    // the final answer of a worked example: 15 XP once (progress v2), as on the current pages
    const steps = card.querySelector('[data-qcard]')?.querySelectorAll(':scope > .step').length ?? 0;
    if (n + 1 > steps) void reward('worked:' + id, 15);
  });
}

setUp();

// ---------------------------------------------------------------- textbook questions on phones (public/static/questions.js)
// 1. "(i) ... (ii) ... (iii) ..." (or (a) (b) (c)) written inline becomes aligned rows, one part per row. Every language
//    copy is in the page, so this runs once.
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
const LET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function split(html: string): string | null {
  const re = /(^|[\s>])\((i{1,3}|iv|v|vi{1,3}|ix|x|[a-h])\)\s/g;
  const hits: { at: number; label: string; len: number }[] = [];
  for (let m; (m = re.exec(html)); ) hits.push({ at: m.index + m[1]!.length, label: m[2]!, len: m[0].length - m[1]!.length });
  if (hits.length < 2) return null;
  const series = ROMAN.indexOf(hits[0]!.label) === 0 ? ROMAN : LET.indexOf(hits[0]!.label) === 0 ? LET : null;
  if (!series || hits.some((h, k) => series.indexOf(h.label) !== k)) return null;      // must run i, ii, iii ... in order
  const lead = html.slice(0, hits[0]!.at).trim();
  return (lead ? `<span class="qlead">${lead}</span>` : '') + hits.map((h, k) => {
    const end = k + 1 < hits.length ? hits[k + 1]!.at : html.length;
    return `<span class="qpart"><b class="ql">(${h.label})</b><span class="qt">${html.slice(h.at + h.len, end).trim()}</span></span>`;
  }).join('');
}
for (const el of document.querySelectorAll<HTMLElement>('.lc :is(.qtext, .exq > span:not(.exnum), .final-answer)')) {
  if (el.querySelector('.qpart')) continue;
  const r = split(el.innerHTML);       // the lesson's own checked HTML, rearranged
  if (r) {
    el.innerHTML = r;
    el.classList.add('has-parts');
  }
}

// 2. Tap a diagram or figure to open it full screen at a readable size.
const T3 = (en: string, ta: string, si?: string) =>
  `<span data-l="en${si ? '' : ' si'}" lang="en">${en}</span><span data-l="ta" lang="ta">${ta}</span>` + (si ? `<span data-l="si" lang="si">${si}</span>` : '');
const lc = document.querySelector<HTMLElement>('.lc');
let box: HTMLElement | null = null;
let boxFrom: HTMLElement | null = null;

function closeBox(): void {
  if (!box) return;
  box.remove();
  box = null;
  document.removeEventListener('keydown', onEsc);
  boxFrom?.focus();
}
function onEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeBox();
}
function openBox(svg: SVGSVGElement, from: HTMLElement): void {
  closeBox();
  boxFrom = from;
  const vb = (svg.getAttribute('viewBox') || svg.getAttribute('viewbox') || '0 0 560 200').split(/\s+/).map(Number);
  const w = Math.max((vb[2] ?? 560) * 1.5, 640);
  box = document.createElement('div');
  box.className = 'stem-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Diagram');
  box.innerHTML = `<div class="lb-bar"><b>${T3('Diagram', 'படம்')}</b><span>${T3('drag to look around, pinch to zoom', 'இழுத்து பார், இரண்டு விரலால பெரிதாக்கு')}</span><button type="button" aria-label="Close">✕</button></div><div class="lb-body"></div>`;
  const c = svg.cloneNode(true) as SVGSVGElement;
  c.removeAttribute('id');
  c.removeAttribute('style');
  c.removeAttribute('height');
  c.setAttribute('width', String(w));
  c.style.cssText = `width:${w}px;max-width:none;min-width:0;height:auto;display:block`;
  box.querySelector('.lb-body')!.appendChild(c);
  box.querySelector('button')!.addEventListener('click', closeBox);
  box.addEventListener('click', (e) => {
    if (e.target === box) closeBox();
  });
  (lc ?? document.body).appendChild(box);        // inside .lc, where its styles are
  document.addEventListener('keydown', onEsc);
  box.querySelector('button')!.focus();
}

const ZOOM = '.lc .qdiagram, .lc .fig';
for (const el of document.querySelectorAll<HTMLElement>(ZOOM)) {
  const svg = el.querySelector('svg');
  if (!svg) continue;
  const vb = (svg.getAttribute('viewBox') || svg.getAttribute('viewbox') || '').split(/\s+/).map(Number);
  if (el.classList.contains('fig') && vb.length === 4 && vb[2]! > 0) {
    el.style.setProperty('--fw', Math.round(Math.min(vb[2]! * 0.92, 620)) + 'px');      // a readable minimum width on phones (sideways scroll)
    el.style.setProperty('--far', vb[2] + ' / ' + vb[3]);
  }
  el.classList.add('zoomable');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', el.classList.contains('fig') ? 'Open figure full screen' : 'Open diagram full screen');
  const hint = document.createElement('div');
  hint.className = el.classList.contains('fig') ? 'fig-hint' : 'qd-cap';
  hint.innerHTML = el.classList.contains('fig')
    ? T3('⤢ Tap to enlarge', '⤢ பெரிதாக்க தொடு', '⤢ විශාල කිරීමට ස්පර්ශ කරන්න')
    : T3('⤢ Tap the diagram to enlarge', '⤢ பெரிதாக்க படத்த தொடு', '⤢ විශාල කිරීමට ස්පර්ශ කරන්න');
  if (el.classList.contains('fig')) el.appendChild(hint);
  else el.after(hint);
}
document.addEventListener('click', (e) => {
  const t = e.target as Element;
  const el = t.closest<HTMLElement>(ZOOM);
  if (!el || t.closest('button, a, input')) return;
  const svg = el.querySelector('svg');
  if (svg) openBox(svg, el);
});
document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if ((e.key === 'Enter' || e.key === ' ') && el.classList?.contains('zoomable')) {
    e.preventDefault();
    const svg = el.querySelector('svg');
    if (svg) openBox(svg, el);
  }
});
