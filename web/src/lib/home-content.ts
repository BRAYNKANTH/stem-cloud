// Course map shown on the Home page (text from public/static/home.html, unchanged).
// Lessons will later come from the content catalog (docs/migration-plan-astro.md, section 3.3).

export type Grade = '10' | '11' | 'exam';

export interface CourseCard {
  grade: Grade;
  meta: [string, string];
  title: string;
  text: string;
}

export const COURSE_MAP: CourseCard[] = [
  { grade: '10', meta: ['GRADE 10', 'UNIT 01'], title: 'Physics is Easy & Fun', text: 'Introduction to scientific intuition, measurement fundamentals, and overcoming physics hesitation.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 02'], title: 'Motion in a Straight Line', text: 'Displacement, velocity, acceleration, ticker tape timers, and velocity-time graphs.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 04'], title: "Newton's Laws of Motion", text: 'Inertia, F = ma, action and reaction, and practical applications in transport and sports.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 05'], title: 'Friction & Surface Interaction', text: 'Static vs limiting vs dynamic friction, coefficients of friction, and lubrication.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 09'], title: 'Resultant Force & Vectors', text: 'Parallel forces, vector addition, resolution, and equilibrium of coplanar forces.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 11'], title: 'Turning Effect of Forces', text: 'Torque, principle of moments, clockwise vs anticlockwise moments, and levers.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 12'], title: 'Equilibrium & Stability', text: 'Stable, unstable, and neutral equilibrium, center of gravity, and base area.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 15'], title: 'Hydrostatic Pressure', text: 'Pressure in fluids, liquid column formula P = hρg, transmission, and U-tube manometers.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 18'], title: 'Work, Energy & Power', text: 'Kinetic & potential energy, conservation of energy, work done calculations, and power ratings.' },
  { grade: '10', meta: ['GRADE 10', 'UNIT 19'], title: 'Current Electricity', text: "Electric potential, Ohm's law (V = IR), series and parallel circuits, and resistor combinations." },
  { grade: '11', meta: ['GRADE 11', 'UNIT 04'], title: 'Waves & Sound', text: 'Transverse and longitudinal waves, wave equation v = fλ, frequency, reflection, and resonance.' },
  { grade: '11', meta: ['GRADE 11', 'UNIT 05'], title: 'Geometrical Optics', text: "Refraction, Snell's law, convex and concave lenses, ray diagrams, and optical instruments." },
  { grade: '11', meta: ['GRADE 11', 'UNIT 09'], title: 'Heat & Thermal Physics', text: 'Specific heat capacity Q = mcΔθ, heat transfer, latent heat, evaporation, and thermal expansion.' },
  { grade: '11', meta: ['GRADE 11', 'UNIT 10'], title: 'Domestic Electric Appliances', text: 'Household wiring, earthing, fuses, circuit breakers, power consumption, and safety.' },
  { grade: '11', meta: ['GRADE 11', 'UNIT 11'], title: 'Electronics & Semiconductors', text: 'Diodes, rectification, transistors as switches and amplifiers, and logic gate basics.' },
  { grade: '11', meta: ['GRADE 11', 'UNIT 13'], title: 'Electromagnetism', text: "Magnetic field lines, Fleming's left-hand rule, electric motors, induction, and transformers." },
  { grade: 'exam', meta: ['EXAM DRILL', 'ARCHIVE'], title: 'G.C.E. O/L Past Papers', text: 'Official Sri Lankan Ordinary Level past exam papers with structured breakdown and worked solutions.' },
];
