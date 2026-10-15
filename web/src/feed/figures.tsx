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
  | { kind: 'graph'; axis: 'v' | 's'; points: [number, number][] }
  | { kind: 'route'; legs: ['N' | 'S' | 'E' | 'W', number][] }
  | { kind: 'forces'; mass: string; left: string; right: string }
  | { kind: 'circuit'; layout: 'series' | 'parallel'; r: string[]; v: string }
  | { kind: 'resistor'; bands: string[] }
  | { kind: 'lift'; mass: string; h: string; f?: string }
  | { kind: 'push'; f: string; d: string; mass?: string }
  | { kind: 'bars'; groups: { at: string; ek: number; ep: number }[] }
  | { kind: 'swing'; a: string; b: string };

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
          {T(x0 - 6, y0 + 13, '0', { size: 11, color: INK2, anchor: 'end' })}
          {T(x1, y0 + 26, 't (s)', { size: 11, anchor: 'end' })}
          {T(x0 + 4, y1 - 14, f.axis === 'v' ? 'v (m s⁻¹)' : 's (m)', { size: 11, anchor: 'start' })}
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
  }
}

export default function FigureSvg({ figure, label }: { figure: Figure; label: string }) {
  return (
    <svg class="fd-figure" viewBox="0 0 320 200" role="img" aria-label={label}>
      {draw(figure)}
    </svg>
  );
}
