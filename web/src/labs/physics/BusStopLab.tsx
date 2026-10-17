import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../../stores/prefs';
import { markLab, usePlayer, type Pair } from '../shared';
import { LEVELS, at, dirn, total, type Leg, type Level, type Place, type Pt, type Vals } from './bus-stop-levels';

/*
 * Unit 2, Lab 1: "Cycling to the Bus Stop" (sections 2.1, 2.2, 2.3, 2.5). Nimal rides from home to the school bus; each
 * stop on the way is a level (bus-stop-levels.ts) with three stars: predict the ride (with a coin bet), read its graph
 * (tap or point at it), and reach the goal by setting the ride yourself. Coins buy things for the bike in the bike shop.
 * Stars, coins and the bike are kept on this device (scx_bus_v1); the first star counts as doing the lab step.
 */

type Tx = (p: Pair) => string;
type Phase = 'ask' | 'ride' | 'told' | 'read' | 'goal' | 'goalRide' | 'end';
interface Save { stars: number[]; coins: number; own: string[]; wear: string[] }

const KEY = 'scx_bus_v1';
const START: Save = { stars: LEVELS.map(() => 0), coins: 10, own: [], wear: [] };
const BETS = [1, 2, 3, 5];
const STAR = { ask: 1, read: 2, goal: 4 };
/** A stop is cleared when its goal is reached (all three steps done): only then does the next stop open. */
const CLEAR = 8;
const PAY = { read: 2, goal: 3 };

const ITEMS: { id: string; l: Pair; price: number }[] = [
  { id: 'bell', l: ['Bell', 'மணி', 'සීනුව'], price: 5 },
  { id: 'helmet', l: ['Helmet', 'தலைக்கவசம்', 'හිස්වැස්ම'], price: 8 },
  { id: 'basket', l: ['Basket', 'கூடை', 'කූඩය'], price: 10 },
  { id: 'flag', l: ['Flag', 'கொடி', 'කොඩිය'], price: 12 },
  { id: 'gold', l: ['Gold paint', 'தங்க நிறம்', 'රන් පාට'], price: 20 },
];

const W = {
  kicker: ['Grade 10 Physics · Unit 2 · Lab 1', 'தரம் 10 இயற்பியல் · அலகு 2 · ஆய்வகம் 1', '10 ශ්‍රේණිය භෞතික විද්‍යාව · ඒකකය 2 · විද්‍යාගාරය 1'],
  title: ['Cycling to the Bus Stop', 'பஸ் நிறுத்தத்துக்கு சைக்கிளில்', 'බස් නැවතුමට බයිසිකලයෙන්'],
  intro: [
    'Help Nimal get from home to the school bus. Each stop on the way is a level. Bet coins on your predictions, hit the goals, and collect up to 3 stars per level.',
    'நிமல் வீட்டிலிருந்து பள்ளி பஸ்ஸுக்குப் போக உதவு. வழியிலுள்ள ஒவ்வொரு நிறுத்தமும் ஒரு நிலை. உன் கணிப்புகளுக்கு நாணயம் பந்தயம் கட்டு, இலக்குகளை அடை, ஒவ்வொரு நிலையிலும் 3 நட்சத்திரங்கள் வரை சேர்.',
    'නිමල්ට ගෙදර සිට පාසල් බසයට යන්න උදව් කරන්න. මඟ දිගේ ඇති සෑම නැවතුමක්ම එක් මට්ටමකි. ඔබේ අනාවැකි මත කාසි ඔට්ටු අල්ලන්න, ඉලක්ක සපුරන්න, සෑම මට්ටමකින්ම තරු 3ක් දක්වා එකතු කරන්න.',
  ],
  stars: ['Stars', 'நட்சத்திரங்கள்', 'තරු'],
  coins: ['Coins', 'நாணயங்கள்', 'කාසි'],
  route: ['The way to the bus', 'பஸ்ஸுக்குப் போகும் வழி', 'බසයට යන මඟ'],
  level: ['Level', 'நிலை', 'මට්ටම'],
  locked: ['Clear the stop before to open this one.', 'இதைத் திறக்க முந்தைய நிறுத்தத்தை முடி.', 'මෙය විවෘත කිරීමට පෙර නැවතුම නිම කරන්න.'],
  finishFirst: ['Finish this stop first: all three steps.', 'முதலில் இந்த நிறுத்தத்தின் மூன்று படிகளையும் முடி.', 'මුලින්ම මෙම නැවතුමේ පියවර තුනම නිම කරන්න.'],
  stepOf: ['Step {n} of 3', 'படி {n} / 3', 'පියවර {n} / 3'],
  do0: ['Read the story and find the places on the road. Then pick your answer, place a bet and ride.', 'கதையைப் படி, சாலையில் இடங்களைப் பார். பிறகு விடையைத் தேர்ந்தெடு, பந்தயம் கட்டி ஓட்டு.', 'කතාව කියවා පාරේ ස්ථාන සොයාගන්න. ඉන්පසු පිළිතුර තෝරා, ඔට්ටුවක් අල්ලා පදින්න.'],
  do1: ['Watch the ride again with its graph: the line grows as Nimal moves. Replay it or drag the time slider as often as you like, then tap the graph to answer.', 'பயணத்தை அதன் வரைபுடன் மீண்டும் பார்: நிமல் நகரும்போது கோடு வளர்கிறது. எத்தனை முறை வேண்டுமானாலும் மீண்டும் பார் அல்லது நேர ஸ்லைடரை இழு, பிறகு விடையளிக்க வரைபைத் தொடு.', 'ගමන එහි ප්‍රස්තාරය සමඟ නැවත බලන්න: නිමල් චලනය වන විට රේඛාව වර්ධනය වේ. කැමති තරම් නැවත බලන්න හෝ කාල ස්ලයිඩරය අදින්න, ඉන්පසු පිළිතුරු දීමට ප්‍රස්තාරය තට්ටු කරන්න.'],
  question: ['Question', 'கேள்வி', 'ප්‍රශ්නය'],
  lockIn: ['Lock in', 'உறுதிசெய்', 'තහවුරු කරන්න'],
  yourPoint: ['Your point: ', 'உன் புள்ளி: ', 'ඔබේ ලක්ෂ්‍යය: '],
  watchAgain: ['↻ Watch again', '↻ மீண்டும் பார்', '↻ නැවත බලන්න'],
  pause: ['⏸ Pause', '⏸ நிறுத்து', '⏸ නවත්වන්න'],
  scrub: ['Move through the ride', 'பயணத்தில் முன்னும் பின்னும் நகர்', 'ගමන හරහා ඉදිරියට හා පසුපසට යන්න'],
  do2: ['Now you plan the ride: move the slider, then press Ride. Try as many times as you like.', 'இப்போது நீ பயணத்தைத் திட்டமிடு: ஸ்லைடரை நகர்த்தி, ஓட்டு அழுத்து. எத்தனை முறை வேண்டுமானாலும் முயற்சி செய்.', 'දැන් ඔබ ගමන සැලසුම් කරන්න: ස්ලයිඩරය චලනය කර, පදින්න ඔබන්න. කැමති තරම් වාර ගණනක් උත්සාහ කරන්න.'],
  do3: ['Stop cleared! The next stop is open.', 'நிறுத்தம் முடிந்தது! அடுத்த நிறுத்தம் திறந்துவிட்டது.', 'නැවතුම නිම කළා! ඊළඟ නැවතුම විවෘතයි.'],
  sPredict: ['Predict', 'கணி', 'අනාවැකිය'],
  sRead: ['Read the graph', 'வரைபைப் படி', 'ප්‍රස්තාරය කියවන්න'],
  sGoal: ['Hit the goal', 'இலக்கை அடை', 'ඉලක්කය සපුරන්න'],
  bet: ['Your bet', 'உன் பந்தயம்', 'ඔබේ ඔට්ටුව'],
  betNote: ['Right: win your bet. Wrong: lose it.', 'சரி என்றால் பந்தயத் தொகையை வெல்வாய். தவறு என்றால் இழப்பாய்.', 'හරි නම් ඔට්ටු මුදල දිනනවා. වැරදි නම් අහිමි වෙනවා.'],
  noBet: ['You got this one right before: no bet this time.', 'இதை முன்பே சரியாகச் சொன்னாய்: இந்த முறை பந்தயம் இல்லை.', 'ඔබ මෙය කලින් හරියට කීවා: මෙවර ඔට්ටුවක් නැත.'],
  free: ['No coins left: this one is a free try.', 'நாணயம் இல்லை: இது இலவச முயற்சி.', 'කාසි ඉතිරි නැත: මෙය නොමිලේ උත්සාහයකි.'],
  pick: ['Pick an answer first.', 'முதலில் ஒரு விடையைத் தேர்ந்தெடு.', 'මුලින්ම පිළිතුරක් තෝරන්න.'],
  lockRide: ['Lock in and ride', 'உறுதிசெய்து ஓட்டு', 'තහවුරු කර පදින්න'],
  ride: ['▶ Ride', '▶ ஓட்டு', '▶ පදින්න'],
  riding: ['Riding…', 'ஓட்டுகிறான்…', 'පදිනවා…'],
  right: ['Right!', 'சரி!', 'හරි!'],
  wrong: ['Not this time.', 'இந்த முறை இல்லை.', 'මෙවර නොවේ.'],
  won: ['You won Rs ', 'நீ வென்றது Rs ', 'ඔබ දිනුවා Rs '],
  lost: ['You lost Rs ', 'நீ இழந்தது Rs ', 'ඔබට අහිමි වුණා Rs '],
  earn: ['You earned Rs ', 'நீ சம்பாதித்தது Rs ', 'ඔබ උපයා ගත්තා Rs '],
  answer: ['The answer: ', 'விடை: ', 'පිළිතුර: '],
  toRead: ['Next: read the graph', 'அடுத்து: வரைபைப் படி', 'ඊළඟට: ප්‍රස්තාරය කියවන්න'],
  check: ['Check', 'சரிபார்', 'පරීක්ෂා කරන්න'],
  pinFirst: ['Tap the graph first.', 'முதலில் வரைபைத் தொடு.', 'මුලින්ම ප්‍රස්තාරය තට්ටු කරන්න.'],
  readWrong: ['Not quite. Look at the graph again.', 'சரியாக இல்லை. வரைபை மீண்டும் பார்.', 'හරියටම නැහැ. ප්‍රස්තාරය නැවත බලන්න.'],
  toGoal: ['Next: the goal', 'அடுத்து: இலக்கு', 'ඊළඟට: ඉලක්කය'],
  skip: ['Skip to the goal', 'இலக்குக்குத் தாவு', 'ඉලක්කයට යන්න'],
  notYet: ['Not yet. ', 'இன்னும் இல்லை. ', 'තවම නැහැ. '],
  goalHit: ['Goal! ', 'இலக்கு! ', 'ඉලක්කය! '],
  showHow: ['Show me how', 'எப்படி என்று காட்டு', 'කොහොමද කියා පෙන්වන්න'],
  next: ['Next stop →', 'அடுத்த நிறுத்தம் →', 'ඊළඟ නැවතුම →'],
  again: ['Play this stop again', 'இந்த நிறுத்தத்தை மீண்டும் விளையாடு', 'මෙම නැවතුම නැවත ක්‍රීඩා කරන්න'],
  levelDone: ['Stop cleared', 'நிறுத்தம் முடிந்தது', 'නැවතුම නිම කළා'],
  allDone: ['Nimal made it to the school bus!', 'நிமல் பள்ளி பஸ்ஸைப் பிடித்துவிட்டான்!', 'නිමල් පාසල් බසයට අල්ලගත්තා!'],
  shop: ['Bike shop', 'சைக்கிள் கடை', 'බයිසිකල් කඩේ'],
  shopSub: ['Spend coins you win from good predictions', 'நல்ல கணிப்புகளால் வென்ற நாணயங்களைச் செலவழி', 'හොඳ අනාවැකිවලින් දිනූ කාසි වියදම් කරන්න'],
  buy: ['Buy', 'வாங்கு', 'මිලදී ගන්න'],
  wear: ['Put on', 'பொருத்து', 'සවි කරන්න'],
  off: ['Take off', 'கழற்று', 'ගලවන්න'],
  short: ['Not enough coins', 'நாணயம் போதாது', 'කාසි මදි'],
  tap: ['Tap or point at the graph to read a value.', 'ஒரு மதிப்பைப் படிக்க வரைபைத் தொடு அல்லது சுட்டு.', 'අගයක් කියවීමට ප්‍රස්තාරය මත තට්ටු කරන්න හෝ යොමු කරන්න.'],
  keys: ['Keys: ← → move, Enter marks the point.', 'விசைகள்: ← → நகர்த்து, Enter புள்ளியைக் குறிக்கும்.', 'යතුරු: ← → චලනය, Enter ලක්ෂ්‍යය සලකුණු කරයි.'],
  st: ['Displacement–time graph', 'இடப்பெயர்ச்சி–நேர வரைபு', 'විස්ථාපන–කාල ප්‍රස්තාරය'],
  vt: ['Velocity–time graph', 'திசைவேக–நேர வரைபு', 'ප්‍රවේග–කාල ප්‍රස්තාරය'],
  t: ['Time', 'நேரம்', 'කාලය'],
  v: ['Velocity', 'திசைவேகம்', 'ප්‍රවේගය'],
  d: ['Distance', 'தூரம்', 'දුර'],
  s: ['Displacement', 'இடப்பெயர்ச்சி', 'විස්ථාපනය'],
  home: ['Home', 'வீடு', 'ගෙදර'],
  scene: ['Nimal on the road', 'சாலையில் நிமல்', 'පාරේ නිමල්'],
  reset: ['Start the whole ride again', 'முழுப் பயணத்தையும் மீண்டும் தொடங்கு', 'මුළු ගමනම නැවත අරඹන්න'],
  resetAsk: ['Start again? This clears your stars, coins and bike.', 'மீண்டும் தொடங்கவா? நட்சத்திரங்கள், நாணயங்கள், சைக்கிள் எல்லாம் அழியும்.', 'නැවත අරඹන්නද? ඔබේ තරු, කාසි සහ බයිසිකලය මැකේ.'],
} satisfies Record<string, Pair>;

const fmt = (x: number) => { const v = Math.round(x * 10) / 10; return (Object.is(v, -0) ? 0 : v).toFixed(1); };
const bits = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
const calm = () => typeof document !== 'undefined' && document.documentElement.classList.contains('stem-calm');

function load(): Save {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && Array.isArray(j.stars)) {
      return {
        // a goal reached before stops had to be cleared counts as cleared
        stars: LEVELS.map((_, i) => { const m = (Number(j.stars[i]) | 0) & 15; return m & STAR.goal ? m | CLEAR : m; }),
        coins: Math.max(0, Number(j.coins) | 0),
        own: Array.isArray(j.own) ? j.own.filter((x: unknown) => typeof x === 'string') : [],
        wear: Array.isArray(j.wear) ? j.wear.filter((x: unknown) => typeof x === 'string') : [],
      };
    }
  } catch { /* private mode or bad data */ }
  return { ...START, stars: [...START.stars] };
}

/** The span of the road to draw for a ride (always home, and the goal's marker). */
function span(legs: Leg[], extra: number[]): [number, number] {
  const T = total(legs);
  let lo = 0, hi = 0;
  for (let i = 0; i <= 80; i++) { const s = at(legs, T * i / 80).s; lo = Math.min(lo, s); hi = Math.max(hi, s); }
  for (const x of extra) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  if (hi - lo < 20) hi = lo + 20;
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}
function ticks(lo: number, hi: number, want = 5): number[] {
  const raw = (hi - lo) / want, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const out: number[] = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

/** Nimal on his bike, at the road's edge (0, 0), facing east (dir 1) or west (-1); the wheels turn with the distance. */
function Bike({ x, dir, turn, wear }: { x: number; dir: number; turn: number; wear: string[] }) {
  const has = (k: string) => wear.includes(k);
  const frame = has('gold') ? '#E0A400' : 'var(--sc-blue)';
  const spokes = (cx: number) => [0, 60, 120].map((d) => <line x1={cx} y1={-13} x2={cx} y2={-1} transform={`rotate(${d + turn} ${cx} -13)`} class="bk-spoke" />);
  return (
    <g transform={`translate(${x} 0) scale(${dir} 1)`} class="bk">
      {has('flag') && <g><line x1="-22" y1="-14" x2="-26" y2="-66" class="bk-pole" /><path d="M-26 -66 L-6 -60 L-26 -54 Z" fill="#E53935" /></g>}
      <circle cx="-18" cy="-13" r="12" class="bk-wheel" />{spokes(-18)}
      <circle cx="18" cy="-13" r="12" class="bk-wheel" />{spokes(18)}
      <path d="M-18 -13 L-4 -13 L-8 -32 Z M-4 -13 L14 -32 L-8 -32 M14 -32 L18 -13" fill="none" stroke={frame} stroke-width="3.2" stroke-linejoin="round" />
      <line x1="14" y1="-32" x2="12" y2="-40" stroke={frame} stroke-width="3" /><line x1="9" y1="-40" x2="17" y2="-40" class="bk-bar" />
      <line x1="-12" y1="-34" x2="-4" y2="-34" class="bk-bar" />
      {has('basket') && <path d="M16 -46 h13 l-2 10 h-9 Z" fill="#B7793A" stroke="#7A4E22" stroke-width="1.2" />}
      {has('bell') && <circle cx="10" cy="-43" r="2.8" fill="#FFC928" stroke="#9A7400" stroke-width="1" />}
      {/* Nimal: white school shirt, blue shorts */}
      <path d="M-8 -36 L0 -16 M-6 -36 L4 -22 L-2 -12" class="bk-leg" />
      <path d="M-9 -38 L1 -62" class="bk-body" />
      <path d="M-1 -58 L13 -42" class="bk-arm" />
      <circle cx="3" cy="-70" r="8.5" fill="#8D5524" />
      <circle cx="6" cy="-71" r="1.3" fill="#1b1b1b" />
      {has('helmet')
        ? <path d="M-6.5 -71 a10 10 0 0 1 19 -1 Z" fill="#E53935" stroke="#9E1F1F" stroke-width="1" />
        : <path d="M-5 -73 a8.5 8 0 0 1 16 -2 q-6 -3 -16 2 Z" fill="#1b1b1b" />}
    </g>
  );
}

/** The road from the side: the start (Nimal's home or a sign), the places of the story, Nimal, and the displacement arrow. */
function Scene({ tx, legs, t, start, home, places, ticks: showTicks, wear, strip = false }: { tx: Tx; legs: Leg[]; t: number; start: Pair; home: boolean; places: Place[]; ticks: boolean; wear: string[]; strip?: boolean }) {
  const now = at(legs, t);
  const [lo, hi] = span(legs, places.map((p) => p.s));
  const X = (s: number) => 64 + (s - lo) / (hi - lo) * 550;
  const dir = now.v < -0.01 ? -1 : now.v > 0.01 ? 1 : (at(legs, Math.max(0, t - 0.05)).v < 0 ? -1 : 1);
  const disp = dirn(now.s);
  const ax0 = X(0), ax1 = X(now.s);
  const width = (p: Pair) => Math.max(56, tx(p).length * 7.2 + 16);
  // signs side by side would overlap: every other one that is too close stands higher
  const signs = [{ s: 0, l: start, first: true }, ...places.map((p) => ({ ...p, first: false }))].filter((p) => !(p.first && home)).sort((a, b) => a.s - b.s);
  let lastX = -1e9, lastW = 0, up = false;
  const placed = signs.map((p) => {
    const x = X(p.s), w = width(p.l);
    up = Math.abs(x - lastX) < (w + lastW) / 2 + 6 ? !up : false;
    lastX = x; lastW = w;
    return { ...p, x, w, y: up ? -132 : -106 };
  });
  return (
    <svg class={'bus-scene' + (strip ? ' strip' : '')} viewBox={strip ? '0 64 640 166' : '0 0 640 230'} role="img" aria-label={tx(W.scene) + ': ' + [tx(start), ...places.map((p) => tx(p.l) + ' ' + p.s + ' m')].join(', ') + '. ' + tx(W.s) + ' ' + tx(disp) + ', ' + tx(W.d) + ' ' + fmt(now.dist) + ' m'}>
      <rect x="0" y="0" width="640" height="150" class="sky" />
      <circle cx="30" cy="28" r="15" class="sun" />
      <path d="M0 122 Q90 92 180 118 T380 112 T640 116 V150 H0 Z" class="hill" />
      {[70, 250, 470].map((tx0) => <g transform={`translate(${tx0} 118)`}><rect x="-3" y="0" width="6" height="22" fill="#7A5230" /><circle cx="0" cy="-6" r="15" class="tree" /></g>)}
      <rect x="0" y="150" width="640" height="34" class="road" />
      <line x1="0" y1="167" x2="640" y2="167" class="lane" />
      <rect x="0" y="184" width="640" height="46" class="verge" />
      {home && (
        <g transform={`translate(${ax0 - 34} 150)`}>
          <rect x="-16" y="-30" width="32" height="30" class="house" /><path d="M-21 -30 L0 -48 L21 -30 Z" class="roof" /><rect x="-5" y="-15" width="10" height="15" class="door" />
          <text x="0" y="-53" class="lbl">{tx(start)}</text>
        </g>
      )}
      {placed.map((p) => (
        <g transform={`translate(${p.x} 150)`} class={p.first ? 'start' : ''}>
          <line x1="0" y1="0" x2="0" y2={p.y + 18} class="post" /><rect x={-p.w / 2} y={p.y} width={p.w} height="18" rx="4" class="sign" />
          <text x="0" y={p.y + 13} class="sign-t">{tx(p.l)}</text>
        </g>
      ))}
      <line x1={ax0} y1="152" x2={ax0} y2="182" class="zero" />
      {showTicks && ticks(lo, hi).map((m) => <g><line x1={X(m)} y1="184" x2={X(m)} y2="190" class="tick" /><text x={X(m)} y="201" class="tick-t">{m} m</text></g>)}
      {/* displacement: from the start to Nimal */}
      {Math.abs(ax1 - ax0) > 4 && (
        <g class="disp">
          <line x1={ax0} y1="216" x2={ax1} y2="216" />
          <path d={ax1 > ax0 ? `M${ax1} 216 l-8 -5 v10 Z` : `M${ax1} 216 l8 -5 v10 Z`} />
          <text x={(ax0 + ax1) / 2} y="211">{tx(disp)}</text>
        </g>
      )}
      <g transform="translate(0 150)"><Bike x={X(now.s)} dir={dir} turn={(now.dist / 12) * 57.3} wear={wear} /></g>
    </svg>
  );
}

/**
 * A graph of the ride against time, drawn up to `upto`. When `onPin` is given it reads values: point at it (or move
 * along it with the arrow keys) to read t and the value; tap (or Enter) to mark a point.
 */
function TapGraph({ tx, legs, kind, upto, ghost = false, pin, onPin }: { tx: Tx; legs: Leg[]; kind: 's' | 'v'; upto: number; ghost?: boolean; pin: number | null; onPin?: (t: number) => void }) {
  const T = Math.max(total(legs), 0.001);
  const val = (t: number) => (kind === 's' ? at(legs, t).s : at(legs, t).v);
  const x0 = 50, x1 = 306, y0 = 16, y1 = 168;
  let lo = 0, hi = 0;
  const pts: [number, number][] = [];
  let t0 = 0;
  for (const l of legs) {
    if (l.d <= 0) continue;
    for (let i = 0; i <= 24; i++) { const tt = t0 + l.d * i / 24; const p = at(legs, tt); const y = kind === 's' ? p.s : (i === 0 ? l.v : p.v); pts.push([tt, y]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    t0 += l.d;
  }
  if (hi - lo < 1) hi = lo + 1;
  const pad = (hi - lo) * 0.06; lo = lo < 0 ? lo - pad : lo; hi += pad;
  const X = (t: number) => x0 + t / T * (x1 - x0), Y = (y: number) => y1 - (y - lo) / (hi - lo) * (y1 - y0);
  const path = (ps: [number, number][]) => ps.map(([tt, y], i) => (i ? 'L' : 'M') + X(tt).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
  const d = path([...pts.filter(([tt]) => tt <= upto + 1e-6), ...(upto > 0 && upto < T ? [[upto, val(upto)] as [number, number]] : [])]);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const cur = hover ?? pin;
  const unit = kind === 's' ? 'm' : 'm/s';
  const reading = (t: number) => tx(W.t) + ' ' + fmt(t) + ' s · ' + tx(kind === 's' ? W.s : W.v) + ' ' + fmt(val(t)) + ' ' + unit;
  const tAt = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * 320;
    return Math.min(T, Math.max(0, (px - x0) / (x1 - x0) * T));
  };
  const snap = (t: number) => Math.round(t * 10) / 10;
  const step = T <= 12 ? 0.1 : 0.5;
  const key = (e: KeyboardEvent) => {
    if (!onPin) return;
    const c = cur ?? 0;
    const by = e.key === 'PageUp' ? 10 * step : e.key === 'PageDown' ? -10 * step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (by) { e.preventDefault(); setHover(snap(Math.min(T, Math.max(0, c + by)))); }
    else if (e.key === 'Home') { e.preventDefault(); setHover(0); }
    else if (e.key === 'End') { e.preventDefault(); setHover(snap(T)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(c); }
  };
  const live = onPin && cur !== null ? reading(cur) : '';
  return (
    <figure class={'bus-graph' + (onPin ? ' tap' : '')}>
      <figcaption>{tx(kind === 's' ? W.st : W.vt)}</figcaption>
      <svg ref={svg} viewBox="0 0 320 196"
        {...(onPin ? {
          tabindex: 0, role: 'slider', 'aria-label': tx(kind === 's' ? W.st : W.vt), 'aria-valuemin': 0, 'aria-valuemax': Math.round(T * 10) / 10, 'aria-valuenow': cur ?? 0, 'aria-valuetext': live || tx(W.tap),
          onPointerMove: (e: PointerEvent) => setHover(snap(tAt(e))),
          onPointerLeave: (e: PointerEvent) => { if (e.pointerType === 'mouse') setHover(null); },
          onPointerDown: (e: PointerEvent) => { const t = snap(tAt(e)); setHover(t); onPin(t); },
          onKeyDown: key,
        } : { 'aria-hidden': 'true' })}>
        {ticks(lo, hi, 4).map((y) => <g><line x1={x0} y1={Y(y)} x2={x1} y2={Y(y)} class={y === 0 ? 'g-zero' : 'g-grid'} /><text x={x0 - 6} y={Y(y) + 4} class="g-yt">{y}</text></g>)}
        {ticks(0, T, 5).map((t) => <g><line x1={X(t)} y1={y0} x2={X(t)} y2={y1} class="g-grid" /><text x={X(t)} y={y1 + 15} class="g-xt">{t}</text></g>)}
        <line x1={x0} y1={y0} x2={x0} y2={y1} class="g-axis" /><line x1={x0} y1={y1} x2={x1} y2={y1} class="g-axis" />
        <text x={x1} y={y1 + 28} class="g-name end">t (s)</text>
        <text x={x0 - 44} y={y0 - 4} class="g-name">{kind === 's' ? 's (m)' : 'v (m/s)'}</text>
        {ghost && <path d={path(pts)} class="g-ghost" />}
        <path d={d} class="g-line" />
        {upto > 0 && upto < T && <circle cx={X(upto)} cy={Y(val(upto))} r="5" class="g-now" />}
        {pin !== null && <g class="g-pin"><line x1={X(pin)} y1={y0} x2={X(pin)} y2={y1} /><circle cx={X(pin)} cy={Y(val(pin))} r="6" /></g>}
        {onPin && cur !== null && (
          <g class="g-cur">
            <line x1={X(cur)} y1={y0} x2={X(cur)} y2={y1} /><line x1={x0} y1={Y(val(cur))} x2={X(cur)} y2={Y(val(cur))} />
            <circle cx={X(cur)} cy={Y(val(cur))} r="4.5" />
          </g>
        )}
      </svg>
      {onPin && <p class="g-read" aria-live="polite">{live || tx(W.tap)}</p>}
    </figure>
  );
}

function Readouts({ tx, p, t }: { tx: Tx; p: Pt; t: number }) {
  return (
    <dl class="bus-ro">
      <div><dt>{tx(W.t)}</dt><dd>{fmt(t)} s</dd></div>
      <div><dt>{tx(W.v)}</dt><dd>{fmt(p.v)} m/s</dd></div>
      <div class="ro-d"><dt>{tx(W.d)}</dt><dd>{fmt(p.dist)} m</dd></div>
      <div class="ro-s"><dt>{tx(W.s)}</dt><dd>{tx(dirn(p.s))}</dd></div>
    </dl>
  );
}

const Stars = ({ m, label }: { m: number; label?: string }) => (
  <span class="bus-stars" aria-label={label}>{[1, 2, 4].map((b) => <span class={m & b ? 'on' : ''} aria-hidden="true">★</span>)}</span>
);

export default function BusStopLab() {
  const lang = useStore($lang);
  const tx: Tx = (p) => (lang === 'ta' ? p[1] : lang === 'si' ? p[2] || p[0] : p[0]);
  const [save, setSave] = useState<Save>(START);
  const [lv, setLv] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [pick, setPick] = useState(-1);
  const [bet, setBet] = useState(1);
  const [betOn, setBetOn] = useState(true);       // the bet placed on this ride counts (not a replay of a right answer)
  const [won, setWon] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pin, setPin] = useState<number | null>(null);
  const [readMsg, setReadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [misses, setMisses] = useState(0);
  const [ctl, setCtl] = useState<Vals>({});
  const [goalMsg, setGoalMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState('');
  const loaded = useRef(false);
  // On a phone the picture (the road, or the graph while it is read) stays pinned under the lesson's header and the
  // question with its main button stays in a bar above the lesson's bottom bar; the rest scrolls between them.
  const [phone, setPhone] = useState(false);
  const [edges, setEdges] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const mq = matchMedia('(max-width: 720px)');
    const on = () => setPhone(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!phone) return;
    const measure = () => {
      const head = document.querySelector<HTMLElement>('.lhead'), end = document.querySelector<HTMLElement>('.lend');
      const cs = end && getComputedStyle(end);
      setEdges({ top: head ? head.getBoundingClientRect().height : 0, bottom: end && cs && cs.display !== 'none' ? end.offsetHeight + (parseFloat(cs.bottom) || 0) : 0 });
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [phone]);
  const panel = useRef<HTMLDivElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  /** Bring the question's details (story, choices, sliders, explanations) up under the pinned picture. */
  const toPanel = () => {
    const top = panel.current?.getBoundingClientRect().top, h = stageBox.current?.offsetHeight;
    if (top !== undefined && h !== undefined) scrollBy({ top: top - (edges.top + h + 8), behavior: calm() ? 'auto' : 'smooth' });
  };

  const L: Level = LEVELS[lv]!;
  const goalLegs = L.goal.legs(ctl);
  const rideLegs = phase === 'goal' || phase === 'goalRide' || (phase === 'end' && goalMsg) ? goalLegs : L.legs;
  const T = total(rideLegs);
  const totalStars = save.stars.reduce((n, m) => n + bits(m), 0);
  const unlocked = (i: number) => i === 0 || !!(save.stars[i - 1]! & CLEAR);
  // in the middle of a stop (after locking in a prediction, before its goal) the other stops wait
  const busy = phase !== 'ask' && phase !== 'end';

  useEffect(() => { if (loaded.current) { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ } } }, [save]);
  // open on the first stop not cleared yet (the last one when all are)
  useEffect(() => {
    const s = load(); loaded.current = true; setSave(s);
    const next = s.stars.findIndex((m) => !(m & CLEAR));
    startLevel(next < 0 ? LEVELS.length - 1 : next, s);
  }, []);

  function startLevel(i: number, s: Save = save) {
    const lvl = LEVELS[i]!;
    setLv(i); setPhase('ask'); setPick(-1); setWon(null); setT(0); setPlaying(false); setPin(null); setReadMsg(null); setMisses(0);
    setCtl(Object.fromEntries(lvl.goal.controls.map((c) => [c.key, c.start]))); setGoalMsg(null); setTries(0); setNote('');
    setBetOn(!(s.stars[i]! & STAR.ask));
    setBet(Math.min(1, s.coins));
  }

  const award = (bit: number, coins: number) => setSave((s) => {
    const first = !(s.stars[lv]! & bit);
    if (first && s.stars.every((m) => m === 0)) markLab();
    return { ...s, stars: s.stars.map((m, i) => (i === lv ? m | bit : m)), coins: Math.max(0, s.coins + (first || bit === STAR.ask ? coins : 0)) };
  });

  // the ride plays in about 3–5 s of real time, whatever its length
  const speed = Math.max(T / 5, Math.min(T / 3, 6));
  const tNow = useRef(0);
  tNow.current = t;
  usePlayer(playing, setPlaying, (dt) => {
    const nt = Math.min(T, tNow.current + dt * speed);
    tNow.current = nt;
    setT(nt);
    if (nt >= T && riding.current !== 'replay') finish();
    return nt < T;
  });
  // which ride is playing: the one to predict, the student's own for the goal (both read by finish(), which may run
  // in the same event as go() when animations are off, before the new phase is rendered), or a replay of one of them
  const riding = useRef<'ride' | 'goalRide' | 'replay'>('ride');
  /** Replay the ride just watched (from the start, or on from where it was paused); pause it when it is playing. */
  const replay = (from?: number) => {
    if (playing && from === undefined) { setPlaying(false); return; }
    const t0 = from ?? (t >= T - 1e-6 ? 0 : t);
    riding.current = 'replay'; setT(t0); tNow.current = t0;
    if (calm()) { setT(T); tNow.current = T; } else setPlaying(true);
  };
  const scrub = (v: number) => { riding.current = 'replay'; setPlaying(false); setT(v); tNow.current = v; };
  const level = useRef<HTMLDivElement>(null);
  const go = (kind: 'ride' | 'goalRide', legs: Leg[]) => {
    riding.current = kind; setPhase(kind); setT(0); tNow.current = 0;
    if (calm()) { const end = total(legs); tNow.current = end; setT(end); finish(); } else setPlaying(true);
  };

  /** The end of a ride: the prediction's result, or the goal's. */
  function finish() {
    if (riding.current === 'ride') {
      const ok = pick === L.ask.right;
      const stake = betOn ? Math.min(bet, save.coins) : 0;
      setWon(ok ? stake : -stake);
      if (ok) award(STAR.ask, stake); else if (stake) setSave((s) => ({ ...s, coins: Math.max(0, s.coins - stake) }));
      setPhase('told');
    } else {
      const GT = total(goalLegs), end = at(goalLegs, GT);
      const ok = L.goal.ok(ctl, end, GT);
      const said = tx(L.goal.say(ctl, end, GT));
      setTries((n) => n + (ok ? 0 : 1));
      if (ok) {
        const first = !(save.stars[lv]! & STAR.goal);
        award(STAR.goal | CLEAR, PAY.goal);
        setGoalMsg({ ok: true, text: tx(W.goalHit) + said + (first ? ' ' + tx(W.earn) + PAY.goal + '.' : '') });
        setPhase('end');
      } else {
        setGoalMsg({ ok: false, text: tx(W.notYet) + said });
        setPhase('goal');
      }
    }
  }

  const lockIn = () => {
    if (pick < 0) { setNote(tx(W.pick)); return; }
    setNote(''); go('ride', L.legs);
  };
  const checkRead = () => {
    if (pin === null) { setReadMsg({ ok: false, text: tx(W.pinFirst) }); return; }
    if (L.read.ok(pin)) {
      const first = !(save.stars[lv]! & STAR.read);
      award(STAR.read, PAY.read);
      setReadMsg({ ok: true, text: tx(W.right) + ' ' + tx(L.read.why) + (first ? ' ' + tx(W.earn) + PAY.read + '.' : '') });
    } else {
      setMisses((n) => n + 1);
      setReadMsg({ ok: false, text: tx(W.readWrong) + (misses >= 1 ? ' ' + tx(L.read.why) : '') });
    }
  };
  const toRead = () => {
    setPhase('read'); setPin(null); setReadMsg(null);
    level.current?.querySelector('.bus-do')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    replay(0);
  };
  const toGoal = () => { setPlaying(false); setPhase('goal'); setT(0); setGoalMsg(null); if (phone) setTimeout(toPanel, 60); };   // the sliders come up under the road
  const rideGoal = () => { setGoalMsg(null); go('goalRide', goalLegs); };
  const setControl = (k: string, v: number) => { setPlaying(false); setCtl((c) => ({ ...c, [k]: v })); setT(0); setGoalMsg(null); };

  const buy = (id: string, price: number) => setSave((s) => (s.coins < price || s.own.includes(id) ? s : { ...s, coins: s.coins - price, own: [...s.own, id], wear: [...s.wear, id] }));
  const toggleWear = (id: string) => setSave((s) => ({ ...s, wear: s.wear.includes(id) ? s.wear.filter((x) => x !== id) : [...s.wear, id] }));
  const resetAll = () => {
    if (!confirm(tx(W.resetAsk))) return;
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    setSave({ ...START, stars: [...START.stars] });
    setTimeout(() => startLevel(0), 0);
  };

  const p = at(rideLegs, t);
  const showGraph = L.read.graph;
  const stage = phase === 'ask' || phase === 'ride' || phase === 'told' ? 0 : phase === 'read' ? 1 : 2;
  // a ride has been watched and can be played again: the one predicted, or the student's last goal ride
  const watched = phase === 'told' || phase === 'read' || (stage === 2 && !!goalMsg && phase !== 'goalRide');
  const m = save.stars[lv]!;
  // while the graph is read on a phone, the graph is pinned (with the road as a strip above it)
  const pinGraph = phone && stage === 1;
  const graph = (
    <TapGraph key={lv + '-' + stage} tx={tx} legs={rideLegs} kind={showGraph} upto={t} ghost={watched} pin={stage === 1 ? pin : null}
      onPin={stage === 1 ? (x) => { setPin(x); if (!readMsg?.ok) setReadMsg(null); } : undefined} />
  );
  const bar: { text: string; act?: [string, () => void] } =
    phase === 'ask' ? { text: tx(L.ask.q), act: [tx(W.lockIn), lockIn] }
    : phase === 'ride' || phase === 'goalRide' ? { text: tx(W.riding) }
    : phase === 'told' ? { text: tx(pick === L.ask.right ? W.right : W.wrong) + (won ? ' ' + tx(won > 0 ? W.won : W.lost) + Math.abs(won) + '.' : ''), act: [tx(W.toRead), toRead] }
    : phase === 'read' ? (readMsg?.ok ? { text: readMsg.text, act: [tx(W.toGoal), toGoal] } : { text: readMsg?.text ?? tx(L.read.q), act: [tx(W.check), checkRead] })
    : phase === 'goal' ? { text: goalMsg?.text ?? tx(L.goal.q), act: [tx(W.ride), rideGoal] }
    : { text: tx(W.levelDone) + ' ' + '★'.repeat(bits(m)) + '☆'.repeat(3 - bits(m)), act: lv < LEVELS.length - 1 ? [tx(W.next), () => startLevel(lv + 1)] : undefined };

  return (
    <section class="bus" aria-labelledby="bus-h">
      <header class="bus-head">
        <p class="bus-kicker">{tx(W.kicker)} · 2.1, 2.2, 2.3, 2.5</p>
        <h3 id="bus-h">{tx(W.title)}</h3>
        <div class="bus-hud" aria-live="polite">
          <span class="hud-stars" title={tx(W.stars)}><span aria-hidden="true">★</span> <b>{totalStars}</b>/{LEVELS.length * 3}<span class="visually-hidden"> {tx(W.stars)}</span></span>
          <span class="hud-coins" title={tx(W.coins)}>Rs <b>{save.coins}</b><span class="visually-hidden"> {tx(W.coins)}</span></span>
        </div>
        <p class="bus-intro">{tx(W.intro)}</p>
      </header>

      <nav class="bus-map" aria-label={tx(W.route)}>
        <ol>
          {LEVELS.map((x, i) => (
            <li>
              <button type="button" class={'stop' + (i === lv ? ' on' : '') + (save.stars[i]! & CLEAR ? ' clear' : '')} aria-current={i === lv ? 'step' : undefined}
                disabled={!unlocked(i) || (busy && i !== lv)} title={!unlocked(i) ? tx(W.locked) : busy && i !== lv ? tx(W.finishFirst) : undefined} onClick={() => { if (i !== lv) startLevel(i); }}>
                <span class="stop-n" aria-hidden="true">{!unlocked(i) ? '🔒' : save.stars[i]! & CLEAR ? '✓' : i + 1}</span>
                <span class="visually-hidden">{i + 1}. </span>
                <span class="stop-name">{tx(x.stop)}</span>
                <Stars m={save.stars[i]!} label={bits(save.stars[i]!) + ' / 3 ' + tx(W.stars)} />
              </button>
            </li>
          ))}
        </ol>
        {busy && <p class="bus-map-note">{tx(W.finishFirst)}</p>}
      </nav>

      <div class={'bus-level' + (phone ? ' is-phone' : '')} ref={level} style={phone ? { '--bus-top': edges.top + 'px', '--bus-bottom': edges.bottom + 'px' } : undefined}>
        <div class="bus-lv-top">
          <span class="bus-sec">{tx(W.level)} {lv + 1} · {L.sec}</span>
          <ol class="bus-steps">
            {[W.sPredict, W.sRead, W.sGoal].map((w, i) => {
              const state = phase === 'end' || stage > i ? 'past' : stage === i ? 'on' : 'next';
              return (
                <li class={state + (m & [1, 2, 4][i]! ? ' got' : '')} aria-current={state === 'on' ? 'step' : undefined}>
                  <span class="n">{i + 1}</span> {tx(w)} <span class="st" aria-hidden="true">★</span>
                </li>
              );
            })}
          </ol>
        </div>
        <p class="bus-do" aria-live="polite">
          {phase !== 'end' && <b>{tx(W.stepOf).replace('{n}', String(stage + 1))} · </b>}
          {tx(phase === 'end' ? W.do3 : [W.do0, W.do1, W.do2][stage]!)}
        </p>

        <div class="bus-stage" ref={stageBox}>
        <Scene tx={tx} legs={rideLegs} t={t} wear={save.wear} ticks={phase !== 'ask'} strip={pinGraph}
          start={stage === 2 ? L.goal.start ?? L.start : L.start} home={!!L.home && !(stage === 2 && L.goal.start)}
          places={stage === 2 ? L.goal.places ?? [] : L.places.filter((p) => !p.after || phase === 'told' || stage > 0)} />
        {pinGraph && graph}
        {watched && (
          <div class="bus-replay">
            {!calm() && <button type="button" class="btn btn-sm" onClick={() => replay()}>{tx(playing ? W.pause : W.watchAgain)}</button>}
            <label for="bus-time" class="visually-hidden">{tx(W.scrub)}</label>
            <input type="range" id="bus-time" min={0} max={Math.round(T * 10) / 10} step={0.1} value={t} title={tx(W.scrub)}
              onInput={(e) => scrub(parseFloat((e.target as HTMLInputElement).value))} />
            <span class="rp-t">{fmt(t)} s</span>
          </div>
        )}
        <Readouts tx={tx} p={p} t={t} />
        </div>

        <div class="bus-work">
          <div class="bus-panel" ref={panel}>
            {stage === 0 && (
              <>
                <p class="bus-story">{tx(L.story)}</p>
                <p class="bus-q">{tx(L.ask.q)}</p>
                <div class="bus-opts" role="radiogroup" aria-label={tx(L.ask.q)}>
                  {L.ask.opts.map((o, i) => (
                    <button type="button" role="radio" aria-checked={pick === i} disabled={phase !== 'ask'}
                      class={'opt' + (pick === i ? ' on' : '') + (phase === 'told' && i === L.ask.right ? ' right' : '') + (phase === 'told' && pick === i && i !== L.ask.right ? ' wrong' : '')}
                      onClick={() => { setPick(i); setNote(''); }}>{tx(o)}</button>
                  ))}
                </div>
                {phase === 'ask' && (
                  <div class="bus-bet">
                    {!betOn ? <p class="hint">{tx(W.noBet)}</p> : save.coins === 0 ? <p class="hint">{tx(W.free)}</p> : (
                      <>
                        <span class="bet-l" id="bet-l">{tx(W.bet)}</span>
                        <div class="chips" role="radiogroup" aria-labelledby="bet-l">
                          {BETS.map((b) => <button type="button" role="radio" aria-checked={bet === b} class={'chip' + (bet === b ? ' on' : '')} disabled={b > save.coins} onClick={() => setBet(b)}>Rs {b}</button>)}
                        </div>
                        <p class="hint">{tx(W.betNote)}</p>
                      </>
                    )}
                    <button type="button" class="btn primary act" onClick={lockIn}>{tx(W.lockRide)}</button>
                    {note && <p class="msg err" role="alert">{note}</p>}
                  </div>
                )}
                {phase === 'ride' && <p class="hint" aria-live="polite">{tx(W.riding)}</p>}
                {phase === 'told' && won !== null && (
                  <div class={'bus-msg ' + (pick === L.ask.right ? 'ok' : 'err')} role="status">
                    <b>{tx(pick === L.ask.right ? W.right : W.wrong)}</b>{' '}
                    {won > 0 && <span class="pay">{tx(W.won)}{won}. </span>}
                    {won < 0 && <span class="pay">{tx(W.lost)}{-won}. </span>}
                    {pick !== L.ask.right && <span>{tx(W.answer)}<b>{tx(L.ask.opts[L.ask.right]!)}</b>. </span>}
                    <span>{tx(L.ask.why)}</span>
                    <div><button type="button" class="btn primary act" onClick={toRead}>{tx(W.toRead)}</button></div>
                  </div>
                )}
              </>
            )}

            {stage === 1 && (
              <>
                <p class="bus-q">{tx(L.read.q)}</p>
                {pin !== null && <p class="bus-pin">{tx(W.yourPoint)}{fmt(pin)} s · {fmt(L.read.graph === 's' ? at(rideLegs, pin).s : at(rideLegs, pin).v)} {L.read.graph === 's' ? 'm' : 'm/s'}</p>}
                <p class="hint">{tx(W.tap)} {tx(W.keys)}</p>
                <div class="bus-row">
                  <button type="button" class="btn primary act" onClick={checkRead} disabled={!!readMsg?.ok}>{tx(W.check)}</button>
                  {readMsg?.ok ? <button type="button" class="btn primary act" onClick={toGoal}>{tx(W.toGoal)}</button> : <button type="button" class="btn" onClick={toGoal}>{tx(W.skip)}</button>}
                </div>
                {readMsg && <p class={'bus-msg ' + (readMsg.ok ? 'ok' : 'err')} role="status">{readMsg.text}</p>}
              </>
            )}

            {stage === 2 && (
              <>
                <p class="bus-q">{tx(L.goal.q)}</p>
                {L.goal.controls.map((c) => (
                  <div class="bus-ctl">
                    <label for={'bus-' + c.key}>{tx(c.l)}: <b>{fmt(ctl[c.key] ?? c.start)} {c.unit}</b></label>
                    <input type="range" id={'bus-' + c.key} min={c.min} max={c.max} step={c.step} value={ctl[c.key] ?? c.start} disabled={phase !== 'goal'}
                      onInput={(e) => setControl(c.key, parseFloat((e.target as HTMLInputElement).value))} />
                  </div>
                ))}
                {phase !== 'end' && <button type="button" class="btn primary act" disabled={phase === 'goalRide'} onClick={rideGoal}>{tx(phase === 'goalRide' ? W.riding : W.ride)}</button>}
                {goalMsg && <p class={'bus-msg ' + (goalMsg.ok ? 'ok' : 'err')} role="status">{goalMsg.text}{(goalMsg.ok || tries >= 3) && <> {tx(L.goal.why)}</>}</p>}
                {phase === 'end' && (
                  <div class="bus-end">
                    <p><b>{tx(W.levelDone)}</b> <Stars m={m} label={bits(m) + ' / 3 ' + tx(W.stars)} /></p>
                    {lv === LEVELS.length - 1 && <p class="bus-win">🚌 {tx(W.allDone)}</p>}
                    <div class="bus-row">
                      {lv < LEVELS.length - 1 && <button type="button" class="btn primary act" onClick={() => startLevel(lv + 1)}>{tx(W.next)}</button>}
                      <button type="button" class="btn" onClick={() => startLevel(lv)}>{tx(W.again)}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!pinGraph && graph}
        </div>
        {phone && (
          <div class="bus-qbar" role="region" aria-label={tx(W.question)}>
            <button type="button" class="qb-text" onClick={toPanel}>{bar.text}</button>
            {bar.act && <button type="button" class="btn primary" onClick={bar.act[1]}>{bar.act[0]}</button>}
          </div>
        )}
      </div>

      <details class="bus-shop">
        <summary><b>{tx(W.shop)}</b> <span>{tx(W.shopSub)}</span></summary>
        <ul>
          {ITEMS.map((it) => {
            const own = save.own.includes(it.id), on = save.wear.includes(it.id);
            return (
              <li class={own ? 'own' : ''}>
                <span class="it-name">{tx(it.l)}</span>
                {own
                  ? <button type="button" class="btn btn-sm" aria-pressed={on} onClick={() => toggleWear(it.id)}>{tx(on ? W.off : W.wear)}</button>
                  : <button type="button" class="btn btn-sm" disabled={save.coins < it.price} onClick={() => buy(it.id, it.price)}>{tx(W.buy)} · Rs {it.price}</button>}
              </li>
            );
          })}
        </ul>
        <button type="button" class="bus-reset" onClick={resetAll}>{tx(W.reset)}</button>
      </details>
    </section>
  );
}
