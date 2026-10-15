/*
 * The practice questions' pictures (content/practice: "figure"), drawn as SVG from the question's own numbers, with no
 * words in them (letters, numbers and units only), so they serve every language. Colours follow the theme.
 * tools/validate_practice.py checks that a question asks only for these kinds, with what each needs.
 */
import type { JSX } from 'preact';

export type Figure =
  | { kind: 'blocks'; weight: string; dims: [string, string, string] }
  | { kind: 'vessels' }
  | { kind: 'tank'; depth: number; points: { l: string; d: number; x: number }[] }
  | { kind: 'bottle' }
  | { kind: 'hydraulic'; a1: string; a2: string; f1: string; f2: string }
  | { kind: 'barometer'; h: string }
  | { kind: 'utube'; balloon?: boolean }
  | { kind: 'balance'; air: string; water: string }
  | { kind: 'float'; weight: string; sub: number }
  | { kind: 'graph'; axis: 'v' | 's' | 'ff' | 'T'; points: [number, number][] }
  | { kind: 'route'; legs: ['N' | 'S' | 'E' | 'W', number][] }
  | { kind: 'forces'; mass: string; left: string; right: string }
  | { kind: 'circuit'; layout: 'series' | 'parallel'; r: string[]; v: string }
  | { kind: 'mains'; switch: 'live' | 'neutral' }
  | { kind: 'plug'; pins: [string, string, string] }
  | { kind: 'diode'; bias: 'forward' | 'reverse' }
  | { kind: 'signal'; shape: 'ac' | 'half' | 'full' | 'smooth' | 'dc' }
  | { kind: 'pn'; bias: 'none' | 'forward' | 'reverse' }
  | { kind: 'transistor'; type: 'npn' | 'pnp'; labels?: [string, string, string] }
  | { kind: 'divider'; r1: string; r2: string; v: string; vb?: string }
  | { kind: 'wirefield'; dir: 'out' | 'in' }
  | { kind: 'fleming'; n: 'left' | 'right'; current: 'out' | 'in'; force?: 'up' | 'down' }
  | { kind: 'xfmr'; np: string; ns: string; vp?: string; vs?: string }
  | { kind: 'induct'; move: 'toward' | 'away' | 'still' }
  | { kind: 'resistor'; bands: string[] }
  | { kind: 'lift'; mass: string; h: string; f?: string }
  | { kind: 'push'; f: string; d: string; mass?: string }
  | { kind: 'bars'; groups: { at: string; ek: number; ep: number }[] }
  | { kind: 'swing'; a: string; b: string }
  | { kind: 'wave'; cycles: number; size?: number; amp?: string; wl?: string; pts?: boolean }
  | { kind: 'traces'; items: { l: string; cycles: number; size: number }[] }
  | { kind: 'slinky'; marks?: { c?: string; r?: string } }
  | { kind: 'sonar'; depth: string; t?: string }
  | { kind: 'mirror'; i: string; r: string; angle?: number }
  | { kind: 'refract'; from: 'rare' | 'dense'; i: string; r: string; a1?: number; a2?: number }
  | { kind: 'tir'; state: 'less' | 'critical' | 'greater'; i?: string }
  | { kind: 'lens'; u: number; type?: 'convex' | 'concave' }
  | { kind: 'scales'; c?: number; mark?: string }
  | { kind: 'lever'; loads: { x: number; f: string; d?: string; dir?: 'up' | 'down' }[]; pivot?: boolean }
  | { kind: 'vectors'; a: string; b: string; r?: string; angle?: number }
  | { kind: 'updown'; mass: string; up: string; down: string; hang?: boolean }
  | { kind: 'cords'; w: string; a: string; b: string };

const BAND: Record<string, string> = {
  black: '#1b1b1b', brown: '#7b4a1e', red: '#d32f2f', orange: '#f57c00', yellow: '#fbc02d', green: '#2e7d32',
  blue: '#1565c0', violet: '#7b1fa2', grey: '#8a8a8a', white: '#ffffff', gold: '#c9a227', silver: '#b8bec6',
};
/** A resistor box on a wire, centred at (x, y), across (h) or up and down (v). */
const res = (x: number, y: number, label: string, dir: 'h' | 'v' = 'h') => (
  <g>
    {dir === 'h' ? <rect x={x - 22} y={y - 9} width="44" height="18" rx="3" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />
                 : <rect x={x - 9} y={y - 22} width="18" height="44" rx="3" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />}
    {dir === 'h' ? T(x, y - 20, label, { size: 12 }) : T(x + 16, y, label, { size: 12, anchor: 'start' })}
  </g>
);
/** A cell: long (+) and short (−) plates across a gap in a vertical wire at x, centred at y. */
const cell = (x: number, y: number, label: string) => (
  <g>
    <rect x={x - 14} y={y - 10} width="28" height="20" fill="var(--sc-panel)" />
    <line x1={x - 14} y1={y - 5} x2={x + 14} y2={y - 5} stroke={INK} stroke-width="3" />
    <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} stroke={INK} stroke-width="5" />
    {T(x - 20, y, label, { anchor: 'end', size: 12 })}
  </g>
);

const INK = 'var(--sc-ink)', INK2 = 'var(--sc-ink-2)', WATER = 'var(--sc-blue-lt)', EDGE = 'var(--sc-blue)', SOLID = 'var(--sc-mango-lt)', HG = 'var(--sc-ink-2)', CLAY = 'var(--sc-clay)';
const T = (x: number, y: number, s: string, o: { size?: number; anchor?: 'start' | 'middle' | 'end'; color?: string } = {}) => (
  <text x={x} y={y} font-size={o.size ?? 13} font-weight="800" text-anchor={o.anchor ?? 'middle'} dominant-baseline="middle" fill={o.color ?? INK} stroke="none">{s}</text>
);
const arrow = (x1: number, y1: number, x2: number, y2: number, color = CLAY) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 8;
  return (
    <g stroke={color} stroke-width="3" fill="none" stroke-linecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path d={`M${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)} L${x2} ${y2} L${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)}`} />
    </g>
  );
};

function draw(f: Figure): JSX.Element {
  switch (f.kind) {
    case 'blocks': {
      // the same brick three ways: A on its largest face, B on its side, C on its end (smallest face)
      const [l, w, h] = f.dims;
      const brick = (x: number, bw: number, bh: number, name: string, a: string, b: string) => (
        <g>
          <rect x={x} y={170 - bh} width={bw} height={bh} rx="3" fill={SOLID} stroke={INK} stroke-width="2.5" />
          {T(x + bw / 2, 170 - bh / 2, name, { size: 16 })}
          {T(x + bw / 2, 186, a, { size: 11, color: INK2 })}
          {T(x - 4, 170 - bh / 2, b, { size: 11, anchor: 'end', color: INK2 })}
        </g>
      );
      return (
        <g>
          <line x1="10" y1="170" x2="310" y2="170" stroke={INK} stroke-width="3" />
          {brick(40, 100, 25, 'A', l, h)}
          {brick(176, 50, 50, 'B', w, l)}
          {brick(262, 25, 100, 'C', h, l)}
          {T(160, 24, 'W = ' + f.weight, { color: INK2 })}
        </g>
      );
    }
    case 'vessels': {
      // three shapes, water to the same height
      const y0 = 60, y1 = 170;
      return (
        <g>
          <path d={`M30 ${y0} L30 ${y1} L90 ${y1} L90 ${y0}`} fill={WATER} stroke={INK} stroke-width="2.5" />
          <path d={`M119.6 ${y0} L145 ${y1} L175 ${y1} L200.4 ${y0} Z`} fill={WATER} stroke="none" /><path d={`M115 ${y0 - 20} L145 ${y1} L175 ${y1} L205 ${y0 - 20}`} fill="none" stroke={INK} stroke-width="2.5" />
          <path d={`M250 ${y0} L280 ${y0} L280 ${y0 + 40} L295 ${y0 + 50} L295 ${y1} L235 ${y1} L235 ${y0 + 50} L250 ${y0 + 40} Z`} fill={WATER} stroke="none" /><path d={`M250 ${y0 - 20} L250 ${y0 + 40} L235 ${y0 + 50} L235 ${y1} L295 ${y1} L295 ${y0 + 50} L280 ${y0 + 40} L280 ${y0 - 20}`} fill="none" stroke={INK} stroke-width="2.5" />
          <line x1="20" y1={y0} x2="305" y2={y0} stroke={EDGE} stroke-width="1.5" stroke-dasharray="5 4" />
          {T(60, 186, 'A')}{T(160, 186, 'B')}{T(265, 186, 'C')}
          {T(312, (y0 + y1) / 2, 'h', { anchor: 'end', color: EDGE })}
        </g>
      );
    }
    case 'tank': {
      const x0 = 60, x1 = 260, top = 40, bottom = 180, k = (bottom - top) / f.depth;
      return (
        <g>
          <rect x={x0} y={top} width={x1 - x0} height={bottom - top} fill={WATER} />
          <path d={`M${x0} ${top - 12} L${x0} ${bottom} L${x1} ${bottom} L${x1} ${top - 12}`} fill="none" stroke={INK} stroke-width="3" />
          <line x1={x0} y1={top} x2={x1} y2={top} stroke={EDGE} stroke-width="2" />
          {f.points.map((p) => {
            const x = x0 + (x1 - x0) * p.x, y = top + p.d * k;
            return (
              <g>
                <line x1={x} y1={top} x2={x} y2={y} stroke={INK2} stroke-width="1.5" stroke-dasharray="4 3" />
                <circle cx={x} cy={y} r="5" fill={CLAY} />
                {T(x + 12, y, p.l, { anchor: 'start' })}
                {T(x - 6, (top + y) / 2, p.d + ' m', { anchor: 'end', size: 11, color: INK2 })}
              </g>
            );
          })}
          {T(x1 + 8, (top + bottom) / 2, f.depth + ' m', { anchor: 'start', size: 11, color: INK2 })}
        </g>
      );
    }
    case 'bottle': {
      const x0 = 80, x1 = 150, surface = 50;
      return (
        <g>
          <rect x={x0} y={surface} width={x1 - x0} height={180 - surface} fill={WATER} />
          <rect x={x0} y="30" width={x1 - x0} height="150" rx="10" fill="none" stroke={INK} stroke-width="3" />
          {[[90, '1', 50], [125, '2', 85], [160, '3', 115]].map(([y, n, len]) => (
            <g>
              <path d={`M${x1} ${y} Q${x1 + (len as number) * 0.6} ${(y as number) - 4} ${x1 + (len as number)} ${(y as number) + 40}`} fill="none" stroke={EDGE} stroke-width="4" stroke-linecap="round" />
              <circle cx={x1} cy={y as number} r="4.5" fill={INK} />
              {T(x0 - 14, y as number, n as string, { color: INK2 })}
            </g>
          ))}
        </g>
      );
    }
    case 'hydraulic': {
      // a small piston (left) and a large one (right) on one body of oil
      return (
        <g>
          <path d="M40 70 L40 170 L280 170 L280 90 L180 90 L180 140 L80 140 L80 70" fill="var(--sc-mango-lt)" stroke={INK} stroke-width="3" />
          <rect x="42" y="64" width="36" height="12" fill={INK2} />
          <rect x="182" y="84" width="96" height="12" fill={INK2} />
          {arrow(60, 22, 60, 60)}
          {T(60, 12, f.f1)}
          {arrow(230, 78, 230, 30, 'var(--sc-leaf)')}
          {T(230, 18, f.f2)}
          {T(60, 190, f.a1, { size: 12, color: INK2 })}
          {T(230, 190, f.a2, { size: 12, color: INK2 })}
        </g>
      );
    }
    case 'barometer': {
      return (
        <g>
          <rect x="70" y="150" width="140" height="35" fill={HG} opacity="0.85" />
          <path d="M70 130 L70 185 L210 185 L210 130" fill="none" stroke={INK} stroke-width="3" />
          <rect x="130" y="70" width="20" height="100" fill={HG} opacity="0.85" />
          <rect x="128" y="20" width="24" height="152" rx="4" fill="none" stroke={INK} stroke-width="3" />
          <line x1="165" y1="70" x2="165" y2="150" stroke={CLAY} stroke-width="2" />
          <line x1="158" y1="70" x2="172" y2="70" stroke={CLAY} stroke-width="2" /><line x1="158" y1="150" x2="172" y2="150" stroke={CLAY} stroke-width="2" />
          {T(178, 110, f.h, { anchor: 'start', color: CLAY })}
          {arrow(40, 110, 72, 148, EDGE)}{arrow(250, 110, 210, 148, EDGE)}
        </g>
      );
    }
    case 'utube': {
      return (
        <g>
          <path d="M110 40 L110 160 Q110 185 140 185 L180 185 Q210 185 210 160 L210 40" fill="none" stroke={INK} stroke-width="22" stroke-linecap="butt" />
          <path d="M110 120 L110 160 Q110 185 140 185 L180 185 Q210 185 210 160 L210 80" fill="none" stroke={WATER} stroke-width="16" />
          {T(110, 28, 'X')}{T(210, 28, 'Y')}
          {f.balloon && <g><line x1="110" y1="40" x2="80" y2="40" stroke={INK} stroke-width="3" /><ellipse cx="55" cy="40" rx="26" ry="20" fill="var(--sc-clay-lt)" stroke={CLAY} stroke-width="2.5" /></g>}
          <line x1="225" y1="80" x2="240" y2="80" stroke={INK2} stroke-width="1.5" /><line x1="225" y1="120" x2="240" y2="120" stroke={INK2} stroke-width="1.5" />
        </g>
      );
    }
    case 'balance': {
      const spring = (x: number, reading: string, inWater: boolean) => (
        <g>
          <line x1={x - 30} y1="12" x2={x + 30} y2="12" stroke={INK} stroke-width="3" />
          <rect x={x - 12} y="16" width="24" height="56" rx="5" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />
          {T(x + 18, 44, reading, { anchor: 'start', color: CLAY })}
          <line x1={x} y1="72" x2={x} y2={inWater ? 120 : 110} stroke={INK} stroke-width="2" />
          <rect x={x - 16} y={inWater ? 120 : 110} width="32" height="26" rx="3" fill={SOLID} stroke={INK} stroke-width="2.5" />
          {inWater && <g><rect x={x - 40} y="100" width="80" height="80" fill={WATER} opacity="0.75" /><path d={`M${x - 40} 92 L${x - 40} 180 L${x + 40} 180 L${x + 40} 92`} fill="none" stroke={INK} stroke-width="2.5" /></g>}
        </g>
      );
      return <g>{spring(85, f.air, false)}{spring(225, f.water, true)}</g>;
    }
    case 'float': {
      const sub = Math.max(0.1, Math.min(0.95, f.sub)), bh = 60, top = 100 - bh * (1 - sub);
      return (
        <g>
          <rect x="40" y="100" width="240" height="80" fill={WATER} />
          <path d="M40 60 L40 180 L280 180 L280 60" fill="none" stroke={INK} stroke-width="3" />
          <rect x="130" y={top} width="60" height={bh} fill={SOLID} stroke={INK} stroke-width="2.5" />
          <line x1="40" y1="100" x2="280" y2="100" stroke={EDGE} stroke-width="2" />
          {arrow(160, top + bh / 2 - 4, 160, top - 26, 'var(--sc-leaf)')}
          {T(160, top - 36, '?', { color: 'var(--sc-leaf)' })}
          {arrow(205, top + 10, 205, top + bh + 22, CLAY)}
          {T(212, top + bh + 30, f.weight, { anchor: 'start', color: CLAY })}
        </g>
      );
    }
    case 'graph': {
      // a velocity-time or displacement-time graph through the points, with each point's values on the axes
      const x0 = 50, y0 = 170, x1 = 300, y1 = 24;
      const tmax = Math.max(...f.points.map((p) => p[0])), vmax = Math.max(...f.points.map((p) => p[1]), 1);
      const X = (t: number) => x0 + (t / tmax) * (x1 - x0), Y = (v: number) => y0 - (v / vmax) * (y0 - y1);
      const ts = [...new Set(f.points.map((p) => p[0]))], vs = [...new Set(f.points.map((p) => p[1]))].filter((v) => v !== 0);
      return (
        <g>
          {f.points.map(([t, v]) => <g stroke={INK2} stroke-width="1" stroke-dasharray="3 3"><line x1={X(t)} y1={Y(v)} x2={X(t)} y2={y0} /><line x1={x0} y1={Y(v)} x2={X(t)} y2={Y(v)} /></g>)}
          <line x1={x0} y1={y0} x2={x1 + 8} y2={y0} stroke={INK} stroke-width="2.5" />
          <line x1={x0} y1={y0} x2={x0} y2={y1 - 10} stroke={INK} stroke-width="2.5" />
          <polyline points={f.points.map(([t, v]) => `${X(t)},${Y(v)}`).join(' ')} fill="none" stroke={EDGE} stroke-width="4" stroke-linejoin="round" />
          {ts.map((t) => T(X(t), y0 + 13, String(t), { size: 11, color: INK2 }))}
          {vs.map((v) => T(x0 - 6, Y(v), String(v), { size: 11, color: INK2, anchor: 'end' }))}
          {!ts.includes(0) && T(x0 - 6, y0 + 13, '0', { size: 11, color: INK2, anchor: 'end' })}
          {T(x1, y0 + 26, f.axis === 'ff' ? 'F (N)' : f.axis === 'T' ? 't (min)' : 't (s)', { size: 11, anchor: 'end' })}
          {T(x0 + 4, y1 - 14, f.axis === 'v' ? 'v (m s⁻¹)' : f.axis === 's' ? 's (m)' : f.axis === 'T' ? 'θ (°C)' : 'f (N)', { size: 11, anchor: 'start' })}
        </g>
      );
    }
    case 'route': {
      // a walk leg by leg from S to F; the straight dashed line is from start to finish
      const step = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] } as const;
      const pts: [number, number][] = [[0, 0]];
      for (const [d, n] of f.legs) { const [x, y] = pts[pts.length - 1]!; pts.push([x + step[d][0] * n, y + step[d][1] * n]); }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
      const k = Math.min(200 / Math.max(maxx - minx, 1), 130 / Math.max(maxy - miny, 1));
      const P = ([x, y]: [number, number]) => [70 + (x - minx) * k, 35 + (y - miny) * k] as const;
      const s = P(pts[0]!), e = P(pts[pts.length - 1]!);
      return (
        <g>
          <polyline points={pts.map((p) => P(p).join(',')).join(' ')} fill="none" stroke={EDGE} stroke-width="4" stroke-linejoin="round" />
          {f.legs.map(([, n], i) => { const a = P(pts[i]!), b = P(pts[i + 1]!); const vert = a[0] === b[0]; return T((a[0] + b[0]) / 2 + (vert ? 10 : 0), (a[1] + b[1]) / 2 + (vert ? 0 : -12), n + ' m', { size: 12, anchor: vert ? 'start' : 'middle' }); })}
          <line x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} stroke={CLAY} stroke-width="2" stroke-dasharray="6 5" />
          <circle cx={s[0]} cy={s[1]} r="7" fill={INK} />{T(s[0] - 14, s[1], 'S', { anchor: 'end' })}
          <circle cx={e[0]} cy={e[1]} r="7" fill={CLAY} />{T(e[0] + 14, e[1], 'F', { anchor: 'start', color: CLAY })}
          {T(296, 30, 'N', { size: 12 })}{arrow(296, 64, 296, 42, INK)}
        </g>
      );
    }
    case 'forces': {
      // a block on the floor with a force to the left and a force to the right
      return (
        <g>
          <line x1="20" y1="150" x2="300" y2="150" stroke={INK} stroke-width="3" />
          <rect x="125" y="90" width="70" height="60" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />
          {T(160, 120, f.mass, { size: 15 })}
          {f.left && <g>{arrow(125, 120, 40, 120)}{T(82, 104, f.left, { color: CLAY })}</g>}
          {f.right && <g>{arrow(195, 120, 280, 120)}{T(238, 104, f.right, { color: CLAY })}</g>}
        </g>
      );
    }
    case 'mains': {
      // a 230 V supply with a live wire (L, above) and a neutral wire (N, below) to a lamp; the switch is on the live or the neutral wire
      const sw = (x: number, y: number) => <g><circle cx={x - 18} cy={y} r="3.5" fill={INK} /><circle cx={x + 18} cy={y} r="3.5" fill={INK} /><line x1={x - 18} y1={y} x2={x + 14} y2={y - 20} stroke={INK} stroke-width="3" stroke-linecap="round" /></g>;
      const liveSw = f.switch === 'live';
      return (
        <g stroke={INK} stroke-width="3" fill="none">
          <circle cx="50" cy="100" r="24" fill="var(--sc-panel)" />
          <path d="M38 100 q6 -12 12 0 t12 0" stroke-width="2.5" />
          <line x1="50" y1="76" x2="50" y2="60" /><line x1="50" y1="124" x2="50" y2="140" />
          <line x1="50" y1="60" x2={liveSw ? 122 : 250} y2="60" />{liveSw && <line x1="158" y1="60" x2="250" y2="60" />}
          <line x1="50" y1="140" x2={liveSw ? 250 : 122} y2="140" />{!liveSw && <line x1="158" y1="140" x2="250" y2="140" />}
          <line x1="250" y1="60" x2="250" y2="82" /><line x1="250" y1="118" x2="250" y2="140" />
          <circle cx="250" cy="100" r="18" fill="var(--sc-mango-lt)" /><line x1="237" y1="87" x2="263" y2="113" stroke-width="2.5" /><line x1="263" y1="87" x2="237" y2="113" stroke-width="2.5" />
          {sw(140, liveSw ? 60 : 140)}
          {T(100, 44, 'L', { size: 16, color: CLAY })}{T(100, 160, 'N', { size: 16, color: EDGE })}{T(50, 176, '230 V', { size: 12, color: INK2 })}
        </g>
      );
    }
    case 'plug': {
      // the face of a three-pin plug; pins gives the letter at the top pin, the bottom-left pin and the bottom-right pin
      const pin = (x: number, y: number, w: number, h: number, label: string) => <g><rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="3" fill={HG} stroke={INK} stroke-width="2.5" />{T(x, y + h / 2 + 18, label, { size: 17 })}</g>;
      return (
        <g>
          <rect x="85" y="14" width="150" height="172" rx="26" fill={SOLID} stroke={INK} stroke-width="3" />
          {pin(160, 56, 16, 44, f.pins[0])}{pin(122, 128, 16, 34, f.pins[1])}{pin(198, 128, 16, 34, f.pins[2])}
        </g>
      );
    }
    case 'diode': {
      // a cell, a lamp and a junction diode in series: the diode triangle points right (forward) or left (reverse) along the conventional current
      const fwd = f.bias === 'forward';
      return (
        <g stroke={INK} stroke-width="3" fill="none">
          <path d="M60 70 V50 H132 M188 50 H260 V82 M260 118 V150 H60 V130" />
          <line x1="40" y1="70" x2="80" y2="70" /><line x1="50" y1="80" x2="70" y2="80" stroke-width="6" />{T(30, 60, '+', { size: 15, color: CLAY })}{T(30, 92, '−', { size: 17, color: EDGE })}
          <line x1="60" y1="80" x2="60" y2="130" />
          <g fill={INK}>{fwd ? <polygon points="132,34 132,66 168,50" /> : <polygon points="168,34 168,66 132,50" />}</g>
          <line x1={fwd ? 172 : 128} y1="32" x2={fwd ? 172 : 128} y2="68" />
          <circle cx="260" cy="100" r="18" fill="var(--sc-mango-lt)" /><line x1="247" y1="87" x2="273" y2="113" stroke-width="2.5" /><line x1="273" y1="87" x2="247" y2="113" stroke-width="2.5" />
        </g>
      );
    }
    case 'signal': {
      // a current against time: a.c. (sine), half wave, full wave (bridge), smoothed full wave or d.c.
      const x0 = 30, x1 = 305, cy = f.shape === 'ac' ? 100 : 150, A = f.shape === 'ac' ? 60 : 110, n = 3, W = (x1 - x0) / n, pts: string[] = [];
      let prev = 0;
      for (let x = 0; x <= x1 - x0; x += 2) {
        const sn = Math.sin((2 * Math.PI * x) / W);
        let v = sn;
        if (f.shape === 'half') v = Math.max(sn, 0);
        else if (f.shape === 'full') v = Math.abs(sn);
        else if (f.shape === 'smooth') { v = Math.max(Math.abs(sn), prev * Math.exp(-0.0125 * (W / 92))); prev = v; }
        else if (f.shape === 'dc') v = 0.7;
        pts.push(`${x0 + x},${cy - A * v}`);
      }
      return (
        <g>
          <line x1={x0} y1={cy} x2={x1 + 6} y2={cy} stroke={INK} stroke-width="2.5" /><line x1={x0} y1="16" x2={x0} y2="186" stroke={INK} stroke-width="2.5" />
          <polyline points={pts.join(' ')} fill="none" stroke={EDGE} stroke-width="4" stroke-linejoin="round" />
          {T(x0 + 8, 18, 'I', { size: 13, anchor: 'start' })}{T(x1, cy + 16, 't', { size: 13, anchor: 'end' })}
        </g>
      );
    }
    case 'pn': {
      // a p-n junction: holes (open circles) in p, electrons (dots) in n, the depletion layer between; a cell is joined for forward or reverse bias
      const wd = f.bias === 'forward' ? 14 : f.bias === 'reverse' ? 62 : 32, cx = 160;
      const dots = (x0: number, x1: number, solid: boolean) => {
        const out: JSX.Element[] = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const x = x0 + 14 + (i * (x1 - x0 - 28)) / 3, y = 50 + j * 26;
          out.push(solid ? <circle cx={x} cy={y} r="5" fill={EDGE} /> : <circle cx={x} cy={y} r="5" fill="none" stroke={CLAY} stroke-width="2" />);
        }
        return out;
      };
      return (
        <g>
          <rect x="40" y="30" width="240" height="90" fill="var(--sc-panel)" stroke={INK} stroke-width="3" />
          <rect x={cx - wd / 2} y="30" width={wd} height="90" fill={WATER} stroke="none" />
          {dots(40, cx - wd / 2, false)}{dots(cx + wd / 2, 280, true)}
          {T(54, 16, 'p', { size: 17 })}{T(266, 16, 'n', { size: 17 })}
          {f.bias !== 'none' && <g stroke={INK} stroke-width="2.5" fill="none"><path d="M60 120 V170 H138 M150 170 H260 V120" />
            <line x1="138" y1={f.bias === 'forward' ? 158 : 164} x2="138" y2={f.bias === 'forward' ? 182 : 176} stroke-width={f.bias === 'forward' ? 2.5 : 6} />
            <line x1="150" y1={f.bias === 'forward' ? 164 : 158} x2="150" y2={f.bias === 'forward' ? 176 : 182} stroke-width={f.bias === 'forward' ? 6 : 2.5} />
            {T(f.bias === 'forward' ? 124 : 164, 152, '+', { size: 14, color: CLAY })}</g>}
        </g>
      );
    }
    case 'transistor': {
      // a transistor symbol: base on the left, collector above, emitter below (the arrow on the emitter points out for npn, in for pnp); labels = [base, collector, emitter]
      const lb = f.labels ?? ['B', 'C', 'E'], cx = 170, cy = 100;
      const npn = f.type === 'npn';
      return (
        <g stroke={INK} stroke-width="3" fill="none" stroke-linecap="round">
          <circle cx={cx} cy={cy} r="62" fill="var(--sc-panel)" stroke-width="2.5" />
          <line x1="60" y1={cy} x2="150" y2={cy} /><line x1="150" y1="68" x2="150" y2="132" stroke-width="6" />
          <line x1="150" y1="84" x2="196" y2="52" /><line x1="196" y1="52" x2="196" y2="22" />
          <line x1="150" y1="116" x2="196" y2="148" /><line x1="196" y1="148" x2="196" y2="178" />
          {npn ? <polygon points="196,148 176,146 186,132" fill={INK} stroke="none" /> : <polygon points="154,112 172,116 166,130" fill={INK} stroke="none" transform="translate(0 -2)" />}
          {T(48, cy, lb[0], { size: 16, anchor: 'end' })}{T(212, 26, lb[1], { size: 16, anchor: 'start' })}{T(212, 176, lb[2], { size: 16, anchor: 'start' })}
        </g>
      );
    }
    case 'divider': {
      // two resistors in series across a supply v; vb is the voltage at the junction between them (the base voltage)
      return (
        <g stroke={INK} stroke-width="3" fill="none">
          <line x1="120" y1="20" x2="120" y2="54" /><line x1="120" y1="54" x2="120" y2="54" />
          {res(120, 76, f.r1, 'v')}
          <line x1="120" y1="98" x2="120" y2="102" /><line x1="120" y1="102" x2="120" y2="116" /><line x1="120" y1="102" x2="210" y2="102" />
          {res(120, 138, f.r2, 'v')}
          <line x1="120" y1="160" x2="120" y2="182" /><line x1="100" y1="182" x2="140" y2="182" />
          <line x1="100" y1="20" x2="140" y2="20" />
          <circle cx="120" cy="102" r="4" fill={INK} />
          {T(150, 12, f.v, { size: 14, anchor: 'start' })}
          {f.vb && T(222, 102, f.vb, { size: 15, anchor: 'start', color: CLAY })}
        </g>
      );
    }
    case 'wirefield': {
      // the magnetic field round a straight wire seen end-on: a dot (current out of the page) or a cross (current into the page), with circular field lines
      const out = f.dir === 'out', cx = 160, cy = 100;
      const head = (r: number) => { const x = cx, y = cy - r, d = out ? -1 : 1; return <polygon points={`${x + d * 9},${y} ${x - d * 1},${y - 6} ${x - d * 1},${y + 6}`} fill={CLAY} />; };
      return (
        <g>
          {[28, 52, 76].map((r) => <g><circle cx={cx} cy={cy} r={r} fill="none" stroke={CLAY} stroke-width="2.5" />{head(r)}</g>)}
          <circle cx={cx} cy={cy} r="11" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />
          {out ? <circle cx={cx} cy={cy} r="3.5" fill={INK} /> : <g stroke={INK} stroke-width="2.5"><line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} /><line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} /></g>}
        </g>
      );
    }
    case 'fleming': {
      // a conductor seen end-on between the poles of a magnet; the field runs from N to S; current out of the page (dot) or into it (cross); force, if given, is the arrow on the conductor
      const nl = f.n === 'left', out = f.current === 'out', cx = 160, cy = 100;
      return (
        <g>
          <rect x="20" y="40" width="50" height="120" rx="4" fill={nl ? 'var(--sc-clay-lt)' : WATER} stroke={INK} stroke-width="2.5" />{T(45, 100, nl ? 'N' : 'S', { size: 22 })}
          <rect x="250" y="40" width="50" height="120" rx="4" fill={nl ? WATER : 'var(--sc-clay-lt)'} stroke={INK} stroke-width="2.5" />{T(275, 100, nl ? 'S' : 'N', { size: 22 })}
          {[56, 80, 120, 144].map((y) => (nl ? arrow(80, y, 240, y, INK2) : arrow(240, y, 80, y, INK2)))}
          <circle cx={cx} cy={cy} r="13" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />
          {out ? <circle cx={cx} cy={cy} r="4" fill={INK} /> : <g stroke={INK} stroke-width="2.5"><line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} /><line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} /></g>}
          {f.force === 'up' && arrow(cx, cy - 16, cx, cy - 52)}{f.force === 'down' && arrow(cx, cy + 16, cx, cy + 52)}
        </g>
      );
    }
    case 'xfmr': {
      // a transformer: two coils on an iron core; np and ns are written above the primary (left) and secondary (right) coils, vp and vs at the terminals
      const coil = (x: number, label: string) => (
        <g>
          {Array.from({ length: 6 }, (_, i) => <ellipse cx={x} cy={64 + i * 14} rx="16" ry="7" fill="none" stroke={CLAY} stroke-width="3" />)}
          {T(x, 42, label, { size: 15 })}
        </g>
      );
      return (
        <g>
          <rect x="105" y="52" width="110" height="104" rx="4" fill="none" stroke={INK2} stroke-width="14" />
          {coil(105, f.np)}{coil(215, f.ns)}
          <g stroke={INK} stroke-width="2.5" fill="none"><path d="M89 70 H40 M89 144 H40" /><path d="M231 70 H280 M231 144 H280" /></g>
          {f.vp && T(30, 107, f.vp, { size: 14, anchor: 'end' })}{f.vs && T(290, 107, f.vs, { size: 14, anchor: 'start' })}
        </g>
      );
    }
    case 'induct': {
      // a bar magnet moving towards, away from, or still near a coil joined to a centre-zero galvanometer G; the needle shows the deflection
      const dx = f.move === 'toward' ? 1 : f.move === 'away' ? -1 : 0, mx = f.move === 'toward' ? 50 : f.move === 'away' ? 80 : 65;
      const ang = ((dx * 32) * Math.PI) / 180;
      return (
        <g>
          <rect x={mx} y="48" width="36" height="26" fill="var(--sc-clay-lt)" stroke={INK} stroke-width="2.5" /><rect x={mx + 36} y="48" width="36" height="26" fill={WATER} stroke={INK} stroke-width="2.5" />
          {T(mx + 18, 61, 'N', { size: 14 })}{T(mx + 54, 61, 'S', { size: 14 })}
          {dx !== 0 && (dx > 0 ? arrow(mx + 14, 34, mx + 66, 34, INK2) : arrow(mx + 66, 34, mx + 14, 34, INK2))}
          {Array.from({ length: 6 }, (_, i) => <ellipse cx={190 + i * 12} cy="61" rx="10" ry="26" fill="none" stroke={CLAY} stroke-width="3" />)}
          <g stroke={INK} stroke-width="2.5" fill="none"><path d="M190 87 V120 H160 M250 87 V120 H280 V150 M160 120 V150" /><circle cx="220" cy="156" r="36" fill="var(--sc-panel)" transform="translate(0 4)" />
            <line x1="220" y1="160" x2={220 + 30 * Math.sin(ang)} y2={160 - 30 * Math.cos(ang)} stroke={CLAY} stroke-width="3" stroke-linecap="round" /></g>
          {T(220, 190, 'G', { size: 14 })}
        </g>
      );
    }
    case 'circuit': {
      // a cell on the left; the resistors one after another on the top wire (series), or side by side on the right (parallel)
      const series = f.layout === 'series';
      const x0 = f.r.length > 2 ? 140 : 160, dx = f.r.length > 2 ? 55 : 70;   // three branches sit closer, so the last label fits
      return (
        <g fill="none" stroke={INK} stroke-width="2.5">
          {series ? (
            <g>
              <rect x="50" y="40" width="220" height="130" fill="none" />
              {f.r.map((r, i) => res(f.r.length === 1 ? 160 : 100 + (i * 120) / (f.r.length - 1), 40, r))}
            </g>
          ) : (
            <g>
              <polyline points={`${x0},40 50,40 50,170 ${x0},170`} fill="none" />
              {f.r.map((r, i) => { const x = x0 + i * dx; return <g><polyline points={`${x},40 ${x},170`} fill="none" />{res(x, 105, r, 'v')}{i > 0 && <g><line x1={x - dx} y1="40" x2={x} y2="40" /><line x1={x - dx} y1="170" x2={x} y2="170" /></g>}</g>; })}
            </g>
          )}
          <g stroke="none">{cell(50, 105, f.v)}</g>
        </g>
      );
    }
    case 'lift': {
      // an object raised through a height h (it started on the ground, drawn dashed); f, if given, is the lifting force
      const bw = Math.max(64, f.mass.length * 9 + 18), bx = 190 - bw / 2;
      return (
        <g>
          <line x1="20" y1="176" x2="300" y2="176" stroke={INK} stroke-width="3" />
          <rect x={bx} y="130" width={bw} height="46" rx="4" fill="none" stroke={INK2} stroke-width="2" stroke-dasharray="5 4" />
          <rect x={bx} y="60" width={bw} height="46" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />{T(190, 83, f.mass, { size: 15 })}
          <g stroke={INK2} stroke-width="1.5"><line x1="80" y1="106" x2="80" y2="176" /><line x1="72" y1="106" x2="88" y2="106" /><line x1="72" y1="176" x2="88" y2="176" /></g>
          {T(70, 141, f.h, { size: 13, color: INK2, anchor: 'end' })}
          {f.f && <g>{arrow(190, 56, 190, 14)}{T(206, 30, f.f, { color: CLAY, anchor: 'start' })}</g>}
        </g>
      );
    }
    case 'push': {
      // a block pushed along a floor by a force f through a distance d (a dimension line under the floor)
      const bw = Math.max(70, (f.mass ?? '').length * 9 + 18);
      return (
        <g>
          <line x1="20" y1="130" x2="300" y2="130" stroke={INK} stroke-width="3" />
          <rect x="50" y="80" width={bw} height="50" rx="4" fill="none" stroke={INK2} stroke-width="2" stroke-dasharray="5 4" />
          <rect x="150" y="80" width={bw} height="50" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />{f.mass && T(150 + bw / 2, 105, f.mass, { size: 15 })}
          {arrow(150 + bw / 2 - 30, 66, 150 + bw / 2 + 30, 66)}
          <g stroke={INK2} stroke-width="1.5"><line x1={50 + bw / 2} y1="160" x2={150 + bw / 2} y2="160" /><line x1={50 + bw / 2} y1="154" x2={50 + bw / 2} y2="166" /><line x1={150 + bw / 2} y1="154" x2={150 + bw / 2} y2="166" /></g>
          {T(100 + bw / 2, 180, f.d, { size: 13, color: INK2 })}
          {T(150 + bw / 2, 48, f.f, { color: CLAY })}
        </g>
      );
    }
    case 'bars': {
      // kinetic (Ek) and potential (Ep) energy as two bars at each position; ek and ep run 0 to 100
      const n = f.groups.length, w = 300 / n, base = 150;
      return (
        <g>
          <line x1="10" y1={base} x2="310" y2={base} stroke={INK} stroke-width="3" />
          {f.groups.map((g, i) => {
            const cx = 10 + w * i + w / 2;
            return (
              <g>
                <rect x={cx - 28} y={base - g.ek * 1.2} width="24" height={Math.max(g.ek * 1.2, 1)} fill={EDGE} stroke={INK} stroke-width="1.5" />
                <rect x={cx + 4} y={base - g.ep * 1.2} width="24" height={Math.max(g.ep * 1.2, 1)} fill="var(--sc-leaf)" stroke={INK} stroke-width="1.5" />
                {T(cx - 16, base + 13, 'Ek', { size: 11, color: INK2 })}{T(cx + 16, base + 13, 'Ep', { size: 11, color: INK2 })}
                {T(cx, base + 33, g.at, { size: 15 })}
              </g>
            );
          })}
        </g>
      );
    }
    case 'swing': {
      // a swing (or pendulum): A is the lowest point, B the highest, on the right; the left side is the same height, dashed
      const px = 160, py = 22, L = 128, th = (40 * Math.PI) / 180;
      const bx = px + L * Math.sin(th), by = py + L * Math.cos(th);
      return (
        <g>
          <line x1="90" y1={py} x2="230" y2={py} stroke={INK} stroke-width="4" />
          <path d={`M${px - L * Math.sin(th)} ${by} A ${L} ${L} 0 0 0 ${bx} ${by}`} fill="none" stroke={INK2} stroke-width="1.5" stroke-dasharray="4 4" />
          <line x1={px} y1={py} x2={px} y2={py + L} stroke={INK2} stroke-width="1.5" stroke-dasharray="4 4" />
          <line x1={px} y1={py} x2={bx} y2={by} stroke={INK} stroke-width="3" />
          <circle cx={px} cy={py + L} r="11" fill={SOLID} stroke={INK} stroke-width="2.5" />{T(px, py + L + 26, f.a, { size: 15 })}
          <circle cx={bx} cy={by} r="11" fill={SOLID} stroke={INK} stroke-width="2.5" />{T(bx + 18, by, f.b, { size: 15, anchor: 'start' })}
        </g>
      );
    }
    case 'wave': {
      // a transverse wave: n whole waves from the rest line; size (0.3 to 1) is the height; amp and wl are written on the first amplitude and wavelength; pts labels crests A, B and troughs C, D
      const x0 = 40, x1 = 300, cy = 104, A = (f.size ?? 1) * 58, n = f.cycles, W = (x1 - x0) / n;
      const pts: string[] = [];
      for (let x = 0; x <= x1 - x0; x += 3) pts.push(`${x0 + x},${cy - A * Math.sin((2 * Math.PI * x) / W)}`);
      const cr = (k: number) => x0 + W / 4 + k * W, tr = (k: number) => x0 + (3 * W) / 4 + k * W;
      return (
        <g>
          <line x1={x0 - 10} y1={cy} x2={x1 + 8} y2={cy} stroke={INK2} stroke-width="1.5" stroke-dasharray="4 4" />
          <polyline points={pts.join(' ')} fill="none" stroke={EDGE} stroke-width="4" stroke-linejoin="round" />
          {f.amp && <g stroke={INK2} stroke-width="1.5"><line x1={x0 - 4} y1={cy} x2={x0 - 4} y2={cy - A} /><line x1={x0 - 9} y1={cy - A} x2={cr(0)} y2={cy - A} stroke-dasharray="3 3" /></g>}
          {f.amp && T(x0 - 12, cy - A / 2, f.amp, { size: 12, color: INK2, anchor: 'end' })}
          {f.wl && n >= 2 && <g stroke={INK2} stroke-width="1.5"><line x1={cr(0)} y1={cy - A - 20} x2={cr(1)} y2={cy - A - 20} /><line x1={cr(0)} y1={cy - A - 26} x2={cr(0)} y2={cy - A - 14} /><line x1={cr(1)} y1={cy - A - 26} x2={cr(1)} y2={cy - A - 14} /></g>}
          {f.wl && n >= 2 && T((cr(0) + cr(1)) / 2, cy - A - 33, f.wl, { size: 12, color: INK2 })}
          {f.pts && [0, 1].filter((k) => k < n).map((k) => T(cr(k), cy - A - 12, 'AB'.charAt(k), { size: 15 }))}
          {f.pts && [0, 1].filter((k) => k < n).map((k) => T(tr(k), cy + A + 14, 'CD'.charAt(k), { size: 15 }))}
        </g>
      );
    }
    case 'traces': {
      // up to three wave traces one above another (an oscilloscope), each with a letter on the left
      const n = f.items.length, H = 190 / n;
      return (
        <g>
          {f.items.map((it, j) => {
            const cy = 5 + H * j + H / 2, A = it.size * (H / 2 - 6), x0 = 50, x1 = 305, p: string[] = [];
            for (let x = 0; x <= x1 - x0; x += 3) p.push(`${x0 + x},${cy - A * Math.sin((2 * Math.PI * it.cycles * x) / (x1 - x0))}`);
            return (
              <g>
                <line x1={x0} y1={cy} x2={x1} y2={cy} stroke={INK2} stroke-width="1" stroke-dasharray="4 4" />
                <polyline points={p.join(' ')} fill="none" stroke={EDGE} stroke-width="3.5" stroke-linejoin="round" />
                {T(28, cy, it.l, { size: 16 })}
              </g>
            );
          })}
        </g>
      );
    }
    case 'slinky': {
      // a longitudinal wave in a slinky: coils bunch together (compressions) and spread apart (rarefactions); the wave moves to the right
      const lines: JSX.Element[] = [];
      const xs = (i: number) => 20 + i * 7.5 + 4.5 * Math.sin((2 * Math.PI * i) / 12);
      for (let i = 0; i < 38; i++) lines.push(<line x1={xs(i)} y1="62" x2={xs(i)} y2="132" stroke={INK} stroke-width="2.5" stroke-linecap="round" />);
      const mk = f.marks ?? {};
      return (
        <g>
          {lines}
          {mk.c && [6, 18, 30].map((i) => T(xs(i), 46, mk.c as string, { size: 15 }))}
          {mk.r && [12, 24].map((i) => T(xs(i), 46, mk.r as string, { size: 15 }))}
          {arrow(110, 168, 210, 168, EDGE)}{T(224, 168, 'v', { size: 14, anchor: 'start' })}
        </g>
      );
    }
    case 'sonar': {
      // a ship sends a pulse down to the sea bottom and it comes back; d is the depth
      return (
        <g>
          <line x1="10" y1="52" x2="310" y2="52" stroke={EDGE} stroke-width="3" stroke-dasharray="8 5" />
          <path d="M60 36 L60 46 L130 46 L140 36 Z" fill={SOLID} stroke={INK} stroke-width="2.5" stroke-linejoin="round" />
          <line x1="10" y1="178" x2="310" y2="178" stroke={INK} stroke-width="4" />
          {arrow(88, 54, 88, 172)}{arrow(116, 172, 116, 58, EDGE)}
          {f.t && T(150, 86, f.t, { size: 13, anchor: 'start', color: CLAY })}
          <g stroke={INK2} stroke-width="1.5"><line x1="250" y1="52" x2="250" y2="178" /><line x1="244" y1="52" x2="256" y2="52" /><line x1="244" y1="178" x2="256" y2="178" /></g>
          {T(240, 115, f.depth, { size: 14, anchor: 'end', color: INK2 })}
        </g>
      );
    }
    case 'mirror': {
      // reflection in a plane mirror: incident ray, reflected ray and the normal (dashed), with the angle labels i and r
      const a = ((f.angle ?? 40) * Math.PI) / 180, ox = 160, oy = 140, L = 105;
      const sx = ox - L * Math.sin(a), sy = oy - L * Math.cos(a), ex = ox + L * Math.sin(a);
      const arc = (rad: number, from: number, to: number) => `M${ox + rad * Math.sin(from)} ${oy - rad * Math.cos(from)} A ${rad} ${rad} 0 0 ${to > from ? 1 : 0} ${ox + rad * Math.sin(to)} ${oy - rad * Math.cos(to)}`;
      return (
        <g>
          <line x1="40" y1={oy} x2="280" y2={oy} stroke={INK} stroke-width="4" />
          {Array.from({ length: 13 }, (_, i) => <line x1={50 + i * 19} y1={oy} x2={42 + i * 19} y2={oy + 10} stroke={INK2} stroke-width="1.5" />)}
          <line x1={ox} y1="26" x2={ox} y2={oy} stroke={INK2} stroke-width="1.5" stroke-dasharray="5 4" />
          {arrow(sx, sy, ox - 2 * Math.sin(a), oy - 2 * Math.cos(a))}{arrow(ox, oy, ex, sy, CLAY)}
          <path d={arc(44, -a, 0)} fill="none" stroke={INK2} stroke-width="1.5" /><path d={arc(44, 0, a)} fill="none" stroke={INK2} stroke-width="1.5" />
          {T(ox - 38 * Math.sin(a / 2) - 12, oy - 62, f.i, { size: 14 })}{T(ox + 38 * Math.sin(a / 2) + 12, oy - 62, f.r, { size: 14 })}
        </g>
      );
    }
    case 'refract': {
      // a ray crossing from a rare medium (above) into a dense one (below), or the reverse; a1 is the angle in the rare medium, a2 in the dense one
      const a1 = ((f.a1 ?? 45) * Math.PI) / 180, a2 = ((f.a2 ?? 28) * Math.PI) / 180, ox = 160, oy = 100, L = 85;
      const rare = f.from === 'rare';
      const top = { x: ox - L * Math.sin(a1), y: oy - L * Math.cos(a1) }, topOut = { x: ox + L * Math.sin(a1), y: oy - L * Math.cos(a1) };
      const botIn = { x: ox - L * Math.sin(a2), y: oy + L * Math.cos(a2) }, botOut = { x: ox + L * Math.sin(a2), y: oy + L * Math.cos(a2) };
      return (
        <g>
          <rect x="30" y={oy} width="260" height="92" fill={WATER} />
          <line x1="30" y1={oy} x2="290" y2={oy} stroke={INK} stroke-width="3" />
          <line x1={ox} y1="8" x2={ox} y2="192" stroke={INK2} stroke-width="1.5" stroke-dasharray="5 4" />
          {rare ? <g>{arrow(top.x, top.y, ox - 2, oy - 2)}{arrow(ox, oy, botOut.x, botOut.y, CLAY)}</g> : <g>{arrow(botIn.x, botIn.y, ox - 2, oy + 2)}{arrow(ox, oy, topOut.x, topOut.y, CLAY)}</g>}
          {rare ? T(ox - 38, oy - 40, f.i, { size: 14 }) : T(ox - 34, oy + 52, f.i, { size: 14 })}
          {rare ? T(ox + 30, oy + 60, f.r, { size: 14 }) : T(ox + 40, oy - 40, f.r, { size: 14 })}
        </g>
      );
    }
    case 'tir': {
      // a ray in water (below) meeting the surface at a small angle, the critical angle, or a bigger angle; i is written on the incident ray
      const ox = 160, oy = 100, L = 85, deg = (d: number) => (d * Math.PI) / 180;
      const ang = f.state === 'less' ? 30 : f.state === 'critical' ? 49 : 65;
      const a = deg(ang), sx = ox - L * Math.sin(a), sy = oy + L * Math.cos(a);
      return (
        <g>
          <rect x="30" y={oy} width="260" height="92" fill={WATER} />
          <line x1="30" y1={oy} x2="290" y2={oy} stroke={INK} stroke-width="3" />
          <line x1={ox} y1="8" x2={ox} y2="192" stroke={INK2} stroke-width="1.5" stroke-dasharray="5 4" />
          {arrow(sx, sy, ox - 2 * Math.sin(a), oy + 2 * Math.cos(a))}
          {f.state === 'less' && arrow(ox, oy, ox + 78 * Math.sin(deg(48)), oy - 78 * Math.cos(deg(48)), CLAY)}
          {f.state === 'critical' && arrow(ox, oy, ox + 90, oy - 1, CLAY)}
          {f.state === 'greater' && arrow(ox, oy, ox + L * Math.sin(a), oy + L * Math.cos(a), CLAY)}
          {T(ox - 28, oy + 40, f.i ?? 'i', { size: 14 })}
        </g>
      );
    }
    case 'lens': {
      // a ray diagram for a lens: object O (u focal lengths from the lens), the image I from the lens formula, the parallel ray and the ray through the centre
      const cx = 160, ay = 100, k = 40, h = 34, convex = f.type !== 'concave', u = f.u;
      const v = convex ? u / (u - 1) : -u / (u + 1), m = -v / u, ox = cx - u * k, ix = cx + v * k;
      const tipY = ay - h, imY = ay - m * h, virtual = v < 0;
      const xe = 300, yAt = (x0: number, y0: number, x1: number, y1: number, x: number) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
      return (
        <g>
          <line x1="10" y1={ay} x2="310" y2={ay} stroke={INK2} stroke-width="1.5" />
          {convex ? <path d={`M${cx} ${ay - 52} Q${cx + 16} ${ay} ${cx} ${ay + 52} Q${cx - 16} ${ay} ${cx} ${ay - 52} Z`} fill={WATER} stroke={INK} stroke-width="2.5" />
                  : <path d={`M${cx - 10} ${ay - 52} L${cx + 10} ${ay - 52} Q${cx + 2} ${ay} ${cx + 10} ${ay + 52} L${cx - 10} ${ay + 52} Q${cx - 2} ${ay} ${cx - 10} ${ay - 52} Z`} fill={WATER} stroke={INK} stroke-width="2.5" />}
          {[-2, -1, 1, 2].map((j) => <g><line x1={cx + j * k} y1={ay - 4} x2={cx + j * k} y2={ay + 4} stroke={INK} stroke-width="2" />{T(cx + j * k, ay + 16, Math.abs(j) === 1 ? 'F' : '2F', { size: 11, color: INK2 })}</g>)}
          <g stroke={CLAY} stroke-width="2" fill="none">
            <line x1={ox} y1={tipY} x2={cx} y2={tipY} />
            {convex ? <line x1={cx} y1={tipY} x2={xe} y2={yAt(cx, tipY, cx + k, ay, xe)} /> : <line x1={cx} y1={tipY} x2={xe} y2={yAt(cx - k, ay, cx, tipY, xe)} />}
            <line x1={ox} y1={tipY} x2={xe} y2={yAt(ox, tipY, cx, ay, xe)} />
          </g>
          {virtual && <g stroke={INK2} stroke-width="1.5" stroke-dasharray="4 4"><line x1={cx} y1={tipY} x2={ix} y2={imY} />{convex ? <line x1={cx} y1={ay} x2={ix} y2={imY} /> : <line x1={cx} y1={ay} x2={ix} y2={imY} />}</g>}
          {arrow(ox, ay, ox, tipY, INK)}{T(ox, tipY - 10, 'O', { size: 13 })}
          <g stroke-dasharray={virtual ? '4 3' : undefined}>{arrow(ix, ay, ix, imY, EDGE)}</g>{T(ix, imY + (m >= 0 ? -10 : 12), 'I', { size: 13, color: EDGE })}
        </g>
      );
    }
    case 'scales': {
      // a thermometer from 0 to 100 °C with the kelvin values beside it; c, if given, is where the mercury stands and mark is the letter on that level
      const yy = (c: number) => 150 - c * 1.2;
      return (
        <g>
          <rect x="152" y="24" width="16" height="132" rx="8" fill="var(--sc-panel)" stroke={INK} stroke-width="2.5" />
          <circle cx="160" cy="166" r="14" fill={CLAY} stroke={INK} stroke-width="2.5" />
          {f.c !== undefined && <rect x="156" y={yy(f.c)} width="8" height={160 - yy(f.c)} fill={CLAY} />}
          {[0, 25, 50, 75, 100].map((c) => <g><line x1="140" y1={yy(c)} x2="152" y2={yy(c)} stroke={INK} stroke-width="2" /><line x1="168" y1={yy(c)} x2="180" y2={yy(c)} stroke={INK} stroke-width="2" />
            {T(134, yy(c), String(c), { size: 12, anchor: 'end' })}{T(186, yy(c), String(c + 273), { size: 12, anchor: 'start' })}</g>)}
          {T(134, 10, '°C', { size: 13, anchor: 'end', color: INK2 })}{T(186, 10, 'K', { size: 13, anchor: 'start', color: INK2 })}
          {f.c !== undefined && f.mark && <g><line x1="168" y1={yy(f.c)} x2="236" y2={yy(f.c)} stroke={CLAY} stroke-width="2" stroke-dasharray="4 3" />{T(246, yy(f.c), f.mark, { size: 15, anchor: 'start', color: CLAY })}</g>}
        </g>
      );
    }
    case 'resistor': {
      const n = f.bands.length;
      return (
        <g>
          <line x1="20" y1="100" x2="300" y2="100" stroke={INK} stroke-width="4" />
          <rect x="80" y="70" width="160" height="60" rx="26" fill="#e8d5b0" stroke={INK} stroke-width="2.5" />
          {f.bands.map((b, i) => <rect x={100 + i * (n === 4 && i === 3 ? 32 : 26)} y="70" width="14" height="60" fill={BAND[b] ?? '#999'} stroke={INK} stroke-width="1" />)}
          {f.bands.map((b, i) => T(107 + i * (n === 4 && i === 3 ? 32 : 26), 150, String(i + 1), { size: 11, color: INK2 }))}
        </g>
      );
    }
    case 'lever': {
      // a beam (on a pivot unless pivot is false); each load is an arrow at x (distance from the middle, negative = left) with its force
      // above the beam (an up force under it) and its distance written below, from the pivot
      const m = Math.max(...f.loads.map((l) => Math.abs(l.x)), 1), k = 110 / m, cx = 160, by = 100;
      const X = (x: number) => cx + x * k;
      const rows: Record<string, number> = {};
      return (
        <g>
          <rect x={cx - m * k - 26} y={by - 5} width={2 * m * k + 52} height="10" rx="3" fill={SOLID} stroke={INK} stroke-width="2.5" />
          {f.pivot !== false && <g><polygon points={`${cx},${by + 5} ${cx - 14},${by + 32} ${cx + 14},${by + 32}`} fill={INK2} stroke={INK} stroke-width="2" /><line x1={cx - 40} y1={by + 32} x2={cx + 40} y2={by + 32} stroke={INK} stroke-width="3" /></g>}
          {f.loads.map((l) => {
            const up = l.dir === 'up', x = X(l.x), side = l.x < 0 ? 'l' : 'r', row = (rows[side] = (rows[side] ?? -1) + 1);
            const ry = 166 + row * 16;
            return (
              <g>
                {up ? <g>{arrow(x, by + 42, x, by + 7)}{x > 230 ? T(x - 8, by + 30, l.f, { color: CLAY, anchor: 'end' }) : T(x + 8, by + 30, l.f, { color: CLAY, anchor: 'start' })}</g> : <g>{arrow(x, 44, x, by - 7)}{T(x, 32, l.f, { color: CLAY })}</g>}
                {l.x !== 0 && <g stroke={INK2} stroke-width="1.5"><line x1={cx} y1={ry - 7} x2={x} y2={ry - 7} /><line x1={cx} y1={ry - 12} x2={cx} y2={ry - 2} /><line x1={x} y1={ry - 12} x2={x} y2={ry - 2} /></g>}
                {l.x !== 0 && T((cx + x) / 2, ry + 5, l.d ?? Math.abs(l.x) + ' cm', { size: 11, color: INK2 })}
              </g>
            );
          })}
        </g>
      );
    }
    case 'vectors': {
      // two forces pulling on one point at an angle (a along the right, b at the angle above it); r, if given, is the dashed resultant between them
      const th = ((f.angle ?? 65) * Math.PI) / 180, ox = 80, oy = 150, la = 130, lb = 105;
      const ax = ox + la, ay = oy, bx = ox + lb * Math.cos(th), by = oy - lb * Math.sin(th), rx = ax + bx - ox, ry = ay + by - oy;
      return (
        <g>
          <circle cx={ox} cy={oy} r="6" fill={INK} />
          {arrow(ox, oy, ax, ay)}{T(ax - 4, ay + 16, f.a, { color: CLAY })}
          {arrow(ox, oy, bx, by)}{T(bx - 16, by - 6, f.b, { color: CLAY, anchor: 'end' })}
          {f.r && <g><g stroke={INK2} stroke-width="1.5" stroke-dasharray="4 4"><line x1={ax} y1={ay} x2={rx} y2={ry} /><line x1={bx} y1={by} x2={rx} y2={ry} /></g>{arrow(ox, oy, rx, ry, EDGE)}{T(rx + 8, ry - 12, f.r, { color: EDGE, anchor: 'start' })}</g>}
        </g>
      );
    }
    case 'updown': {
      // a block with a force up and a force down: on a table (the table pushes up) or hanging from a rope (the rope pulls up)
      const bw = Math.max(70, f.mass.length * 9 + 18), bx = 160 - bw / 2;
      return (
        <g>
          {f.hang ? (
            <g><line x1="100" y1="18" x2="220" y2="18" stroke={INK} stroke-width="4" /><line x1="160" y1="18" x2="160" y2="84" stroke={INK} stroke-width="3" />
              <rect x={bx} y="84" width={bw} height="54" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />{T(160, 111, f.mass, { size: 15 })}
              {arrow(184, 80, 184, 34)}{T(212, 52, f.up, { color: CLAY, anchor: 'start' })}{arrow(160, 142, 160, 190)}{T(176, 172, f.down, { color: CLAY, anchor: 'start' })}</g>
          ) : (
            <g><line x1="40" y1="130" x2="280" y2="130" stroke={INK} stroke-width="3" />
              <rect x={bx} y="76" width={bw} height="54" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />{T(160, 103, f.mass, { size: 15 })}
              {arrow(176, 72, 176, 26)}{T(204, 44, f.up, { color: CLAY, anchor: 'start' })}{arrow(160, 134, 160, 188)}{T(176, 170, f.down, { color: CLAY, anchor: 'start' })}</g>
          )}
        </g>
      );
    }
    case 'cords': {
      // a weight hanging from the ceiling on two slanting cords
      return (
        <g>
          <line x1="40" y1="20" x2="280" y2="20" stroke={INK} stroke-width="4" />
          <line x1="80" y1="20" x2="160" y2="96" stroke={INK} stroke-width="3" /><line x1="240" y1="20" x2="160" y2="96" stroke={INK} stroke-width="3" />
          <rect x="130" y="96" width="60" height="42" rx="4" fill={SOLID} stroke={INK} stroke-width="2.5" />
          {T(103, 66, f.a, { color: CLAY, anchor: 'end' })}{T(217, 66, f.b, { color: CLAY, anchor: 'start' })}
          {arrow(160, 142, 160, 190)}{T(176, 172, f.w, { color: CLAY, anchor: 'start' })}
        </g>
      );
    }
  }
}

export default function FigureSvg({ figure, label }: { figure: Figure; label: string }) {
  return (
    <svg class="fd-figure" viewBox="0 0 320 200" role="img" aria-label={label}>
      {draw(figure)}
    </svg>
  );
}
