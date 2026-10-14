import { useRef, useState } from 'preact/hooks';
import type { SiDict } from '../../lib/si-lookup';
import { Graph, LabGuide, LabStage, Readouts, SHARED, Track, markLab, range, sharedStrings, useLabText, useMissions, usePlayer, type Mission, type Pair } from '../shared';

/*
 * The Interactive Resultant Lab of chapter 9 (the lesson page's "RESULTANT FORCE LAB", "GUIDED LAB" and "CARTOON LAB
 * STAGE" scripts, ported): a 5 kg crate pulled right by F1 and left by F2; the resultant R = F1 - F2 moves it from rest.
 * On the stage it is a tug of war, Raja against Chittu. Missions keep the current page's keys (scx_lab_c9_<n>).
 */

const TMAX = 6, MASS = 5;

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ['Find the resultant of two forces that pull in opposite directions. The resultant is the single force that does the job of both.', 'எதிர் எதிர் திசையில இழுக்கும் ரெண்டு விசைகளோட விளையுளை கண்டுபிடி. விளையுள் = ரெண்டோட வேலையையும் செய்யும் ஒரே விசை.'],
  look: ['In the picture: a box has a rightward pull F₁ and a leftward pull F₂. The number R shows the single force left over, and the box moves that way.', 'படத்துல: ஒரு பெட்டிய வலப்பக்கம் F₁, இடப்பக்கம் F₂ இழுக்குது. R-ங்கற எண் மிச்சம் இருக்கும் ஒரே விசைய காட்டும்; பெட்டி அந்தப் பக்கம் நகரும்.'],
  f1: ['Rightward force', 'வலப்புற விசை'],
  f2: ['Leftward force', 'இடப்புற விசை'],
  R: ['Resultant R =', 'விளையுள் விசை R ='],
  balanced: ['(balanced!)', '(சமநிலை!)'],
  t: ['Time, t', 'நேரம், t'],
  v: ['Velocity, v', 'திசைவேகம், v'],
  s: ['Distance moved, s', 'கடந்த தூரம், s'],
  vt: ['Velocity–time graph', 'திசைவேகம்–நேரம் கிராஃப்'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  "Try making F₁ and F₂ equal, then hit Play — the box won't move! Now bump up F₁ slightly — watch a resultant appear and the box start moving.",
  'F₁ ஐயும் F₂ ஐயும் சமமா வெச்சு பாரு — &lsquo;தள்ளிப் பாக்கு&rsquo் அழுத்தினா பெட்டி அசையாதே! இப்போ F₁ ஐ கொஞ்சம் அதிகரிச்சு பாரு — விளையுள் விசை உண்டாகி பெட்டி நகர ஆரம்பிக்குறத பாருங்க.',
];
const TRIES: { l: Pair; f1: number; f2: number; see: Pair }[] = [
  { l: ['Right pull is bigger', 'வலப்பக்கம் பெரிசு'], f1: 15, f2: 8, see: ['R = 15 − 8 = 7 N to the right. The box moves right, towards the bigger force.', 'R = 15 − 8 = 7 N வலப்பக்கம். பெட்டி பெரிய விசை பக்கம், வலப்பக்கம் நகருது.'] },
  { l: ['Equal pulls', 'சம இழுவை'], f1: 12, f2: 12, see: ['R = 12 − 12 = 0. Equal opposite forces cancel, so the box does not move at all.', 'R = 12 − 12 = 0. சம, எதிர் விசைகள் கான்சல் ஆகுது, அதனால பெட்டி நகரவே நகராது.'] },
  { l: ['Left pull is bigger', 'இடப்பக்கம் பெரிசு'], f1: 8, f2: 15, see: ['R = 15 − 8 = 7 N to the left. The box moves left. The resultant always points the way of the bigger force.', 'R = 15 − 8 = 7 N இடப்பக்கம். பெட்டி இடப்பக்கம் நகருது. விளையுள் எப்பவும் பெரிய விசை திசையிலதான்.'] },
];
interface S { F1: number; F2: number; R: number; s: number; v: number; t: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Make the two pulls EQUAL so the crate does not move (R = 0).', 'ரெண்டு இழுவையும் சமமா வை, பெட்டி நகரக்கூடாது (R = 0).'], test: (s) => s.F1 === s.F2 && s.F1 > 0 },
  { l: ['Make Raja win: the crate must slide to the RIGHT. Press Play.', 'ராஜா ஜெயிக்கணும்: பெட்டி வலப்பக்கம் நகரணும். Play அழுத்து.'], test: (s) => s.F1 > s.F2 && s.s > 1 },
  { l: ['Make Chittu win: the crate must slide to the LEFT. Press Play.', 'சிட்டு ஜெயிக்கணும்: பெட்டி இடப்பக்கம் நகரணும். Play அழுத்து.'], test: (s) => s.F2 > s.F1 && s.s < -1 },
];

function live(a: number, b: number): Pair {
  const r = Math.abs(a - b);
  if (r === 0) return ['F₁ = F₂ = ' + a + ' N, so R = 0. The forces cancel and the box stays still.', 'F₁ = F₂ = ' + a + ' N, அதனால R = 0. விசைகள் கான்சல் ஆகுது, பெட்டி நகராது.'];
  return ['R = ' + Math.max(a, b) + ' − ' + Math.min(a, b) + ' = ' + r + ' N to the ' + (a > b ? 'right' : 'left') + '. The box moves that way.', 'R = ' + Math.max(a, b) + ' − ' + Math.min(a, b) + ' = ' + r + ' N ' + (a > b ? 'வலப்பக்கம்' : 'இடப்பக்கம்') + '. பெட்டி அந்தப் பக்கம் நகருது.'];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0]]),
  ...TRIES.map((t) => live(t.f1, t.f2)[0]), 'Equal pulls: nothing moves!',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any) {
  const x0 = 320 + H.clamp(S.s * 7, -70, 70), gy = 250;
  H.rect(0, 0, 640, 300, '#dff2ff'); H.cloud(90, 44, 0.9); H.cloud(450, 34, 1.1); H.rect(0, gy, 640, 50, '#f0d9a0'); H.line(0, gy, 640, gy, '#c9b074', 4);
  H.rect(x0 - 40, gy - 58, 80, 58, '#ff9a4d', 8, '#7a3b10'); H.text(x0, gy - 22, '📦', null, 26);
  H.line(x0 + 40, gy - 30, x0 + 138, gy - 44, '#8d6e63', 5); H.line(x0 - 40, gy - 30, x0 - 138, gy - 44, '#8d6e63', 5);
  const pa = H.clamp(S.F1 / 30, 0, 1), pb = H.clamp(S.F2 / 30, 0, 1);
  H.raja(x0 + 176, gy, 0.55, { flip: true, rot: pa * 24, aL: 70, aR: 70, brow: S.F1 > 0 ? 'down' : 'n', eyes: S.F1 > 20 ? 'w' : 'n', m: S.F1 > 0 ? 0.4 : 0.1 });
  if (S.F1 > 20) H.sweat(x0 + 172, gy - 140, t);
  H.chittu(x0 - 176, gy, 0.5, { rot: -pb * 22, wL: 30 + pb * 40, wR: 30 + pb * 40, m: S.F2 > 0 ? 0.4 : 0.1, eyes: S.F2 > 20 ? 'w' : 'n' });
  if (S.F2 > 20) H.sweat(x0 - 172, gy - 124, t);
  if (S.F1 > 0) H.arrow(x0 + 56, 146, x0 + 56 + S.F1 * 3, 146, '#ff8a3d', 8);
  H.text(x0 + 56 + S.F1 * 1.5, 132, 'F₁ = ' + S.F1 + ' N', '#c0561a', 14);
  if (S.F2 > 0) H.arrow(x0 - 56, 176, x0 - 56 - S.F2 * 3, 176, '#2b8fd0', 8);
  H.text(x0 - 56 - S.F2 * 1.5, 200, 'F₂ = ' + S.F2 + ' N', '#1c6fa8', 14);
  H.rect(230, 18, 180, 34, S.R === 0 ? '#0c9e83' : '#7b2ff7', 10);
  H.text(320, 41, S.R === 0 ? 'R = 0' : 'R = ' + Math.abs(S.R) + ' N ' + (S.R > 0 ? '→' : '←'), '#fff', 17);
  const msg: Pair = S.R === 0 ? ['Equal pulls: nothing moves!', 'சம இழுவை: எதுவும் நகராது!'] : (S.R > 0 ? ['Raja wins by ' + S.R + ' N', 'ராஜா ' + S.R + ' N வித்தியாசத்துல ஜெயிக்கிறான்'] : ['Chittu wins by ' + (-S.R) + ' N', 'சிட்டு ' + (-S.R) + ' N வித்தியாசத்துல ஜெயிக்கிறா']);
  H.say(x0, 108, msg, { col: '#fffbe0' });
}

export default function ResultantLab({ si = {}, legacy = 'c9' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [f1, setF1] = useState(15);
  const [f2, setF2] = useState(8);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState(-1);
  const sim = useRef({ f1: 15, f2: 8, t: 0 });
  sim.current = { f1, f2, t };

  const R = f1 - f2, a = R / MASS;
  const sAt = (tt: number) => 0.5 * a * tt * tt;
  const vAt = (tt: number) => a * tt;
  const state = (): S => { const c = sim.current, ca = (c.f1 - c.f2) / MASS; return { F1: c.f1, F2: c.f2, R: c.f1 - c.f2, s: 0.5 * ca * c.t * c.t, v: ca * c.t, t: c.t }; };
  const { done, last, touch } = useMissions(legacy, MISSIONS, state, [t, f1, f2]);

  // the motion from rest: real time, up to 6 s
  usePlayer(playing, setPlaying, (dt) => {
    const nt = Math.min(TMAX, sim.current.t + dt);
    sim.current = { ...sim.current, t: nt };
    setT(nt);
    return nt < TMAX;
  });

  const restart = () => { setPlaying(false); setT(0); sim.current = { ...sim.current, t: 0 }; };
  const setSlider = (which: 'f1' | 'f2', v: number) => {
    touch();
    if (which === 'f1') setF1(v); else setF2(v);
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
    setF1(tr.f1); setF2(tr.f2);
    sim.current = { f1: tr.f1, f2: tr.f2, t: 0 };
    setT(0); setPlaying(false);
    setTimeout(() => setPlaying(true), 60);
    markLab();
  };

  const dir = R > 0.01 ? '→' : R < -0.01 ? '←' : tx(W.balanced);
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(f1, f2)} />
      <LabStage text={text} draw={(tt, H) => drawStage(state(), tt, H)} missions={MISSIONS} done={done} deps={[t, f1, f2]} note={last >= 0 ? tx(SHARED.missionDone) + tx(SHARED.now) + tx(live(f1, f2)) : ''} />
      <div class="lab-controls">
        <div class="control">
          <label for="f1Slider"><span>{tx(W.f1)}</span>, F<sub>1</sub> = <b>{f1.toFixed(0)}</b> N</label>
          <input type="range" id="f1Slider" min="0" max="30" step="1" value={f1} onInput={(e) => setSlider('f1', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="control">
          <label for="f2Slider"><span>{tx(W.f2)}</span>, F<sub>2</sub> = <b>{f2.toFixed(0)}</b> N</label>
          <input type="range" id="f2Slider" min="0" max="30" step="1" value={f2} onInput={(e) => setSlider('f2', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="lab-buttons">
          <button type="button" class="btn primary" onClick={togglePlay}>{tx(playing ? SHARED.pause : SHARED.play)}</button>
          <button type="button" class="btn" onClick={() => { touch(); restart(); }}>{tx(SHARED.reset)}</button>
        </div>
      </div>
      <div class="a-readout"><span>{tx(W.R)}</span> <b data-ro="R">{Math.abs(R).toFixed(1)} N {dir}</b></div>
      <Readouts items={[[tx(W.t), t.toFixed(1) + ' s', 't'], [tx(W.v), vAt(t).toFixed(1) + ' m/s', 'v'], [tx(W.s), sAt(t).toFixed(1) + ' m', 's']]} />
      <Track s={sAt(t)} span={range(sAt, TMAX)} />
      <div class="graphs-row">
        <div class="graph-box"><div class="gtitle">{tx(W.vt)}</div><Graph fn={vAt} t={t} label="v (m/s)" tmax={TMAX} w={560} h={200} x1={540} ybot={170} ends={false} /></div>
      </div>
      <p class="lab-hint" dangerouslySetInnerHTML={{ __html: lang === 'ta' ? HINT[1] : lang === 'si' ? lookup(HINT[0]) || HINT[0] : HINT[0] }} />
    </div>
  );
}
