import { FILL, STROKE, type IconName } from '../lib/icons';

/** The drawn icon set inside islands (the Astro pages use components/Icon.astro); always decorative here. */
export default function Ico({ name }: { name: IconName }) {
  const filled = name in FILL;
  const d = filled ? FILL[name as keyof typeof FILL] : STROKE[name as keyof typeof STROKE];
  return (
    <span class="ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path class={filled ? 'f' : undefined} d={d} /></svg>
    </span>
  );
}
