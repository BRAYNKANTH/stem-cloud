import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { SiDict } from '../../lib/si-lookup';
import { LabGuide, LabStage, markLab, sharedStrings, useLabText, useMissions, type Mission, type Pair } from '../shared';

/*
 * The Equilibrium Lab of chapter 12 (the lesson page's "EQUILIBRIUM LAB", "GUIDED LAB" and "CARTOON LAB STAGE" scripts,
 * ported): two upward forces and the weight; the ball stays still only when F1 + F2 = W, and moves towards the bigger
 * side otherwise. On the stage Raja sits on a swing. Missions keep the current page's keys (scx_lab_c12_<n>).
 */

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ['Find out when an object stays still (equilibrium). Two forces pull UP (F₁ and F₂) and the weight W pulls DOWN. It stays still only when the upward forces add up to the weight.', 'ஒரு பொருள் எப்ப அசையாம நிக்குதுன்னு (சமநிலை) கண்டுபிடி. ரெண்டு விசை மேல இழுக்குது (F₁, F₂), நிறை W கீழ இழுக்குது. மேல இழுக்கும் விசைகளோட கூட்டுத்தொகை நிறைக்கு சமமா இருந்தா மட்டும்தான் அசையாம நிக்கும்.'],
  look: ['In the picture: a ball hangs from a bar. Purple and green arrows pull it up, the red arrow is its weight. The words next to the numbers tell you if it moves up, moves down, or stays still.', 'படத்துல: ஒரு பந்து கம்பியில தொங்குது. ஊதா, பச்சை அம்புக்குறிகள் மேல இழுக்குது, சிவப்பு அதோட நிறை. எண்கள் பக்கத்துல இருக்கற வார்த்தைகள் அது மேல போகுதா, கீழ போகுதா, அசையாம நிக்குதான்னு சொல்லும்.'],
  f1: ['Upward force 1', 'மேல்நோக்கிய விசை 1'],
  f2: ['Upward force 2', 'மேல்நோக்கிய விசை 2'],
  w: ['Weight (down)', 'நிறை (கீழ்நோக்கி)'],
  net: ['Net force =', 'நிகர விசை ='],
  eq: ['⚖️ In equilibrium!', '⚖️ சமநிலையில்!'],
  up: ['⬆️ Moves up', '⬆️ மேல்நோக்கி நகரும்'],
  down: ['⬇️ Moves down', '⬇️ கீழ்நோக்கி நகரும்'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  "Set F₂ to 0 and F₁ equal to W — that's two-force equilibrium (an object on a rope). Then make F₁ + F₂ = W — three parallel forces (the swing)! Watch the object move whenever the sum doesn't match W.",
  'F₂ ஐ 0 ஆக்கி, F₁ ஐ W க்கு சமமா வெச்சு பாரு — இது இரு விசை சமநிலை (கயிறுல தொங்கும் பொருள்). அப்புறம் F₁ + F₂ = W ஆக்கு — மூன்று சமாந்தர விசை சமநிலை (ஊஞ்சல்)! கூட்டுத்தொகை W க்கு சமமில்லாட்டா பொருள் நகருறத பாரு.',
];
interface V { f1: number; f2: number; w: number }
const TRIES: { l: Pair; set: V; see: Pair }[] = [
  { l: ['A bag on one rope', 'ஒரு கயிறுல பை'], set: { f1: 60, f2: 0, w: 60 }, see: ['Only one rope pulls up: 60 N. It equals the weight of 60 N, so the bag stays still. Two forces: equal, opposite, same line.', 'ஒரு கயிறு மட்டும் 60 N மேல இழுக்குது. அது நிறை 60 N-க்கு சமம், அதனால பை அசையாம நிக்குது. ரெண்டு விசை: சமம், எதிர், ஒரே கோடு.'] },
  { l: ['A swing with two ropes', 'ரெண்டு கயிறு ஊஞ்சல்'], set: { f1: 30, f2: 40, w: 70 }, see: ['30 + 40 = 70 N upward, and the weight is 70 N. Equal, so everything stays still. Three parallel forces: F₁ + F₂ = W.', '30 + 40 = 70 N மேல், நிறை 70 N. சமம், அதனால எல்லாம் அசையாம நிக்குது. மூன்று சமாந்தர விசைகள்: F₁ + F₂ = W.'] },
  { l: ['Not balanced', 'சமநிலை இல்ல'], set: { f1: 20, f2: 20, w: 60 }, see: ['20 + 20 = 40 N is less than the weight of 60 N. There is 20 N of unbalanced force downward, so the ball sinks.', '20 + 20 = 40 N நிறை 60 N-ஐ விட குறைவு. 20 N சமநிலையற்ற விசை கீழ் நோக்கி இருக்கு, அதனால பந்து கீழ போகுது.'] },
];
interface S extends V { net: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Balance Raja with ONE rope only (F₂ = 0).', 'ஒரே ஒரு கயிறால ராஜாவ சமநிலைப்படுத்து (F₂ = 0).'], test: (s) => s.f2 === 0 && s.net === 0 },
  { l: ['Balance him with BOTH ropes pulling (F₁ + F₂ = W).', 'ரெண்டு கயிறும் இழுக்க சமநிலைப்படுத்து (F₁ + F₂ = W).'], test: (s) => s.f1 > 0 && s.f2 > 0 && s.net === 0 },
  { l: ['Make Raja fly UP (the ropes must pull more than his weight).', 'ராஜா மேல பறக்கணும் (கயிறுகள் நிறைய விட அதிகமா இழுக்கணும்).'], test: (s) => s.net > 0 },
];

function live({ f1: a, f2: b, w }: V): Pair {
  const up = a + b;
  if (up === w) return ['Up: ' + a + ' + ' + b + ' = ' + up + ' N. Down: ' + w + ' N. Equal, so the resultant is zero and the ball stays still.', 'மேல்: ' + a + ' + ' + b + ' = ' + up + ' N. கீழ்: ' + w + ' N. சமம், அதனால விளையுள் பூச்சியம், பந்து அசையாம நிக்கும்.'];
  return ['Up: ' + up + ' N. Down: ' + w + ' N. The ' + (up > w ? 'upward' : 'downward') + ' force is bigger by ' + Math.abs(up - w) + ' N, so the ball moves ' + (up > w ? 'up' : 'down') + '.', 'மேல்: ' + up + ' N. கீழ்: ' + w + ' N. ' + (up > w ? 'மேல்நோக்கிய' : 'கீழ்நோக்கிய') + ' விசை ' + Math.abs(up - w) + ' N அதிகம், அதனால பந்து ' + (up > w ? 'மேல' : 'கீழ') + ' போகுது.'];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0], live(t.set)[0]]),
  'Up: ', 'Down: ', 'EQUILIBRIUM', 'falling ↓', 'flying ↑', 'Up = down: perfectly still!', 'Not enough up-pull! Help!', 'Too much up-pull! Wheee!',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any, tx: (p: Pair) => string) {
  const bal = S.net === 0, off = H.clamp(-S.net * 0.9, -48, 48), sy = 160 + off, k = 0.8;
  H.rect(0, 0, 640, 300, '#d9f1ff'); H.cloud(80, 60, 0.9); H.cloud(470, 46, 1.1); H.rect(0, 270, 640, 30, '#8fd17a');
  H.rect(150, 24, 340, 14, '#8d6e63', 5); H.line(180, 38, 150, 272, '#8d6e63', 8); H.line(460, 38, 490, 272, '#8d6e63', 8);
  const r1 = 250, r2 = 390; H.line(r1, 38, r1, sy, '#5d4037', 4); H.line(r2, 38, r2, sy, '#5d4037', 4);
  H.rect(r1 - 22, sy, r2 - r1 + 44, 12, '#ff9a4d', 5, '#7a3b10');
  const state = bal ? 'ok' : (S.net < 0 ? 'fall' : 'fly');
  H.raja(320, sy, 0.5, { aL: state === 'ok' ? 20 : 120, aR: state === 'ok' ? 20 : 120, eyes: state === 'ok' ? 'n' : 'w', brow: state === 'ok' ? 'n' : 'up', m: state === 'ok' ? 0.15 : 0.9, tail: Math.sin(t * 6) * 10 });
  if (bal) { const g2 = 0.5 + 0.5 * Math.sin(t * 4); H.E('circle', { cx: 320, cy: sy - 40, r: 78 + g2 * 8, fill: 'none', stroke: '#ffd166', 'stroke-width': 4, opacity: 0.85 }); }
  if (state === 'fall') { H.sweat(326, sy - 134, t); for (let i = 0; i < 3; i++) { H.line(300 + i * 20, sy - 150 - i * 4, 300 + i * 20, sy - 130 - i * 4, '#8ab', 3); } }
  if (state === 'fly') { for (let j = 0; j < 3; j++) { H.line(296 + j * 28, sy + 30 + j * 4, 296 + j * 28, sy + 56 + j * 4, '#fff', 4); } }
  if (S.f1 > 0) H.arrow(r1, sy - 6, r1, sy - 6 - S.f1 * k, '#0c9e83', 8);
  H.text(r1 - 8, sy - 10 - S.f1 * k * 0.5, 'F₁ ' + S.f1, '#0c9e83', 14, 'end');
  if (S.f2 > 0) H.arrow(r2, sy - 6, r2, sy - 6 - S.f2 * k, '#7b2ff7', 8);
  H.text(r2 + 8, sy - 10 - S.f2 * k * 0.5, 'F₂ ' + S.f2, '#7b2ff7', 14, 'start');
  H.arrow(320, sy + 16, 320, sy + 16 + S.w * k * 0.9, '#e53935', 9); H.text(334, sy + 30 + S.w * k * 0.45, 'W ' + S.w, '#e53935', 14, 'start');
  H.rect(14, 12, 256, 34, '#fff', 10, '#1b2236', 0.94); H.text(24, 34, tx(['Up: ', 'மேல்: ']) + (S.f1 + S.f2) + ' N   ' + tx(['Down: ', 'கீழ்: ']) + S.w + ' N', '#1b2236', 14, 'start');
  H.rect(470, 12, 160, 32, bal ? '#0c9e83' : '#e53935', 10); H.text(550, 33, bal ? tx(['EQUILIBRIUM', 'சமநிலை']) : (S.net < 0 ? tx(['falling ↓', 'கீழ விழறான் ↓']) : tx(['flying ↑', 'மேல பறக்கறான் ↑'])), '#fff', 14);
  H.chittu(560, 270, 0.45, { wL: bal ? 10 : 50, m: 0.3, eyes: 'w' });
  const msg: Pair = bal ? ['Up = down: perfectly still!', 'மேல் = கீழ்: அசையாம நிக்கறான்!'] : (S.net < 0 ? ['Not enough up-pull! Help!', 'மேல இழுவை போதாது! காப்பாத்துங்க!'] : ['Too much up-pull! Wheee!', 'மேல இழுவை அதிகம்! வீ!']);
  H.say(540, 270 - 112, msg, { col: '#e6f6ff', n: 20 });
}

/** An arrow along x from y0 to y1, as the page's lab draws them. */
function Arrow({ x, y0, y1, color }: { x: number; y0: number; y1: number; color: string }) {
  const dir = y1 < y0 ? -1 : 1;
  return (
    <>
      <line x1={x} y1={y0} x2={x} y2={y1} style={{ stroke: color }} stroke-width="4" stroke-linecap="round" />
      <polygon points={`${x - 7},${y1} ${x + 7},${y1} ${x},${y1 + dir * 12}`} style={{ fill: color }} />
    </>
  );
}

export default function EquilibriumLab({ si = {}, legacy = 'c12' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [v, setV] = useState<V>({ f1: 40, f2: 20, w: 60 });
  const [chosen, setChosen] = useState(-1);
  const S: S = { ...v, net: v.f1 + v.f2 - v.w };
  const { done, touch } = useMissions(legacy, MISSIONS, () => S, [v]);
  const set = (k: keyof V, x: number) => { touch(); setV({ ...v, [k]: x }); };
  const tryIt = (i: number) => { setChosen(i); touch(); setV({ ...TRIES[i]!.set }); markLab(); };

  // the page's own picture under the controls: the ball moves (up to 35) the way of the net force
  const net = S.net, balanced = Math.abs(net) < 0.5, cx = 320, cy = 170 - Math.max(-35, Math.min(35, net * 0.8)), s = 1.1;
  const slider = (k: keyof V, label: Pair, sym: ComponentChildren, min: number, max: number) => (
    <div class="control">
      <label for={k + 'Slider'}><span>{tx(label)}</span>, {sym} = <b>{v[k].toFixed(0)}</b> N</label>
      <input type="range" id={k + 'Slider'} min={min} max={max} step="1" value={v[k]} onInput={(e) => set(k, parseFloat((e.target as HTMLInputElement).value))} />
    </div>
  );
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(v)} />
      <LabStage text={text} draw={(tt, H) => drawStage(S, tt, H, tx)} missions={MISSIONS} done={done} deps={[v]} />
      <div class="lab-controls">
        {slider('f1', W.f1, <>F<sub>1</sub></>, 0, 60)}
        {slider('f2', W.f2, <>F<sub>2</sub></>, 0, 60)}
        {slider('w', W.w, 'W', 10, 100)}
      </div>
      <div class="a-readout">
        <span>{tx(W.net)}</span> <b data-ro="net">{(net > 0 ? '+' : '') + net.toFixed(0)} N</b>
        {' · '}<b data-ro="eq" style={{ color: balanced ? 'var(--good)' : 'var(--accent-3)' }}>{tx(balanced ? W.eq : net > 0 ? W.up : W.down)}</b>
      </div>
      <div class="track-wrap">
        <svg viewBox="0 0 640 340" width="100%" style={{ minWidth: '480px' }} aria-hidden="true">
          <line x1={cx - 150} y1="20" x2={cx + 150} y2="20" style={{ stroke: 'var(--text-faint)' }} stroke-width="3" />
          <circle cx={cx} cy={cy} r="22" style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} stroke-width="3" />
          {v.f1 > 0 && <><Arrow x={cx - 14} y0={cy - 22} y1={cy - 22 - v.f1 * s} color="var(--accent-2)" /><text x={cx - 60} y={cy - 22 - v.f1 * s / 2} font-size="13" font-weight="700" style={{ fill: 'var(--accent-2)' }}>F₁={v.f1.toFixed(0)} N</text></>}
          {v.f2 > 0 && <><Arrow x={cx + 14} y0={cy - 22} y1={cy - 22 - v.f2 * s} color="var(--good)" /><text x={cx + 24} y={cy - 22 - v.f2 * s / 2} font-size="13" font-weight="700" style={{ fill: 'var(--good)' }}>F₂={v.f2.toFixed(0)} N</text></>}
          <Arrow x={cx} y0={cy + 22} y1={cy + 22 + v.w * s} color="var(--danger)" />
          <text x={cx + 12} y={cy + 22 + v.w * s / 2} font-size="13" font-weight="700" style={{ fill: 'var(--danger)' }}>W={v.w.toFixed(0)} N</text>
        </svg>
      </div>
      <p class="lab-hint">{lang === 'ta' ? HINT[1] : lang === 'si' ? lookup(HINT[0]) || HINT[0] : HINT[0]}</p>
    </div>
  );
}
