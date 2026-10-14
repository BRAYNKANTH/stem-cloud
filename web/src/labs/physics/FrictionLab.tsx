import { useRef, useState } from 'preact/hooks';
import type { SiDict } from '../../lib/si-lookup';
import { LabGuide, LabStage, Readouts, SHARED, markLab, sharedStrings, useLabText, useMissions, usePlayer, type Mission, type Pair } from '../shared';

/*
 * The Interactive Friction Lab of chapter 5 (the lesson page's "FRICTION LAB", "GUIDED LAB" and "CARTOON LAB STAGE"
 * scripts, ported): choose the floor and how many 20 N blocks, set the push F, and try to move it. Up to the limiting
 * friction (mu x weight) friction matches the push and the block stays still (it shakes); past it the block slides
 * against the dynamic friction (3/4 of the limit). Missions keep the current page's keys (scx_lab_c5_<n>).
 */

const TMAX = 6, FMAX = 50;

// The lesson page's own words (English, Tamil); Sinhala comes from the translation memory (labSinhala).
const W = {
  goal: ['Find out when a block starts to move. Friction pushes back against your push, but only up to a limit (the limiting friction). Push harder than that limit and the block moves.', 'பிளாக் எப்ப நகர ஆரம்பிக்குதுன்னு கண்டுபிடி. உராய்வு உன் தள்ளலுக்கு எதிரா திரும்ப தள்ளும், ஆனா ஒரு எல்லை வரைக்கும்தான் (எல்லை உராய்வு). அத விட பலமா தள்ளினா பிளாக் நகரும்.'],
  look: ['In the picture: a block sits on a floor. The green arrow is your push and the red arrow is friction. The graph shows friction growing with your push, then dropping a little when the block starts to slide.', 'படத்துல: ஒரு பிளாக் தரை மேல இருக்கு. பச்சை அம்புக்குறி உன் தள்ளல், சிவப்பு உராய்வு. உன் தள்ளலோட உராய்வு கூடி, பிளாக் சறுக்க ஆரம்பிக்கும்போது கொஞ்சம் குறையறத வரைபு காட்டும்.'],
  surface: ['Surface', 'மேற்பரப்பு'],
  smooth: ['Smooth (μ = 0.3)', 'மினுமினுப்பு (μ = 0.3)'],
  rough: ['Rough (μ = 0.6)', 'கரடுமுரடு (μ = 0.6)'],
  weight: ['Weight (each block = 20 N)', 'எடை (ஒவ்வொரு குற்றியும் 20 N)'],
  b1: ['1 block', '1 குற்றி'],
  b2: ['2 blocks', '2 குற்றி'],
  b3: ['3 blocks', '3 குற்றி'],
  F: ['Applied force', 'பிரயோகிக்கும் விசை'],
  status: ['Status:', 'நிலை:'],
  still: ['Stationary', 'அசையாது'],
  sliding: ['Sliding!', 'நகருது!'],
  limit: ['Limiting friction =', 'எல்லை உராய்வு ='],
  fr: ['Current friction', 'தற்போதைய உராய்வு'],
  t: ['Time, t', 'நேரம், t'],
  s: ['Distance moved, s', 'கடந்த தூரம், s'],
  play: ['▶ Try to move it', '▶ நகர்த்திப் பாரு'],
  graph: ['Friction vs. Applied Force graph', 'உராய்வு — பிரயோகிக்கும் விசை கிராஃப்'],
  gx: ['Applied force F (N)', 'பிரயோகிக்கும் விசை F (N)'],
  gy: ['Friction (N)', 'உராய்வு (N)'],
  glimit: ['limit', 'எல்லை'],
} satisfies Record<string, Pair>;
const HINT: Pair = [
  'Slowly increase F and watch the dot follow the 45° line on the graph (friction = applied force, object stays still). Once F exceeds the limiting friction, the dot suddenly drops — now only kinetic friction (slightly less) acts, and the object starts moving!',
  'F ஐ மெதுவா அதிகரி — கிராஃபுல புள்ளி 45° கோட்டை பின்தொடர்றத பாரு (உராய்வு = பிரயோகிக்கும் விசை, பொருள் அசையாது). F, எல்லை உராய்வை தாண்டியதும், புள்ளி திடீரென்று கீழே குதிக்குது — இப்போ இயக்கவியல் உராய்வு (இதுல கொஞ்சம் குறைவு) மட்டுமே செயல்படுது, பொருள் நகர ஆரம்பிக்கும்!',
];
const TRIES: { l: Pair; rough: boolean; blocks: number; F: number; see: Pair }[] = [
  { l: ['Gentle push', 'லேசா தள்ளு'], rough: false, blocks: 1, F: 3, see: ['The limit here is 6 N. Your push of 3 N is smaller, so friction pushes back with exactly 3 N and the block does NOT move.', 'இங்க எல்லை 6 N. உன் தள்ளல் 3 N அதவிட சின்னது, அதனால உராய்வும் சரியா 3 N-ல திரும்ப தள்ளும்; பிளாக் நகராது.'] },
  { l: ['Push harder than the limit', 'எல்லைய விட பலமா தள்ளு'], rough: false, blocks: 1, F: 8, see: ['8 N is more than the 6 N limit, so the block starts to move. Once it slides, friction drops a little (dynamic friction is less than limiting friction).', '8 N, 6 N எல்லைய விட அதிகம், அதனால பிளாக் நகர ஆரம்பிக்கும். நகர ஆரம்பிச்சதும் உராய்வு கொஞ்சம் குறையும் (இயக்கவியல் உராய்வு, எல்லை உராய்வ விட குறைவு).'] },
  { l: ['Rough floor', 'கரடுமுரடான தரை'], rough: true, blocks: 1, F: 8, see: ['A rough floor has more friction: the limit is now 12 N. The same 8 N push cannot move the block.', 'கரடுமுரடான தரையில உராய்வு அதிகம்: எல்லை இப்போ 12 N. அதே 8 N தள்ளலால பிளாக்ட நகர்த்த முடியாது.'] },
  { l: ['Heavier block', 'பாரமான பிளாக்'], rough: false, blocks: 3, F: 8, see: ['Three blocks weigh 60 N, so the limit grows to 18 N. More weight pressing down means more friction.', 'மூணு பிளாக் 60 N எடை, அதனால எல்லை 18 N ஆகுது. அழுத்தும் எடை அதிகமானா உராய்வும் அதிகம்.'] },
];
interface S { F: number; FL: number; fr: number; s: number; rough: boolean; blocks: number }
const MISSIONS: Mission<S>[] = [
  { l: ['Make the block slide on the SMOOTH floor (press the Try button).', 'ஒப்பமான தரையில பிளாக் சறுக்கணும் (Try பட்டனை அழுத்து).'], test: (s) => s.s > 0.3 && !s.rough },
  { l: ['Now make it slide on the ROUGH floor. It needs a bigger push!', 'இப்போ கரடுமுரடான தரையில சறுக்கணும். பெரிய தள்ளல் வேணும்!'], test: (s) => s.s > 0.3 && s.rough },
  { l: ['Make it slide with 3 blocks stacked on top of each other.', 'மூணு பிளாக் அடுக்கி வெச்சு சறுக்க வை.'], test: (s) => s.s > 0.3 && s.blocks === 3 },
];

// the limit as the page shows it (one decimal), which its guide reads back
const shown = (x: number) => +x.toFixed(1);
function live(F: number, FL: number): Pair {
  if (F <= FL) return ['Your push is ' + F + ' N and the limit is ' + FL + ' N. Friction matches your push, so the block stays still.', 'உன் தள்ளல் ' + F + ' N, எல்லை ' + FL + ' N. உராய்வு உன் தள்ளலுக்கு சமம், அதனால பிளாக் நகராது.'];
  return ['Your push (' + F + ' N) is bigger than the limit (' + FL + ' N). Friction cannot hold the block any more, so it moves.', 'உன் தள்ளல் (' + F + ' N) எல்லைய (' + FL + ' N) விட அதிகம். உராய்வால பிளாக்ட பிடிக்க முடியல, அதனால நகருது.'];
}

/** Every fixed English string, for the Sinhala the page looks up at build time (labSinhala). */
export const STRINGS: string[] = [
  ...sharedStrings(MISSIONS), ...Object.values(W).map((p) => p[0]), HINT[0], ...TRIES.flatMap((t) => [t.l[0], t.see[0]]),
  ...TRIES.map((t) => live(t.F, shown((t.rough ? 0.6 : 0.3) * t.blocks * 20))[0]),
  'rough floor', 'smooth floor', 'limit ', 'your push ', 'Push the slider!', 'It slides! Push beat the limit', 'Press Try to move it!',
];

/** The stage: what the lesson page's CARTOON LAB STAGE draws for the current state (unchanged). */
function drawStage(S: S, t: number, H: any, tx: (p: Pair) => string) {
  const sliding = S.s > 0.05, fy = 246;
  H.rect(0, 0, 640, 300, '#eaf3ff'); H.cloud(80, 60, 0.9); H.cloud(430, 44, 1);
  if (S.rough) { H.rect(0, fy, 640, 54, '#d7b377'); const pts = []; for (let x = 0; x <= 640; x += 8) { pts.push(x + ',' + (fy - 3 - 3 * Math.abs(Math.sin(x * 0.7)))); } H.E('polyline', { points: pts.join(' '), fill: 'none', stroke: '#a07a3a', 'stroke-width': 3 }); H.text(560, 280, tx(['rough floor', 'கரடுமுரடான தரை']), '#7a5a22', 13); }
  else { H.rect(0, fy, 640, 54, '#cfe3ef'); H.line(60, fy + 14, 170, fy + 14, '#fff', 5); H.line(300, fy + 26, 420, fy + 26, '#fff', 5); H.text(560, 280, tx(['smooth floor', 'ஒப்பமான தரை']), '#3d6a85', 13); }
  const bx = 230 + (sliding ? H.clamp(S.s * 14, 0, 330) : 0);
  for (let i = 0; i < S.blocks; i++) { H.rect(bx, fy - 34 * (i + 1), 92, 32, i % 2 ? '#ff9a4d' : '#ffb35c', 6, '#7a3b10'); H.text(bx + 46, fy - 34 * i - 11, '20 N', '#7a3b10', 13); }
  const lean = 8 + S.F * 0.55, strain = S.F > 0.55 * S.FL;
  H.raja(bx - 62, fy, 0.55, { rot: H.clamp(lean, 0, 30), aR: 70, aL: 50, fd: sliding ? Math.sin(t * 9) * 6 : 0, fl: sliding ? Math.sin(t * 9) * 5 : 0, eyes: sliding ? 'w' : 'n', brow: S.F > 0 ? 'down' : 'n', m: sliding ? 0.6 : (S.F > 0 ? 0.35 : 0.1) });
  if (strain && !sliding) H.sweat(bx - 64, fy - 140, t);
  if (sliding) { H.puff(bx + 10, fy - 4, (t * 1.5) % 1, '#fff'); H.spark(bx + 4, fy - 6, (t * 2) % 1, '#ffb347'); }
  if (S.F > 0.3) { H.arrow(bx - 10 - S.F * 2.4, fy - 20 * S.blocks, bx - 6, fy - 20 * S.blocks, '#0c9e83', 8); }
  if (S.fr > 0.3) { H.arrow(bx + 98 + S.fr * 2.4, fy - 12, bx + 98, fy - 12, '#e53935', 8); }
  H.rect(40, 18, 560, 30, '#fff', 10, '#1b2236', 0.95);
  const sc = 520 / 50; H.line(60, 33, 580, 33, '#c5ccd6', 6);
  H.line(60 + S.FL * sc, 22, 60 + S.FL * sc, 44, '#e53935', 4); H.text(60 + S.FL * sc, 16, tx(['limit ', 'எல்லை ']) + S.FL.toFixed(0) + ' N', '#e53935', 12);
  H.E('polygon', { points: (60 + S.F * sc - 7) + ',24 ' + (60 + S.F * sc + 7) + ',24 ' + (60 + S.F * sc) + ',36', fill: '#0c9e83' });
  H.text(60 + S.F * sc, 62, tx(['your push ', 'உன் தள்ளல் ']) + S.F + ' N', '#0c9e83', 12);
  H.chittu(62, fy, 0.42, { wL: sliding ? 40 : 10, m: 0.3, eyes: sliding ? 'w' : 'n' });
  const msg: Pair = S.F === 0 ? ['Push the slider!', 'ஸ்லைடர நகர்த்து!'] : (sliding ? ['It slides! Push beat the limit', 'சறுக்குது! தள்ளல் எல்லைய தாண்டிடுச்சு'] : (S.F <= S.FL ? ['Friction = ' + S.F + ' N holds it still', 'உராய்வு = ' + S.F + ' N, பிடிச்சு வெச்சிருக்கு'] : ['Press Try to move it!', 'நகர்த்திப் பாக்க Try அழுத்து!']));
  H.say(150, fy - 84, msg, { col: '#e6f6ff', n: 20 });
}

export default function FrictionLab({ si = {}, legacy = 'c5' }: { si?: SiDict; legacy?: string }) {
  const text = useLabText(si);
  const { lang, lookup, tx } = text;
  const [rough, setRough] = useState(false);
  const [blocks, setBlocks] = useState(1);
  const [F, setF] = useState(5);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shake, setShake] = useState(0);
  const [chosen, setChosen] = useState(-1);
  const sim = useRef({ rough: false, blocks: 1, F: 5, t: 0 });
  sim.current = { rough, blocks, F, t };

  const phys = (c: typeof sim.current) => {
    const N = c.blocks * 20, FL = (c.rough ? 0.6 : 0.3) * N, FK = 0.75 * FL, slide = c.F > FL;
    const a = slide ? (c.F - FK) / (N / 10) : 0;
    return { FL, FK, slide, a, fr: slide ? FK : c.F, s: slide ? 0.5 * a * c.t * c.t : 0, sMax: slide ? 0.5 * a * TMAX * TMAX : 1 };
  };
  const P = phys(sim.current);
  const state = (): S => { const c = sim.current, p = phys(c); return { F: c.F, FL: shown(p.FL), fr: p.fr, s: p.s, rough: c.rough, blocks: c.blocks }; };
  const { done, last, touch } = useMissions(legacy, MISSIONS, state, [t, F, rough, blocks]);

  // sliding: real time, up to 6 s
  usePlayer(playing, setPlaying, (dt) => {
    const nt = Math.min(TMAX, sim.current.t + dt);
    sim.current = { ...sim.current, t: nt };
    setT(nt);
    return nt < TMAX;
  });

  const restart = () => { setPlaying(false); setT(0); sim.current = { ...sim.current, t: 0 }; };
  const change = (next: Partial<typeof sim.current>) => {
    touch();
    if (next.rough !== undefined) setRough(next.rough);
    if (next.blocks !== undefined) setBlocks(next.blocks);
    if (next.F !== undefined) setF(next.F);
    sim.current = { ...sim.current, ...next };
    restart();
  };
  // pushing less than the limit: the block shakes and stays (the page's jitter: 6 steps of 60 ms)
  const jiggle = () => { let k = 0; const id = setInterval(() => { k++; setShake(k % 2 ? 4 : 0); if (k >= 6) { clearInterval(id); setShake(0); } }, 60); };
  const togglePlay = () => {
    touch();
    if (playing) return setPlaying(false);
    if (!phys(sim.current).slide) return jiggle();
    if (sim.current.t >= TMAX) restart();
    setPlaying(true);
  };
  const tryIt = (i: number) => {
    const tr = TRIES[i]!;
    setChosen(i);
    change({ rough: tr.rough, blocks: tr.blocks, F: tr.F, t: 0 });
    setTimeout(() => { if (phys(sim.current).slide) setPlaying(true); else jiggle(); }, 60);
    markLab();
  };

  // the track: the block with the push (right) and friction (left) arrows
  const x0 = 40, x1 = 600, y = 45;
  const bx = x0 + x0 + (P.s / Math.max(P.sMax, 1)) * (x1 - x0 - 40) + shake;
  const faLen = Math.min(F, FMAX) / FMAX * 70, frLen = P.fr / FMAX * 70;
  // the graph: friction against the push
  const g0 = 50, g1 = 520, gt = 20, gb = 180, gmx = (f: number) => g0 + f / FMAX * (g1 - g0), gmy = (fr: number) => gb - fr / (FMAX * 0.7) * (gb - gt);
  const fric = `M ${gmx(0)} ${gmy(0)} L ${gmx(P.FL)} ${gmy(P.FL)} L ${gmx(P.FL)} ${gmy(P.FK)} L ${gmx(FMAX)} ${gmy(P.FK)}`;
  const toggle = (on: boolean, label: Pair, onClick: () => void) => <button type="button" class={'toggle-btn' + (on ? ' active' : '')} onClick={onClick}>{tx(label)}</button>;
  return (
    <div class="lab-card">
      <LabGuide tx={tx} goal={W.goal} look={W.look} tries={TRIES} chosen={chosen} onTry={tryIt} now={live(F, shown(P.FL))} />
      <LabStage text={text} draw={(tt, H) => drawStage(state(), tt, H, tx)} missions={MISSIONS} done={done} deps={[t, F, rough, blocks]} note={last >= 0 ? tx(SHARED.missionDone) + tx(SHARED.now) + tx(live(F, shown(P.FL))) : ''} />
      <div class="toggle-row">
        <div class="toggle-group">
          <div class="tglabel">{tx(W.surface)}</div>
          <div class="toggle-btns">{toggle(!rough, W.smooth, () => change({ rough: false }))}{toggle(rough, W.rough, () => change({ rough: true }))}</div>
        </div>
        <div class="toggle-group">
          <div class="tglabel">{tx(W.weight)}</div>
          <div class="toggle-btns">{([1, 2, 3] as const).map((n) => toggle(blocks === n, [W.b1, W.b2, W.b3][n - 1]!, () => change({ blocks: n })))}</div>
        </div>
      </div>
      <div class="control">
        <label for="fSlider"><span>{tx(W.F)}</span>, F = <b>{F.toFixed(0)}</b> N</label>
        <input type="range" id="fSlider" min="0" max="50" step="1" value={F} onInput={(e) => change({ F: parseFloat((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="a-readout">
        <span>{tx(W.status)}</span> <b data-ro="status" class={P.slide ? 'status-sliding' : 'status-still'}>{tx(P.slide ? W.sliding : W.still)}</b>
        {' · '}<span>{tx(W.limit)}</span> <b data-ro="limit">{P.FL.toFixed(1)} N</b>
      </div>
      <Readouts items={[[tx(W.fr), P.fr.toFixed(1) + ' N', 'fr'], [tx(W.t), t.toFixed(1) + ' s', 't'], [tx(W.s), P.s.toFixed(1) + ' m', 's']]} />
      <div class="lab-buttons" style={{ marginBottom: '18px' }}>
        <button type="button" class="btn primary" onClick={togglePlay}>{tx(playing ? SHARED.pause : W.play)}</button>
        <button type="button" class="btn" onClick={() => { touch(); restart(); }}>{tx(SHARED.reset)}</button>
      </div>
      <div class="track-wrap">
        <svg viewBox="0 0 640 90" width="100%" style={{ minWidth: '480px' }} aria-hidden="true">
          <defs>
            <marker id="fl-arrF" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--accent-3)' }} /></marker>
            <marker id="fl-arrR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--danger)' }} /></marker>
          </defs>
          <line x1={x0} y1={y} x2={x1} y2={y} style={{ stroke: 'var(--border)' }} stroke-width="3" />
          <rect x={bx} y={y - 16} width="36" height="32" rx="5" style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} stroke-width="2" />
          <line x1={bx + 36} y1={y} x2={bx + 36 + faLen} y2={y} style={{ stroke: 'var(--accent-3)' }} stroke-width="3" marker-end="url(#fl-arrF)" />
          <line x1={bx} y1={y} x2={bx - frLen} y2={y} style={{ stroke: 'var(--danger)' }} stroke-width="3" marker-end="url(#fl-arrR)" />
          <text x={bx - 4} y={y - 22} font-size="11" font-weight="700" style={{ fill: 'var(--text)' }}>{P.s.toFixed(1)} m</text>
        </svg>
      </div>
      <div class="graphs-row">
        <div class="graph-box">
          <div class="gtitle">{tx(W.graph)}</div>
          <svg viewBox="0 0 560 220" width="100%" aria-hidden="true">
            <line x1={g0} y1={gb} x2={g1} y2={gb} style={{ stroke: 'var(--text-faint)' }} stroke-width="1.5" />
            <line x1={g0} y1={gt} x2={g0} y2={gb} style={{ stroke: 'var(--text-faint)' }} stroke-width="1.5" />
            <path d={fric} fill="none" style={{ stroke: 'var(--accent-2)' }} stroke-width="3" stroke-linejoin="round" />
            <circle cx={gmx(F)} cy={gmy(P.fr)} r="6" style={{ fill: 'var(--accent)' }} />
            <text x={g1 - 70} y={gb + 20} font-size="12" style={{ fill: 'var(--text-faint)' }}>{tx(W.gx)}</text>
            <text x="4" y={gt + 2} font-size="12" style={{ fill: 'var(--text-faint)' }}>{tx(W.gy)}</text>
            <line x1={gmx(P.FL)} y1={gb} x2={gmx(P.FL)} y2={gmy(P.FL)} style={{ stroke: 'var(--accent-3)' }} stroke-width="1" stroke-dasharray="3 3" />
            <text x={gmx(P.FL) - 14} y={gb + 35} font-size="10" style={{ fill: 'var(--accent-3)' }}>{tx(W.glimit)}</text>
          </svg>
        </div>
      </div>
      <p class="lab-hint">{lang === 'ta' ? HINT[1] : lang === 'si' ? lookup(HINT[0]) || HINT[0] : HINT[0]}</p>
    </div>
  );
}
