import { useRef, useState } from 'preact/hooks';
import type { SiDict } from '../../lib/si-lookup';
import { Graph, LabGuide, LabStage, Readouts, SHARED, markLab, range, sharedStrings, useLabText, useMissions, usePlayer, type Mission, type Pair } from '../shared';

/*
 * The Interactive Force Lab of chapter 4, Newton's laws (the lesson page's "FORCE LAB", "GUIDED LAB" and "CARTOON LAB
 * STAGE" scripts, ported): set the force F and the mass m, play, and watch the trolley speed up from rest, with the v-t
 * and p-t graphs. On the stage Raja pushes the trolley, loaded with stones for its mass. Missions keep the current page's
 * keys (scx_lab_c4_<n>).
 */

const TMAX = 6;

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ["See Newton's second law at work: the acceleration depends on the force and on the mass. a = F ÷ m.", 'நியூற்றனின் இரண்டாவது விதிய நேரடியா பாரு: முடுக்கம் விசைய, திணிவ பொறுத்தது. a = F ÷ m.'],
  look: ['In the picture: a trolley is pushed along the track (F is the push in newtons, m is how heavy it is in kg). The graphs show its speed and momentum growing.', 'படத்துல: ஒரு தள்ளுவண்டி தண்டவாளத்துல தள்ளப்படுது (F = தள்ளல் நியூட்டன்ல, m = எவ்வளவு பாரம் kg-ல). வரைபுகள் அதோட வேகமும் உந்தமும் கூடுறத காட்டும்.'],
  F: ['Force', 'விசை'],
  m: ['Mass', 'திணிவு'],
  acc: ['Computed acceleration a = F/m =', 'கணக்கிடப்பட்ட முடுக்கம் a = F/m ='],
  t: ['Time, t', 'நேரம், t'],
  v: ['Velocity, v', 'திசைவேகம், v'],
  p: ['Momentum, p = mv', 'உந்தம், p = mv'],
  s: ['Distance moved, s', 'கடந்த தூரம், s'],
  vt: ['Velocity–time graph &nbsp;(gradient = a)', 'திசைவேகம்–நேரம் கிராஃப் &nbsp;(சாய்வு = a)'],
  pt: ['Momentum–time graph &nbsp;(gradient = F)', 'உந்தம்–நேரம் கிராஃப் &nbsp;(சாய்வு = F)'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  'Try a big F with a small m — watch acceleration shoot up! Then keep F the same and increase m — watch acceleration drop. Notice the gradient of the momentum–time graph always equals <b>F</b> — that\'s the deeper truth that "force is the rate of change of momentum"!',
  'F அதிகமா வெச்சு, m குறைவா வெச்சு பாரு — முடுக்கம் அதிகரிக்குறத பாத்துக்கோ! பிறகு F அதே அளவு வெச்சு m மட்டும் அதிகரிச்சு பாரு — முடுக்கம் குறையுறத பாருங்க. &nbsp;&lsquo;உந்தம்–நேரம்&rsquo் கிராஃபோட சாய்வு எப்பவுமே <b>F</b>-க்கு சமமா இருக்குறத கவனிங்க — அதுதான் &lsquo;விசை = உந்தம் மாறுற வேகம்&rsquo் அப்படீங்குற ஆழமான உண்மை!',
];
const TRIES: { l: Pair; F: number; m: number; see: Pair }[] = [
  { l: ['Push 10 N, mass 5 kg', '10 N தள்ளல், 5 kg'], F: 10, m: 5, see: ['a = F ÷ m = 10 ÷ 5 = 2 m/s². The speed goes up by 2 m/s every second.', 'a = F ÷ m = 10 ÷ 5 = 2 m/s². ஒவ்வொரு விநாடியும் வேகம் 2 m/s கூடுது.'] },
  { l: ['Same push, double mass', 'அதே தள்ளல், இரட்டை திணிவு'], F: 10, m: 10, see: ['a = 10 ÷ 10 = 1 m/s². Heavier things speed up more slowly. Double the mass, half the acceleration.', 'a = 10 ÷ 10 = 1 m/s². பாரமான பொருள் மெதுவா வேகமெடுக்கும். திணிவு இரட்டிப்பு, முடுக்கம் பாதி.'] },
  { l: ['Double the push', 'தள்ளல் இரட்டிப்பு'], F: 20, m: 5, see: ['a = 20 ÷ 5 = 4 m/s². Bigger force, bigger acceleration. Double the force, double the acceleration.', 'a = 20 ÷ 5 = 4 m/s². பெரிய விசை, பெரிய முடுக்கம். விசை இரட்டிப்பு, முடுக்கமும் இரட்டிப்பு.'] },
  { l: ['No push at all', 'தள்ளலே இல்ல'], F: 0, m: 5, see: ["F = 0: no unbalanced force, so nothing changes. The trolley stays at rest (Newton's first law).", 'F = 0: சமநிலையற்ற விசை இல்ல, அதனால எதுவும் மாறாது. வண்டி ஓய்வுல நிக்கும் (நியூற்றனின் முதல் விதி).'] },
];
interface S { F: number; m: number; a: number; t: number; v: number; s: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Make the trolley speed up fast (a of 3 or more) and press Play.', 'வண்டி வேகமா வேகமெடுக்கணும் (a = 3 அல்லது அதிகம்), Play அழுத்து.'], test: (s) => s.a >= 3 && s.t > 1 },
  { l: ['Make a exactly 1 m/s² (hint: F equals m) and press Play.', 'a சரியா 1 m/s² ஆகணும் (குறிப்பு: F = m), Play அழுத்து.'], test: (s) => Math.abs(s.a - 1) < 0.001 && s.t > 1 },
  { l: ['Take the push away (F = 0) and press Play: what happens?', 'தள்ளல எடு (F = 0), Play அழுத்து: என்ன ஆகுது?'], test: (s) => s.F === 0 && s.t > 1 },
];

function live(F: number, m: number): Pair {
  const a = F / m;
  if (F === 0) return ['F = 0: no push, so a = 0. The trolley does not speed up or slow down.', 'F = 0: தள்ளல் இல்ல, அதனால a = 0. வண்டி வேகமெடுக்காது, குறையாது.'];
  return ['a = F ÷ m = ' + F + ' ÷ ' + m + ' = ' + a.toFixed(2) + ' m/s². ' + (F > 0 ? 'The speed goes up by ' : 'The speed changes by ') + Math.abs(a).toFixed(2) + ' m/s every second' + (F < 0 ? ' (the push is backwards).' : '.'), 'a = F ÷ m = ' + F + ' ÷ ' + m + ' = ' + a.toFixed(2) + ' m/s². ஒவ்வொரு விநாடியும் வேகம் ' + Math.abs(a).toFixed(2) + ' m/s ' + (F > 0 ? 'கூடுது.' : 'மாறுது (தள்ளல் பின்னாடி).')];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0]]),
  ...TRIES.map((t) => live(t.F, t.m)[0]), 'No push: no change (1st law)', 'speedometer',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any, tx: (p: Pair) => string) {
  const a = S.a, sg = S.F >= 0 ? 1 : -1, px = 280 / Math.max(10, 0.5 * Math.abs(a) * 100);
  H.rect(0, 0, 640, 300, '#fff4e0'); H.rect(0, 246, 640, 54, '#b9a98c'); H.line(0, 246, 640, 246, '#8d7f60', 4); H.cloud(540, 40, 0.8);
  const x = (sg > 0 ? 200 : 440) + sg * H.clamp(Math.abs(S.s) * px, 0, 280);
  const stones = Math.min(7, Math.ceil(S.m / 3));
  H.rect(x - 52, 206, 104, 32, '#8d6e63', 6, '#4e342e'); H.circle(x - 30, 244, 11, '#37474f'); H.circle(x + 30, 244, 11, '#37474f'); H.circle(x - 30, 244, 4, '#eceff1'); H.circle(x + 30, 244, 4, '#eceff1');
  for (let i = 0; i < stones; i++) { const r = Math.floor(i / 4), c = i % 4; H.circle(x - 33 + c * 22 + (r ? 11 : 0), 198 - r * 17, 11, i % 2 ? '#9e9e9e' : '#bdbdbd', 1); }
  H.text(x, 264, 'm = ' + S.m + ' kg', '#4e342e', 14);
  const mv = Math.abs(S.v) > 0.05, ph = t * 9, strong = Math.abs(S.F) >= 14 || S.m >= 14;
  H.raja(x - sg * 84, 246, 0.55, { flip: sg < 0, rot: sg * H.clamp(6 + Math.abs(S.F) * 1.1, 0, 30), aR: 70, aL: 50, fd: mv ? Math.sin(ph) * 6 : 0, fl: mv ? Math.sin(ph) * 5 : 0, eyes: strong ? 'w' : 'n', brow: S.F === 0 ? 'n' : 'down', m: S.F === 0 ? 0.1 : 0.45 });
  if (strong && S.F !== 0) H.sweat(x - sg * 80, 246 - 140, t);
  if (Math.abs(S.F) > 0.5) H.arrow(x - sg * 56 - sg * Math.abs(S.F) * 3.2, 170, x - sg * 56, 170, '#0c9e83', 9);
  H.text(x - sg * 56 - sg * Math.abs(S.F) * 1.6, 156, 'F = ' + S.F + ' N', '#0c9e83', 15);
  const vmax = Math.max(1, Math.abs(a) * 10), ang = H.clamp(Math.abs(S.v) / vmax, 0, 1) * 180;
  const gx = 90, gy = 100; H.circle(gx, gy, 44, '#fff'); H.E('circle', { cx: gx, cy: gy, r: 44, fill: 'none', stroke: '#1b2236', 'stroke-width': 3 });
  H.line(gx, gy, gx + Math.cos(Math.PI + ang * Math.PI / 180) * 36, gy + Math.sin(Math.PI + ang * Math.PI / 180) * 36, '#e53935', 4); H.circle(gx, gy, 5, '#1b2236');
  H.text(gx, gy + 24, Math.abs(S.v).toFixed(1) + ' m/s', '#1b2236', 12); H.text(gx, gy - 54, tx(['speedometer', 'வேகமானி']), '#1b2236', 12);
  H.chittu(590, 246, 0.42, { wL: 20 + Math.sin(t * 5) * 8, m: 0.3 });
  const msg: Pair = S.F === 0 ? ['No push: no change (1st law)', 'தள்ளல் இல்ல: மாற்றம் இல்ல (1வது விதி)'] : ['a = ' + S.F + ' ÷ ' + S.m + ' = ' + a.toFixed(2) + ' m/s²', 'a = ' + S.F + ' ÷ ' + S.m + ' = ' + a.toFixed(2) + ' m/s²'];
  H.say(470, 100, msg, { col: '#e6f6ff', n: 22 });
}

export default function ForceLab({ si = {}, legacy = 'c4' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const html = (p: Pair) => ({ __html: lang === 'ta' ? p[1] : lang === 'si' ? lookup(p[0]) || p[0] : p[0] });
  const [F, setF] = useState(10);
  const [m, setM] = useState(5);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState(-1);
  const sim = useRef({ F: 10, m: 5, t: 0 });
  sim.current = { F, m, t };

  const a = F / m;
  const sAt = (tt: number) => 0.5 * a * tt * tt;
  const vAt = (tt: number) => a * tt;
  const pAt = (tt: number) => m * vAt(tt);
  const state = (): S => { const c = sim.current, ca = c.F / c.m; return { F: c.F, m: c.m, a: ca, t: c.t, v: ca * c.t, s: 0.5 * ca * c.t * c.t }; };
  const { done, touch } = useMissions(legacy, MISSIONS, state, [t, F, m]);

  // the motion from rest: real time, up to 6 s
  usePlayer(playing, setPlaying, (dt) => {
    const nt = Math.min(TMAX, sim.current.t + dt);
    sim.current = { ...sim.current, t: nt };
    setT(nt);
    return nt < TMAX;
  });

  const restart = () => { setPlaying(false); setT(0); sim.current = { ...sim.current, t: 0 }; };
  const setSlider = (which: 'F' | 'm', v: number) => {
    touch();
    if (which === 'F') setF(v); else setM(v);
    sim.current = { ...sim.current, [which]: v };
    restart();
  };
  const togglePlay = () => {
    touch();
    if (playing) return setPlaying(false);
    if (sim.current.t >= TMAX) restart();
    setPlaying(true);
  };
  const tryIt = (i: number) => {
    const tr = TRIES[i]!;
    setChosen(i);
    touch();
    setF(tr.F); setM(tr.m);
    sim.current = { F: tr.F, m: tr.m, t: 0 };
    setT(0); setPlaying(false);
    setTimeout(() => setPlaying(true), 60);
    markLab();
  };

  const [smin, smax] = range(sAt, TMAX);
  const tmap = (s: number) => 40 + (s - smin) / (smax - smin) * 560;
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(F, m)} />
      <LabStage text={text} draw={(tt, H) => drawStage(state(), tt, H, tx)} missions={MISSIONS} done={done} deps={[t, F, m]} />
      <div class="lab-controls">
        <div class="control">
          <label for="fSlider"><span>{tx(W.F)}</span>, F = <b>{F.toFixed(0)}</b> N</label>
          <input type="range" id="fSlider" min="-20" max="20" step="1" value={F} onInput={(e) => setSlider('F', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="control">
          <label for="mSlider"><span>{tx(W.m)}</span>, m = <b>{m.toFixed(0)}</b> kg</label>
          <input type="range" id="mSlider" min="1" max="20" step="1" value={m} onInput={(e) => setSlider('m', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="lab-buttons">
          <button type="button" class="btn primary" onClick={togglePlay}>{tx(playing ? SHARED.pause : SHARED.play)}</button>
          <button type="button" class="btn" onClick={() => { touch(); restart(); }}>{tx(SHARED.reset)}</button>
        </div>
      </div>
      <div class="a-readout"><span>{tx(W.acc)}</span> <b data-ro="a">{a.toFixed(2)} ms⁻²</b></div>
      <Readouts items={[[tx(W.t), t.toFixed(1) + ' s', 't'], [tx(W.v), vAt(t).toFixed(1) + ' m/s', 'v'], [tx(W.p), pAt(t).toFixed(1) + ' kg·m/s', 'p'], [tx(W.s), sAt(t).toFixed(1) + ' m', 's']]} />
      <div class="track-wrap">
        <svg viewBox="0 0 640 90" width="100%" style={{ minWidth: '480px' }} aria-hidden="true">
          <line x1="40" y1="45" x2="600" y2="45" style={{ stroke: 'var(--border)' }} stroke-width="3" />
          <line x1={tmap(0)} y1="31" x2={tmap(0)} y2="59" style={{ stroke: 'var(--text-faint)' }} stroke-width="2" />
          <text x={tmap(0) - 10} y="75" font-size="11" style={{ fill: 'var(--text-faint)' }}>0 m</text>
          <rect x={tmap(sAt(t)) - 11} y="34" width="22" height="22" rx="5" style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} stroke-width="2" />
          <text x={tmap(sAt(t)) - 14} y="25" font-size="12" font-weight="700" style={{ fill: 'var(--text)' }}>{sAt(t).toFixed(1)} m</text>
        </svg>
      </div>
      <div class="graphs-row">
        <div class="graph-box"><div class="gtitle" dangerouslySetInnerHTML={html(W.vt)} /><Graph fn={vAt} t={t} label="v (m/s)" tmax={TMAX} /></div>
        <div class="graph-box"><div class="gtitle" dangerouslySetInnerHTML={html(W.pt)} /><Graph fn={pAt} t={t} label="p (kg·m/s)" tmax={TMAX} /></div>
      </div>
      <p class="lab-hint" dangerouslySetInnerHTML={html(HINT)} />
    </div>
  );
}
