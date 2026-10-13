import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SiDict } from '../lib/si-lookup';
import { makeDraw } from './slider/draw';
import { LabGuide, LabStage, markLab, useLabText, useMissions, type Mission, type Pair } from './shared';

/*
 * The lesson pages' slider labs (hydrostatic pressure to electromagnetism: one template, nine labs), rebuilt. Each lab
 * is lifted from its page by tools/slider_labs.py (labs/slider/): its sliders, and its own functions unchanged, the
 * picture (CFG.readout, CFG.draw with the drawing kit), the guide (LAB) and the stage (STAGE: read, missions, draw).
 * This draws them the way the page does: sliders, the two-part readout, the picture, the guide and the stage with its
 * missions (kept under the current page's keys, scx_lab_<key>_<n>).
 */

export interface SliderControl { id: string; name: Pair; mid: string; unit: string; min: number; max: number; step: number; value: number }
export interface SliderLabModule {
  META: { lesson: string; legacy: string; controls: SliderControl[]; viewBox: string; hint: Pair };
  STRINGS: string[];
  build: (T: (en: string, ta: string) => string, TT: (p: Pair) => string, APP_LANG: string, value: (id: string) => number) => {
    CFG: { readout: (v: Record<string, number>) => { a: Pair; b: Pair; good: boolean }; draw: (v: Record<string, number>, D: any, TT: (p: Pair) => string) => void };
    LAB: { goal: Pair; look: Pair; tries: { l: Pair; set?: Record<string, number>; see: Pair }[]; live?: () => Pair };
    STAGE: { read: () => any; missions: { en: string; ta: string; test: (s: any) => boolean }[]; draw: (s: any, t: number, H: any) => void };
  };
}

// legacy is the lesson's id on the current site; the missions use the page's own key (META.legacy), which can differ
export default function SliderLab({ lab, si = {} }: { lab: SliderLabModule; si?: SiDict; legacy?: string }) {
  const { META } = lab;
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(META.controls.map((c) => [c.id, c.value])));
  const [chosen, setChosen] = useState(-1);
  const vals = useRef(v);
  vals.current = v;
  // the page's own code, with its language helpers and the sliders' values
  const { CFG, LAB, STAGE } = useMemo(() => lab.build((en, ta) => tx([en, ta]), tx, lang === 'ta' ? 'ta' : 'en', (id) => vals.current[id] ?? 0), [lang, lookup]);
  const missions: Mission<any>[] = useMemo(() => STAGE.missions.map((m) => ({ l: [m.en, m.ta] as Pair, test: m.test })), [STAGE]);
  const { done, touch } = useMissions(META.legacy, missions, () => STAGE.read(), [v]);
  const set = (id: string, x: number) => { touch(); setV({ ...vals.current, [id]: x }); };
  const tryIt = (i: number) => {
    const tr = LAB.tries[i]!;
    setChosen(i);
    touch();
    const next = { ...vals.current };
    for (const [k, x] of Object.entries(tr.set ?? {})) next[k.replace(/Slider$/, '')] = x;
    setV(next);
    markLab();
  };

  // the picture, redrawn on every change
  const pic = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = pic.current;
    if (!svg) return;
    const D = makeDraw(svg, lang === 'si' ? lookup : null);
    D.clear();
    try { CFG.draw(v, D, tx); } catch (e) { console.warn('lab picture', e); }
  }, [v, CFG]);

  let r: { a: Pair; b: Pair; good: boolean } | null = null;
  try { r = CFG.readout(v); } catch { /* shown empty */ }
  let now: Pair | null = null;
  try { now = LAB.live ? LAB.live() : null; } catch { /* nothing to say */ }
  const html = (p: Pair) => ({ __html: lang === 'ta' ? p[1] : lang === 'si' ? lookup(p[0]) || p[0] : p[0] });
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={LAB.goal} look={['In the picture: ' + LAB.look[0], 'படத்துல: ' + LAB.look[1]]} tries={LAB.tries} chosen={chosen} onTry={tryIt} now={now} />
      <LabStage text={text} draw={(t, H) => STAGE.draw(STAGE.read(), t, H)} missions={missions} done={done} deps={[v]} />
      <div class="lab-controls">
        {META.controls.map((c) => (
          <div class="control">
            <label for={c.id + 'Slider'}><span>{tx(c.name)}</span><span dangerouslySetInnerHTML={{ __html: c.mid }} /><b data-ro={c.id}>{String(v[c.id])}</b> <span dangerouslySetInnerHTML={{ __html: c.unit }} /></label>
            <input type="range" id={c.id + 'Slider'} min={c.min} max={c.max} step={c.step} value={v[c.id]} onInput={(e) => set(c.id, parseFloat((e.target as HTMLInputElement).value))} />
          </div>
        ))}
      </div>
      <div class="a-readout">
        <b data-ro="a">{r ? tx(r.a) : ''}</b>{' · '}<b data-ro="b" style={{ color: r?.good ? 'var(--good)' : 'var(--accent-3)' }}>{r ? tx(r.b) : ''}</b>
      </div>
      <div class="lab-svg-wrap">
        <svg ref={pic} viewBox={META.viewBox} role="img" aria-label="lab" />
      </div>
      <p class="lab-hint" dangerouslySetInnerHTML={html(META.hint)} />
    </div>
  );
}
