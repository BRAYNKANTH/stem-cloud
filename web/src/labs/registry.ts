// The labs rebuilt as islands (docs/migration-plan-astro.md, Phase 8), by lesson and step. A lab step whose lab is
// not here yet shows the current lesson page's lab in a frame (LegacyFrame), as before.
import { STRINGS as MOTION } from './physics/MotionLab';
import { STRINGS as FORCE } from './physics/ForceLab';
import { STRINGS as FRICTION } from './physics/FrictionLab';

export interface PortedLab {
  /** Which island renders it (components/lesson/Step.astro). */
  island: 'motion' | 'force' | 'friction';
  /** Its fixed English strings, for the Sinhala looked up at build time. */
  strings: string[];
}

export const LABS: Record<string, PortedLab> = {
  'physics.g10.motion-in-a-straight-line/lab': { island: 'motion', strings: MOTION },
  'physics.g10.newtons-laws/lab': { island: 'force', strings: FORCE },
  'physics.g10.friction/lab': { island: 'friction', strings: FRICTION },
};
