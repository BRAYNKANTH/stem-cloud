// The labs rebuilt as islands (docs/migration-plan-astro.md, Phase 8), by lesson and step, rendered by
// components/lesson/LabIsland.astro. A lab step whose lab is not here shows the current lesson page's lab in a frame
// (LegacyFrame).
import { STRINGS as MOTION } from './physics/MotionLab';
import { STRINGS as FORCE } from './physics/ForceLab';
import { STRINGS as FRICTION } from './physics/FrictionLab';
import { STRINGS as RESULTANT } from './physics/ResultantLab';
import { STRINGS as SEESAW } from './physics/SeesawLab';
import { STRINGS as EQUILIBRIUM } from './physics/EquilibriumLab';
import { SLIDER_LABS } from './slider';

export interface PortedLab {
  /** Which island renders it (components/lesson/Step.astro). */
  island: 'motion' | 'force' | 'friction' | 'resultant' | 'seesaw' | 'equilibrium' | (string & {});
  /** One of the slider labs lifted by tools/slider_labs.py (rendered by labs/slider/SliderLabs.astro). */
  slider?: boolean;
  /** Its fixed English strings, for the Sinhala looked up at build time. */
  strings: string[];
}

export const LABS: Record<string, PortedLab> = {
  'physics.g10.motion-in-a-straight-line/lab': { island: 'motion', strings: MOTION },
  'physics.g10.newtons-laws/lab': { island: 'force', strings: FORCE },
  'physics.g10.friction/lab': { island: 'friction', strings: FRICTION },
  'physics.g10.resultant-force/lab': { island: 'resultant', strings: RESULTANT },
  'physics.g10.turning-effect/lab': { island: 'seesaw', strings: SEESAW },
  'physics.g10.equilibrium/lab': { island: 'equilibrium', strings: EQUILIBRIUM },
  ...Object.fromEntries(Object.entries(SLIDER_LABS).map(([k, l]) => [k, { ...l, slider: true }])),
};
