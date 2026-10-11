import { useState } from 'preact/hooks';
import Ico from './Ico';

// Same experiment as the current Home page: 20 N hangs 2 m left of the pivot (40 N·m anticlockwise);
// the student slides the right-hand weight (also 2 m out) from 5 to 40 N until the lever balances at 20 N.
const LEFT_MOMENT = 40;
const DISTANCE = 2;

/** Hero "Live Simulation Preview": a lever that tips with the principle of moments. */
export default function MomentsDemo() {
  const [right, setRight] = useState(10);
  const rightMoment = right * DISTANCE;
  const net = rightMoment - LEFT_MOMENT;
  const angle = Math.max(-12, Math.min(12, net * 0.45));
  const state = Math.abs(net) < 1 ? 'eq' : net > 0 ? 'cw' : 'acw';
  const status =
    state === 'eq' ? `Perfect Equilibrium! Clockwise (${LEFT_MOMENT} N·m) = Anticlockwise (${LEFT_MOMENT} N·m)`
    : state === 'cw' ? `Unbalanced: Clockwise moment is greater (${rightMoment} N·m vs ${LEFT_MOMENT} N·m)`
    : `Unbalanced: Anticlockwise moment is greater (${LEFT_MOMENT} N·m vs ${rightMoment} N·m)`;
  return (
    <div class="sim-box">
      <div class="sim-stage" aria-hidden="true">
        <div class="sim-lever" style={{ transform: `rotate(${angle}deg)` }}>
          <div class="sim-mass-left">20 N</div>
          <div class="sim-mass-right">{right} N</div>
        </div>
        <div class="sim-pivot" />
      </div>
      <div class="sim-controls">
        <div class="sim-row">
          <span>Left Distance: <strong>{DISTANCE} m</strong></span>
          <span>Right Mass: <strong>{right} N</strong></span>
        </div>
        <input type="range" class="sim-slider" min={5} max={40} step={5} value={right} aria-label="Adjust Right Mass"
               onInput={(e) => setRight(parseInt((e.target as HTMLInputElement).value, 10))} />
        <div class={`sim-status ${state}`} role="status" aria-live="polite">
          <Ico name={state === 'eq' ? 'scale' : 'warn'} /> {status}
        </div>
      </div>
    </div>
  );
}
