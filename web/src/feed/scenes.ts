/*
 * The learning feed's "predict, then watch" scenes, drawn on a canvas (no video to download). A scene plays from the
 * start to its pause point, waits for the student's prediction, then plays to the end and shows what happens.
 * draw(ctx, t, c) paints the frame at t (0 to 1) on a 320 x 240 board; c are the page's theme colours.
 */

export interface Colors { ink: string; ink2: string; line: string; panel: string; blue: string; blueLt: string; mango: string; clay: string; leaf: string }
export interface Scene {
  /** where the scene stops for the prediction, 0 to 1 */
  pause: number;
  /** milliseconds for the whole scene */
  ms: number;
  draw: (ctx: CanvasRenderingContext2D, t: number, c: Colors) => void;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
/** progress of t through [a, b], 0 to 1 */
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 14, align: CanvasTextAlign = 'center') {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A bottle with holes at three depths: the deeper the hole, the faster the jet (v grows with √depth). */
const bottle: Scene = {
  pause: 0.3,
  ms: 5200,
  draw(ctx, t, c) {
    const top = 46, bottom = 214, x0 = 70, x1 = 150, surface = 60;
    ctx.fillStyle = c.blueLt;
    ctx.fillRect(x0, surface, x1 - x0, bottom - surface);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 3;
    roundRect(ctx, x0, top, x1 - x0, bottom - top, 10);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 2, surface); ctx.lineTo(x1 - 2, surface); ctx.strokeStyle = c.blue; ctx.lineWidth = 2; ctx.stroke();
    const holes = [{ y: 100, n: '1' }, { y: 145, n: '2' }, { y: 190, n: '3' }];
    const open = span(t, this.pause, 1);
    holes.forEach((h) => {
      const depth = h.y - surface;
      // the jet: drawn until it has fallen 46 px, so its length shows its speed (deepest hole longest)
      if (open > 0) {
        const reach = 115 * Math.sqrt(depth / (190 - surface)) * open;
        ctx.beginPath();
        ctx.moveTo(x1, h.y);
        for (let i = 1; i <= 24; i++) {
          const f = i / 24;
          ctx.lineTo(x1 + reach * f, h.y + 46 * f * f * open);
        }
        ctx.strokeStyle = c.blue;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x1, h.y, 5, 0, Math.PI * 2); ctx.fillStyle = c.ink; ctx.fill();
      label(ctx, h.n, x0 - 16, h.y, c.ink2, 13);
      if (t >= this.pause && open === 0) label(ctx, '?', x1 + 24, h.y, c.clay, 18);
    });
    label(ctx, open > 0 ? '' : 'water', (x0 + x1) / 2, (surface + bottom) / 2, c.blue, 13);
  },
};

/** One bulb, then a second bulb in series: the current halves and both bulbs are dimmer. */
const bulbs: Scene = {
  pause: 0.45,
  ms: 5200,
  draw(ctx, t, c) {
    const slide = span(t, 0.15, 0.4);        // the second bulb moves into the circuit
    const after = span(t, this.pause, this.pause + 0.2);
    const glowA = 1 - 0.55 * after, glowB = 0.45 * after;
    // the circuit: a rectangle with the cell on the left
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
    ctx.strokeRect(50, 60, 220, 130);
    ctx.fillStyle = c.panel; ctx.fillRect(40, 108, 20, 34);
    ctx.beginPath(); ctx.moveTo(36, 116); ctx.lineTo(64, 116); ctx.moveTo(42, 134); ctx.lineTo(58, 134); ctx.lineWidth = 4; ctx.stroke();
    label(ctx, '+', 74, 116, c.ink2, 13);
    const bulb = (x: number, y: number, glow: number) => {
      if (glow > 0) {
        ctx.beginPath(); ctx.arc(x, y, 14 + 26 * glow, 0, Math.PI * 2);
        ctx.fillStyle = c.mango; ctx.globalAlpha = 0.25 + 0.45 * glow; ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = c.panel; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.lineWidth = 2; ctx.stroke();
    };
    bulb(130, 60, glowA);
    label(ctx, 'A', 130, 30, c.ink2, 13);
    // bulb B slides down from above into the right-hand wire
    const by = 125 - (1 - slide) * 90;
    if (slide > 0) {
      ctx.fillStyle = c.panel; ctx.fillRect(258, 112, 24, 26);
      bulb(270, by, after > 0 ? glowB : 0);
      label(ctx, 'B', 296, by, c.ink2, 13);
    }
    if (t >= this.pause && after === 0) label(ctx, '?', 130, 98, c.clay, 20);
  },
};

/** Ice heated steadily: the temperature rises to 0 °C, stays there while the ice melts, then rises again. */
const melt: Scene = {
  pause: 0.3,
  ms: 6400,
  draw(ctx, t, c) {
    const melted = span(t, this.pause, 0.8);
    const temp = t < this.pause ? -10 + 10 * span(t, 0, this.pause) : t < 0.8 ? 0 : 20 * span(t, 0.8, 1);
    // the beaker
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(60, 70); ctx.lineTo(60, 180); ctx.lineTo(180, 180); ctx.lineTo(180, 70); ctx.stroke();
    // water rising as the ice melts
    const wh = 6 + 34 * melted;
    ctx.fillStyle = c.blueLt; ctx.fillRect(62, 178 - wh, 116, wh);
    // the ice cubes shrinking
    const s = 34 * (1 - melted);
    if (s > 1) {
      ctx.fillStyle = c.panel; ctx.strokeStyle = c.blue; ctx.lineWidth = 2;
      [[80, 1], [124, 0.85]].forEach(([x, k]) => { const z = s * (k as number); ctx.fillRect(x as number, 176 - z, z, z); ctx.strokeRect(x as number, 176 - z, z, z); });
    }
    // the flame, flickering
    const fl = 1 + 0.15 * Math.sin(t * 60);
    ctx.fillStyle = c.mango;
    ctx.beginPath(); ctx.moveTo(100, 226); ctx.quadraticCurveTo(120, 226 - 30 * fl, 140, 226); ctx.fill();
    ctx.fillStyle = c.clay;
    ctx.beginPath(); ctx.moveTo(110, 226); ctx.quadraticCurveTo(120, 226 - 16 * fl, 130, 226); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, 196); ctx.lineTo(184, 196); ctx.stroke();
    // the thermometer and its reading
    const tx = 236, ty0 = 50, ty1 = 190, level = ty1 - ((temp + 10) / 40) * (ty1 - ty0);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; roundRect(ctx, tx - 7, ty0, 14, ty1 - ty0 + 8, 7); ctx.stroke();
    ctx.fillStyle = c.clay; ctx.fillRect(tx - 3, level, 6, ty1 - level + 4);
    ctx.beginPath(); ctx.arc(tx, ty1 + 10, 10, 0, Math.PI * 2); ctx.fill();
    const zeroY = ty1 - (10 / 40) * (ty1 - ty0);
    ctx.beginPath(); ctx.moveTo(tx + 9, zeroY); ctx.lineTo(tx + 16, zeroY); ctx.stroke();
    label(ctx, '0', tx + 24, zeroY, c.ink2, 11, 'left');
    label(ctx, `${Math.round(temp)} °C`, tx, 32, c.ink, 16);
    if (t >= this.pause && melted === 0) label(ctx, '?', 120, 120, c.clay, 20);
  },
};

export const SCENES: Record<string, Scene> = { bottle, bulbs, melt };

/** The theme's colours, read from the page (they change with light / dark). */
export function themeColors(): Colors {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => s.getPropertyValue(n).trim() || d;
  return {
    ink: v('--sc-ink', '#16183D'), ink2: v('--sc-ink-2', '#4A4E72'), line: v('--sc-line', '#DDE1F5'), panel: v('--sc-panel', '#FFFFFF'),
    blue: v('--sc-blue', '#3443D9'), blueLt: v('--sc-blue-lt', '#E3E6FF'), mango: v('--sc-mango', '#FFB21E'), clay: v('--sc-clay', '#C2410C'), leaf: v('--sc-leaf', '#1F8A4C'),
  };
}
