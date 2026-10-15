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
  | { kind: 'float'; weight: string; sub: number };

const INK = 'var(--sc-ink)', INK2 = 'var(--sc-ink-2)', WATER = 'var(--sc-blue-lt)', EDGE = 'var(--sc-blue)', SOLID = 'var(--sc-mango-lt)', HG = 'var(--sc-ink-2)', CLAY = 'var(--sc-clay)';
const T = (x: number, y: number, s: string, o: { size?: number; anchor?: 'start' | 'middle' | 'end'; color?: string } = {}) => (
  <text x={x} y={y} font-size={o.size ?? 13} font-weight="800" text-anchor={o.anchor ?? 'middle'} dominant-baseline="middle" fill={o.color ?? INK}>{s}</text>
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
  }
}

export default function FigureSvg({ figure, label }: { figure: Figure; label: string }) {
  return (
    <svg class="fd-figure" viewBox="0 0 320 200" role="img" aria-label={label}>
      {draw(figure)}
    </svg>
  );
}
