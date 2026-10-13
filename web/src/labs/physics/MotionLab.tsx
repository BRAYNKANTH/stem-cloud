import { useRef, useState } from 'preact/hooks';
import type { SiDict } from '../../lib/si-lookup';
import { Graph, LabGuide, LabStage, Readouts, SHARED, markLab, range, sharedStrings, useLabText, useMissions, usePlayer, type Mission, type Pair } from '../shared';

/*
 * The Interactive Motion Lab of unit 2 (the lesson page's "MOTION LAB", "GUIDED LAB" and "CARTOON LAB STAGE" scripts,
 * ported): set the initial velocity u and the acceleration a, play, and watch the body on the track and the v-t and s-t
 * graphs. The guide offers three tries with what to see and says what is happening right now; on the stage Raja runs
 * and Chittu watches (the lesson pages' cartoon engine, labs/engine.js), with three missions. Missions keep the current
 * page's keys on this device (scx_lab_u2_<n>), so a mission done on either page shows on both; they are worth 5 XP each
 * and 10 more for all three, once (progress v2), and they count as doing the lab step.
 */

const TMAX = 10;

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ['Find out how the starting speed (u) and the acceleration (a) change the way a body moves. Acceleration means how much the speed changes every second.', 'ஆரம்ப வேகம் (u), முடுக்கம் (a) ரெண்டும் பொருளோட இயக்கத்த எப்படி மாத்துதுன்னு கண்டுபிடி. முடுக்கம்னா ஒவ்வொரு விநாடியும் வேகம் எவ்வளவு மாறுதுன்னு.'],
  look: ['In the picture: a car runs along the track. Two graphs draw themselves while it moves: speed against time (left) and position against time (right).', 'படத்துல: ஒரு கார் தண்டவாளத்துல ஓடுது. அது ஓடும்போதே ரெண்டு வரைபு வரையப்படுது: நேரத்துக்கு வேகம் (இடது), நேரத்துக்கு இடம் (வலது).'],
  u: ['Initial velocity', 'ஆரம்ப திசைவேகம்'],
  a: ['Acceleration', 'முடுக்கம்'],
  t: ['Time, t', 'நேரம், t'],
  v: ['Velocity, v', 'திசைவேகம், v'],
  s: ['Displacement, s', 'இடப்பெயர்ச்சி, s'],
  d: ['Distance travelled', 'நடந்த தூரம்'],
  vt: ['Velocity–time graph (gradient = acceleration)', 'திசைவேகம்–நேரம் கிராஃப் (சாய்வு = முடுக்கம்)'],
  st: ['Displacement–time graph (gradient = velocity)', 'இடப்பெயர்ச்சி–நேரம் கிராஃப் (சாய்வு = திசைவேகம்)'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  'Notice the <b>distance travelled</b> vs <b>displacement</b> readouts split apart whenever the body reverses direction (try a negative acceleration with a positive u) — the area swept under the v–t graph on each side of zero adds to distance, but cancels out in displacement.',
  '&lsquo;நடந்த தூரம்&rsquo;-உம், &lsquo;இடப்பெயர்ச்சி&rsquo;-உம் — பொருள் திசை மாத்துனா ரெண்டு நம்பரும் வேற வேறா போகுறத பாரு (நெகட்டிவ் முடுக்கத்த பாசிட்டிவ் u வெச்சு டிரை பண்ணு!). v-t கிராஃபுல zero-க்கு இந்தபக்கம் ஒரு ஏரியா, அந்தபக்கம் ஒரு ஏரியா — ரெண்டையும் கூட்டினா தூரம், ஆனா ஒண்ணு ஒண்ணை கான்சல் பண்ணா இடப்பெயர்ச்சி!',
];
const TRIES: { l: Pair; u: number; a: number; see: Pair }[] = [
  { l: ['Steady speed', 'சீரான வேகம்'], u: 5, a: 0, see: ['a = 0, so the speed never changes: 5 m/s every second. The speed graph is a flat line, and the car covers the same distance each second.', 'a = 0, அதனால வேகம் மாறாது: ஒவ்வொரு விநாடியும் 5 m/s. வேக வரைபு தட்டையான கோடு; கார் ஒவ்வொரு விநாடியும் ஒரே தூரம் போகும்.'] },
  { l: ['Speeding up', 'வேகம் கூடுது'], u: 0, a: 2, see: ['It starts from rest and the speed grows by 2 m/s every second, so the speed graph slopes up. The car covers more and more distance each second.', 'ஓய்வுல இருந்து ஆரம்பிச்சு ஒவ்வொரு விநாடியும் வேகம் 2 m/s கூடுது, அதனால வேக வரைபு மேல சாயுது. கார் ஒவ்வொரு விநாடியும் அதிக தூரம் போகுது.'] },
  { l: ['Slowing down, then back', 'மெதுவாகி திரும்புது'], u: 10, a: -2, see: ['The speed drops by 2 m/s every second. After 5 s the car stops, then it goes backwards. Watch: the distance keeps growing, but the displacement turns around.', 'வேகம் ஒவ்வொரு விநாடியும் 2 m/s குறையுது. 5 s-க்கு பிறகு கார் நின்னு, பின்னாடி போக ஆரம்பிக்குது. கவனி: தூரம் கூடிக்கிட்டே இருக்கு, ஆனா இடப்பெயர்ச்சி திரும்புது.'] },
];
interface S { u: number; a: number; t: number; v: number; s: number; d: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Make Raja run faster and faster (a above 0) and press Play.', 'ராஜா இன்னும் இன்னும் வேகமா ஓடணும் (a > 0), Play அழுத்து.'], test: (s) => s.a > 0 && s.t > 1.5 && s.v > s.u + 1 },
  { l: ['Make Raja slow down and stop (u above 0, a below 0).', 'ராஜா மெதுவாகி நிக்கணும் (u > 0, a < 0).'], test: (s) => s.u > 0 && s.a < 0 && s.t > 0.5 && Math.abs(s.v) < 0.6 && s.t > 1 },
  { l: ['Make the distance bigger than the displacement (he turns back).', 'தூரம் இடப்பெயர்ச்சிய விட பெருசாகணும் (அவன் திரும்பி வரணும்).'], test: (s) => s.d > Math.abs(s.s) + 2 },
];

function live(u: number, a: number): Pair {
  if (a === 0) return ['a = 0: the speed stays ' + u + ' m/s all the time, so the speed graph is a flat line.', 'a = 0: வேகம் எப்பவும் ' + u + ' m/s-லயே இருக்கும், அதனால வேக வரைபு தட்டையான கோடு.'];
  if (u * a >= 0) return ['Speeding up: the speed changes by ' + Math.abs(a) + ' m/s every second, so the speed graph slopes ' + (a > 0 ? 'up' : 'down (going backwards faster and faster)') + '.', 'வேகம் கூடுது: ஒவ்வொரு விநாடியும் வேகம் ' + Math.abs(a) + ' m/s மாறுது, அதனால வேக வரைபு ' + (a > 0 ? 'மேல' : 'கீழ (பின்னாடி இன்னும் வேகமா)') + ' சாயுது.'];
  const tt = (Math.abs(u) / Math.abs(a)).toFixed(1);
  return ['Slowing down by ' + Math.abs(a) + ' m/s every second. After ' + tt + ' s the body stops for a moment and then moves the other way, so distance and displacement start to differ.', 'ஒவ்வொரு விநாடியும் வேகம் ' + Math.abs(a) + ' m/s குறையுது. ' + tt + ' s-க்கு பிறகு பொருள் ஒரு நிமிஷம் நின்னு எதிர்ப்பக்கம் போகுது, அதனால தூரமும் இடப்பெயர்ச்சியும் வேறுபட ஆரம்பிக்குது.'];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0]]),
  'Set u and a, then press Play!', 'Steady speed: v stays the same!',
  'He stopped for a moment...', 'distance: ', 'displacement: ',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any, tx: (p: Pair) => string) {
  let max = 20;
  for (let k = 0; k <= 10; k += 0.5) max = Math.max(max, Math.abs(S.u * k + 0.5 * S.a * k * k));
  const px = 250 / max, X = (s: number) => 320 + H.clamp(s * px, -262, 262);
  H.rect(0, 0, 640, 300, '#dff2ff'); H.cloud(70, 42, 0.8); H.cloud(470, 30, 1); H.rect(0, 236, 640, 64, '#9ccf6b'); H.rect(30, 226, 580, 14, '#ece3cb', 7);
  for (let i = -4; i <= 4; i++) { const xx = 320 + i * 62.5; H.line(xx, 226, xx, 240, '#8d7f60', 2); H.text(xx, 262, (i * max / 4).toFixed(0) + ' m', '#4b5a3a', 11); }
  H.line(320, 196, 320, 226, '#555', 3); H.E('polygon', { points: '320,196 342,204 320,212', fill: '#e53935' }); H.text(320, 188, '0', '#555', 12);
  const x = X(S.s), mv = Math.abs(S.v) > 0.05, dir = S.v < -0.05 ? -1 : 1, ph = t * (4 + Math.abs(S.v) * 0.9);
  if (Math.abs(S.v) > 3) for (let j = 0; j < 3; j++) H.line(x - dir * (34 + j * 16), 168 + j * 16, x - dir * (66 + j * 16), 168 + j * 16, '#fff', 4);
  H.raja(x, 236, 0.5, { flip: dir < 0, fd: mv ? Math.sin(ph) * 8 : 0, fl: mv ? Math.sin(ph) * 7 : 0, aL: mv ? Math.sin(ph) * 35 : 0, aR: mv ? -Math.sin(ph) * 35 : 0, rot: dir * Math.min(12, Math.abs(S.v) * 1.2), m: Math.abs(S.v) > 8 ? 0.7 : 0.2, eyes: Math.abs(S.v) > 8 ? 'w' : 'n' });
  if (S.t > 0.3 && Math.abs(S.v) < 0.6 && S.a !== 0) H.dizzy(x, 236 - 128, t, 18);
  H.chittu(60, 236, 0.4, { wL: S.t > 0 ? 30 + Math.sin(t * 8) * 15 : 0, m: 0.3 });
  H.rect(24, 138, 92, 26, '#fff', 8, '#1b2236', 0.95); H.text(70, 156, '⏱ ' + S.t.toFixed(1) + ' s', '#1b2236', 14);
  let msg: Pair;
  if (S.t <= 0.05) msg = ['Set u and a, then press Play!', 'u, a வெச்சு Play அழுத்து!'];
  else if (S.a === 0) msg = ['Steady speed: v stays the same!', 'சீரான வேகம்: v மாறாது!'];
  else if (Math.abs(S.v) < 0.6) msg = ['He stopped for a moment...', 'ஒரு நிமிஷம் நின்னுட்டான்...'];
  else if (S.a * S.v > 0) msg = S.v < 0 ? ['Speeding up backwards! v = ' + S.v.toFixed(1) + ' m/s', 'பின்னாடி வேகம் கூடுது! v = ' + S.v.toFixed(1) + ' m/s'] : ['Speeding up! v = ' + S.v.toFixed(1) + ' m/s', 'வேகம் கூடுது! v = ' + S.v.toFixed(1) + ' m/s'];
  else msg = ['Slowing down! v = ' + S.v.toFixed(1) + ' m/s', 'வேகம் குறையுது! v = ' + S.v.toFixed(1) + ' m/s'];
  H.say(150, 128, msg, { col: '#e6f6ff' });
  H.rect(440, 10, 190, 50, '#fff', 10, '#1b2236', 0.92);
  H.text(450, 30, tx(['distance: ', 'தூரம்: ']) + S.d.toFixed(1) + ' m', '#c0561a', 13, 'start');
  H.text(450, 50, tx(['displacement: ', 'இடப்பெயர்ச்சி: ']) + S.s.toFixed(1) + ' m', '#6a1fc2', 13, 'start');
}

export default function MotionLab({ si = {}, legacy = 'u2' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [u, setU] = useState(5);
  const [a, setA] = useState(1);
  const [t, setT] = useState(0);
  const [dist, setDist] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState(-1);
  const sim = useRef({ u: 5, a: 1, t: 0, d: 0 });
  sim.current = { u, a, t, d: dist };

  const sAt = (tt: number) => u * tt + 0.5 * a * tt * tt;
  const vAt = (tt: number) => u + a * tt;
  const state = (): S => { const c = sim.current; return { u: c.u, a: c.a, t: c.t, v: c.u + c.a * c.t, s: c.u * c.t + 0.5 * c.a * c.t * c.t, d: c.d }; };
  const { done, touch } = useMissions(legacy, MISSIONS, state, [t, u, a]);

  // the motion: real time, up to 10 s
  usePlayer(playing, setPlaying, (dt) => {
    const c = sim.current;
    const nt = Math.min(TMAX, c.t + dt);
    const pv = c.u + c.a * c.t, cv = c.u + c.a * nt;
    const nd = c.d + Math.abs((pv + cv) / 2) * (nt - c.t);
    sim.current = { ...c, t: nt, d: nd };
    setT(nt);
    setDist(nd);
    return nt < TMAX;
  });

  const restart = () => { setPlaying(false); setT(0); setDist(0); sim.current = { ...sim.current, t: 0, d: 0 }; };
  const setSlider = (which: 'u' | 'a', v: number) => {
    touch();
    if (which === 'u') setU(v); else setA(v);
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
    setU(tr.u); setA(tr.a);
    sim.current = { u: tr.u, a: tr.a, t: 0, d: 0 };
    setT(0); setDist(0); setPlaying(false);
    setTimeout(() => setPlaying(true), 60);
    markLab();
  };

  const [smin, smax] = range(sAt, TMAX);
  const tmap = (s: number) => 40 + (s - smin) / (smax - smin) * 560;
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(u, a)} />
      <LabStage text={text} draw={(tt, H) => drawStage(state(), tt, H, tx)} missions={MISSIONS} done={done} deps={[t, u, a]} />
      <div class="lab-controls">
        <div class="control">
          <label for="uSlider"><span>{tx(W.u)}</span>, u = <b>{u.toFixed(1)}</b> m s<sup>-1</sup></label>
          <input type="range" id="uSlider" min="-10" max="20" step="1" value={u} onInput={(e) => setSlider('u', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="control">
          <label for="aSlider"><span>{tx(W.a)}</span>, a = <b>{a.toFixed(1)}</b> m s<sup>-2</sup></label>
          <input type="range" id="aSlider" min="-5" max="5" step="0.5" value={a} onInput={(e) => setSlider('a', parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <div class="lab-buttons">
          <button type="button" class="btn primary" onClick={togglePlay}>{tx(playing ? SHARED.pause : SHARED.play)}</button>
          <button type="button" class="btn" onClick={() => { touch(); restart(); }}>{tx(SHARED.reset)}</button>
        </div>
      </div>
      <Readouts items={[[tx(W.t), t.toFixed(1) + ' s', 't'], [tx(W.v), vAt(t).toFixed(1) + ' m/s', 'v'], [tx(W.s), sAt(t).toFixed(1) + ' m', 's'], [tx(W.d), dist.toFixed(1) + ' m', 'd']]} />
      <div class="track-wrap">
        <svg viewBox="0 0 640 90" width="100%" style={{ minWidth: '480px' }} aria-hidden="true">
          <line x1="40" y1="45" x2="600" y2="45" style={{ stroke: 'var(--border)' }} stroke-width="3" />
          <line x1={tmap(0)} y1="31" x2={tmap(0)} y2="59" style={{ stroke: 'var(--text-faint)' }} stroke-width="2" />
          <text x={tmap(0) - 10} y="75" font-size="11" style={{ fill: 'var(--text-faint)' }}>0 m</text>
          <circle cx={tmap(sAt(t))} cy="45" r="9" style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} stroke-width="2" />
          <text x={tmap(sAt(t)) - 14} y="29" font-size="12" font-weight="700" style={{ fill: 'var(--text)' }}>{sAt(t).toFixed(1)} m</text>
        </svg>
      </div>
      <div class="graphs-row">
        <div class="graph-box"><div class="gtitle">{tx(W.vt)}</div><Graph fn={vAt} t={t} label="v (m/s)" tmax={TMAX} /></div>
        <div class="graph-box"><div class="gtitle">{tx(W.st)}</div><Graph fn={sAt} t={t} label="s (m)" tmax={TMAX} /></div>
      </div>
      <p class="lab-hint" dangerouslySetInnerHTML={{ __html: lang === 'ta' ? HINT[1] : lang === 'si' ? lookup(HINT[0]) || HINT[0] : HINT[0] }} />
    </div>
  );
}
