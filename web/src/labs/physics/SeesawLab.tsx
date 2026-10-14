import { useState } from 'preact/hooks';
import type { SiDict } from '../../lib/si-lookup';
import { LabGuide, LabStage, SHARED, markLab, sharedStrings, useLabText, useMissions, type Mission, type Pair } from '../shared';

/*
 * The Balance Lab of chapter 11, the turning effect (the lesson page's "BALANCE LAB (SEE-SAW)", "GUIDED LAB" and
 * "CARTOON LAB STAGE" scripts, ported): a force and its distance from the pivot on each side; the see-saw tips towards
 * the bigger moment (F x d) and is level when they are equal. On the stage Raja and Chittu sit on it. Missions keep the
 * current page's keys (scx_lab_c11_<n>).
 */

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ['Balance a seesaw. Each side has a turning effect called a moment = force × distance from the pivot. The seesaw is level when the left moment equals the right moment.', 'ஒரு சீசாவ சமநிலைப்படுத்து. ஒவ்வொரு பக்கத்துக்கும் திருப்பம் உண்டு: திருப்பம் = விசை × சுழல் புள்ளியில இருந்து தூரம். இடது திருப்பம் வலது திருப்பத்துக்கு சமமா இருந்தா சீசா சமமா நிக்கும்.'],
  look: ['In the picture: a seesaw with a weight on each side. F is the pull of the weight (N) and d is how far it sits from the middle (m). The two moments are shown above the picture.', 'படத்துல: ஒவ்வொரு பக்கமும் ஒரு எடை உள்ள சீசா. F = எடையோட இழுவை (N), d = நடுவுல இருந்து தூரம் (m). ரெண்டு திருப்பமும் படத்துக்கு மேல காட்டப்படும்.'],
  fL: ['Left force', 'இடப்புற விசை'],
  dL: ['Left distance', 'இடப்புற தூரம்'],
  fR: ['Right force', 'வலப்புற விசை'],
  dR: ['Right distance', 'வலப்புற தூரம்'],
  mL: ['Left moment =', 'இடப்புற திருப்பம் ='],
  mR: ['Right moment =', 'வலப்புற திருப்பம் ='],
  bal: ['⚖️ Balanced!', '⚖️ சமநிலை!'],
  right: ['↘️ Tips right', '↘️ வலப்புறம் சாய்கிறது'],
  left: ['↙️ Tips left', '↙️ இடப்புறம் சாய்கிறது'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  'Try making the left moment equal to the right moment — the see-saw settles perfectly flat! Nudge one side and watch which way it tips.',
  'இடப்புற திருப்பத்தையும் வலப்புற திருப்பத்தையும் சமமா வெக்க முயற்சி பண்ணு — சீசா ஒரு நேர்கோடா நிக்கும்! ஒரு பக்கத்தை கொஞ்சம் மாத்தி பாரு — அது எந்த திசையில் சாய்றதுன்னு பாருங்க.',
];
interface V { fL: number; dL: number; fR: number; dR: number }
const TRIES: { l: Pair; set: V; see: Pair }[] = [
  { l: ['Balanced', 'சமநிலை'], set: { fL: 10, dL: 3, fR: 15, dR: 2 }, see: ['Left: 10 × 3 = 30 N m. Right: 15 × 2 = 30 N m. The moments are equal, so the seesaw is level.', 'இடது: 10 × 3 = 30 N m. வலது: 15 × 2 = 30 N m. திருப்பங்கள் சமம், அதனால சீசா சமமா நிக்குது.'] },
  { l: ['Heavy close, light far', 'பாரம் பக்கத்துல, லேசு தூரத்துல'], set: { fL: 30, dL: 1, fR: 10, dR: 3 }, see: ['Left: 30 × 1 = 30 N m. Right: 10 × 3 = 30 N m. A small force far from the pivot balances a big force close to it.', 'இடது: 30 × 1 = 30 N m. வலது: 10 × 3 = 30 N m. சுழல் புள்ளியில இருந்து தூரமா இருக்கும் சின்ன விசை, பக்கத்துல இருக்கும் பெரிய விசைய சமநிலைப்படுத்தும்.'] },
  { l: ['Tips to the right', 'வலப்பக்கம் சாயுது'], set: { fL: 10, dL: 2, fR: 10, dR: 4 }, see: ['Left: 10 × 2 = 20 N m. Right: 10 × 4 = 40 N m. The right moment is bigger, so the right side goes down.', 'இடது: 10 × 2 = 20 N m. வலது: 10 × 4 = 40 N m. வலது திருப்பம் அதிகம், அதனால வலப்பக்கம் கீழ போகுது.'] },
];
interface S extends V { ML: number; MR: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Balance the seesaw: make the two moments equal.', 'சீசாவ சமநிலைப்படுத்து: ரெண்டு திருப்பமும் சமமா வை.'], test: (s) => s.ML === s.MR },
  { l: ['Balance it with a HEAVY weight (20 N or more) on the left.', 'இடப்பக்கம் பாரமான எடை (20 N அல்லது அதிகம்) வெச்சு சமநிலைப்படுத்து.'], test: (s) => s.ML === s.MR && s.fL >= 20 },
  { l: ['Balance it with the two weights at DIFFERENT distances.', 'ரெண்டு எடையும் வேற வேற தூரத்துல இருக்கும்போது சமநிலைப்படுத்து.'], test: (s) => s.ML === s.MR && s.dL !== s.dR },
];

function live(v: V): Pair {
  const ML = v.fL * v.dL, MR = v.fR * v.dR;
  const s = 'Left moment = ' + v.fL + ' × ' + v.dL + ' = ' + ML + ' N m. Right moment = ' + v.fR + ' × ' + v.dR + ' = ' + MR + ' N m. ';
  const s2 = 'இடது திருப்பம் = ' + v.fL + ' × ' + v.dL + ' = ' + ML + ' N m. வலது திருப்பம் = ' + v.fR + ' × ' + v.dR + ' = ' + MR + ' N m. ';
  if (ML === MR) return [s + 'Equal, so the seesaw is balanced.', s2 + 'சமம், அதனால சீசா சமநிலை.'];
  return [s + 'The ' + (ML > MR ? 'left' : 'right') + ' moment is bigger, so that side goes down.', s2 + (ML > MR ? 'இடது' : 'வலது') + ' திருப்பம் அதிகம், அதனால அந்தப் பக்கம் கீழ போகும்.'];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0], live(t.set)[0]]),
  'Left: ', 'Right: ', '⚖️ BALANCED!', 'tips RIGHT ↘', 'tips LEFT ↙', 'Balanced! Moments are equal', 'Right moment is bigger', 'Left moment is bigger',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any, tx: (p: Pair) => string) {
  const px = 320, py = 206, sc = 44, bal = S.ML === S.MR, ang = H.clamp((S.MR - S.ML) * 0.4, -16, 16);
  H.rect(0, 0, 640, 300, '#d4f1ff'); H.cloud(90, 40, 0.9); H.cloud(470, 52, 1.1); H.rect(0, 262, 640, 38, '#8fd17a');
  H.E('polygon', { points: px + ',' + py + ' ' + (px - 28) + ',264 ' + (px + 28) + ',264', fill: '#6d7b88' });
  const g = H.E('g', { transform: 'rotate(' + ang + ' ' + px + ' ' + py + ')' });
  H.E('rect', { x: px - 285, y: py - 8, width: 570, height: 14, rx: 6, fill: '#ff9a4d', stroke: '#7a3b10', 'stroke-width': 2 }, g);
  for (let m = 1; m <= 6; m++) { H.E('line', { x1: px - m * sc, y1: py - 8, x2: px - m * sc, y2: py - 14, stroke: '#fff', 'stroke-width': 3 }, g); H.E('line', { x1: px + m * sc, y1: py - 8, x2: px + m * sc, y2: py - 14, stroke: '#fff', 'stroke-width': 3 }, g); H.E('text', { x: px - m * sc, y: py + 20, 'font-size': 10, 'text-anchor': 'middle', fill: '#7a3b10' }, g, m); H.E('text', { x: px + m * sc, y: py + 20, 'font-size': 10, 'text-anchor': 'middle', fill: '#7a3b10' }, g, m); }
  const down = ang < -1 ? 'L' : (ang > 1 ? 'R' : 'N');
  H.raja(px - S.dL * sc, py - 6, 0.38, { parent: g, aL: 30, aR: 30, eyes: down === 'R' ? 'w' : 'n', m: down === 'L' ? 0.5 : 0.2, brow: down === 'R' ? 'up' : 'n' });
  H.chittu(px + S.dR * sc, py - 6, 0.34, { parent: g, wL: down === 'L' ? 50 : 10, wR: down === 'L' ? 50 : 10, eyes: down === 'L' ? 'w' : 'n', m: down === 'R' ? 0.5 : 0.2 });
  H.E('rect', { x: px - S.dL * sc - 20, y: py - 118, width: 40, height: 20, rx: 5, fill: '#fff', stroke: '#c0561a', 'stroke-width': 2 }, g); H.E('text', { x: px - S.dL * sc, y: py - 103, 'font-size': 13, 'text-anchor': 'middle', fill: '#c0561a' }, g, S.fL + ' N');
  H.E('rect', { x: px + S.dR * sc - 20, y: py - 108, width: 40, height: 20, rx: 5, fill: '#fff', stroke: '#1c6fa8', 'stroke-width': 2 }, g); H.E('text', { x: px + S.dR * sc, y: py - 93, 'font-size': 13, 'text-anchor': 'middle', fill: '#1c6fa8' }, g, S.fR + ' N');
  H.rect(14, 12, 300, 50, '#fff', 10, '#1b2236', 0.94);
  H.text(24, 32, tx(['Left: ', 'இடது: ']) + S.fL + ' × ' + S.dL + ' = ' + S.ML + ' N m', '#c0561a', 14, 'start'); H.text(24, 53, tx(['Right: ', 'வலது: ']) + S.fR + ' × ' + S.dR + ' = ' + S.MR + ' N m', '#1c6fa8', 14, 'start');
  if (bal) { H.spark(px, py - 70, (t * 0.8) % 1, '#ffd166'); H.spark(px - 110, py - 40, (t * 0.8 + 0.3) % 1, '#ffd166'); H.spark(px + 110, py - 40, (t * 0.8 + 0.6) % 1, '#ffd166'); }
  H.rect(450, 14, 176, 30, bal ? '#0c9e83' : '#e53935', 10); H.text(538, 35, bal ? tx(['⚖️ BALANCED!', '⚖️ சமநிலை!']) : (ang > 0 ? tx(['tips RIGHT ↘', 'வலப்பக்கம் சாயுது ↘']) : tx(['tips LEFT ↙', 'இடப்பக்கம் சாயுது ↙'])), '#fff', 14);
  const msg: Pair = bal ? ['Balanced! Moments are equal', 'சமநிலை! திருப்பங்கள் சமம்'] : (S.MR > S.ML ? ['Right moment is bigger', 'வலது திருப்பம் பெருசு'] : ['Left moment is bigger', 'இடது திருப்பம் பெருசு']);
  H.say(520, py - 104, msg, { col: '#e6f6ff', n: 20 });
}

export default function SeesawLab({ si = {}, legacy = 'c11' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [v, setV] = useState<V>({ fL: 10, dL: 3, fR: 15, dR: 2 });
  const [chosen, setChosen] = useState(-1);
  const S: S = { ...v, ML: v.fL * v.dL, MR: v.fR * v.dR };
  const { done, last, touch } = useMissions(legacy, MISSIONS, () => S, [v]);
  const set = (k: keyof V, x: number) => { touch(); setV({ ...v, [k]: x }); };
  const tryIt = (i: number) => { setChosen(i); touch(false); setV({ ...TRIES[i]!.set }); markLab(); };

  // the page's own see-saw under the controls: tips towards the bigger moment, by up to 18 degrees
  const diff = S.MR - S.ML, balanced = Math.abs(diff) < 0.3;
  const rad = (balanced ? 0 : Math.max(-18, Math.min(18, diff * 0.6))) * Math.PI / 180;
  const cx = 320, cy = 130, half = 220;
  const x1 = cx - half * Math.cos(rad), y1 = cy + half * Math.sin(rad), x2 = cx + half * Math.cos(rad), y2 = cy - half * Math.sin(rad);
  const slider = (k: keyof V, label: Pair, sym: string, unit: string, min: number, max: number, step: number, dp: number) => (
    <div class="control">
      <label for={k + 'Slider'}><span>{tx(label)}</span>, {sym}<sub>{k.endsWith('L') ? 'L' : 'R'}</sub> = <b>{v[k].toFixed(dp)}</b> {unit}</label>
      <input type="range" id={k + 'Slider'} min={min} max={max} step={step} value={v[k]} onInput={(e) => set(k, parseFloat((e.target as HTMLInputElement).value))} />
    </div>
  );
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(v)} />
      <LabStage text={text} draw={(tt, H) => drawStage(S, tt, H, tx)} missions={MISSIONS} done={done} deps={[v]} note={last >= 0 ? tx(SHARED.missionDone) + tx(SHARED.now) + tx(live(v)) : ''} />
      <div class="lab-controls">
        {slider('fL', W.fL, 'F', 'N', 1, 30, 1, 0)}
        {slider('dL', W.dL, 'd', 'm', 0.5, 6, 0.5, 1)}
        {slider('fR', W.fR, 'F', 'N', 1, 30, 1, 0)}
        {slider('dR', W.dR, 'd', 'm', 0.5, 6, 0.5, 1)}
      </div>
      <div class="a-readout">
        <span>{tx(W.mL)}</span> <b data-ro="mL">{S.ML.toFixed(1)} N m</b>
        {' · '}<span>{tx(W.mR)}</span> <b data-ro="mR">{S.MR.toFixed(1)} N m</b>
        {' · '}<b data-ro="bal" class="status-still" style={{ color: balanced ? 'var(--good)' : 'var(--accent-3)' }}>{tx(balanced ? W.bal : diff > 0 ? W.right : W.left)}</b>
      </div>
      <div class="track-wrap">
        <svg viewBox="0 0 640 220" width="100%" style={{ minWidth: '480px' }} aria-hidden="true">
          <polygon points={`${cx - 16},${cy + 40} ${cx + 16},${cy + 40} ${cx},${cy + 10}`} style={{ fill: 'var(--panel-2)', stroke: 'var(--border)' }} stroke-width="2" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: 'var(--accent-2)' }} stroke-width="8" stroke-linecap="round" />
          <circle cx={x1} cy={y1} r="8" style={{ fill: 'var(--accent)' }} />
          <circle cx={x2} cy={y2} r="8" style={{ fill: 'var(--accent-3)' }} />
          <text x={x1 - 10} y={y1 - 14} font-size="12" font-weight="700" style={{ fill: 'var(--text)' }}>L</text>
          <text x={x2 + 2} y={y2 - 14} font-size="12" font-weight="700" style={{ fill: 'var(--text)' }}>R</text>
        </svg>
      </div>
      <p class="lab-hint">{lang === 'ta' ? HINT[1] : lang === 'si' ? lookup(HINT[0]) || HINT[0] : HINT[0]}</p>
    </div>
  );
}
