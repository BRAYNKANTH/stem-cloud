import os, re, json, sys
sys.stdout.reconfigure(encoding='utf-8')

LESSONS_DIR = r"c:\Users\T.BRAYNKANTH\SCIENXE\stem-cloud\site\lessons"
lessons = [
    'unit-02-motion-in-a-straight-line.html',
    'chapter-04-newtons-laws.html',
    'chapter-05-friction.html',
    'chapter-09-resultant-force.html',
    'chapter-11-turning-effect.html',
    'chapter-12-equilibrium.html',
    'g10-chapter-15-hydrostatic-pressure.html',
    'g10-chapter-18-work-energy-power.html',
    'g10-chapter-19-current-electricity.html',
    'g11-chapter-04-waves.html',
    'g11-chapter-05-geometrical-optics.html',
    'g11-chapter-09-heat.html',
    'g11-chapter-10-electric-appliances.html',
    'g11-chapter-11-electronics.html',
    'g11-chapter-13-electromagnetism.html'
]

for fname in lessons:
    fpath = os.path.join(LESSONS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    m_phases = re.search(r'const PHASES = \[(.*?)\];', html, re.DOTALL)
    m_kinds = re.search(r'const KINDS = \{(.*?)\};', html, re.DOTALL)
    
    print(f"=== {fname} ===")
    if m_phases:
        # extract phase names
        p_names = re.findall(r"en:'([^']+)'", m_phases.group(1))
        print("  Phases:", p_names)
    if m_kinds:
        k_keys = re.findall(r"([a-z0-9_]+):\{", m_kinds.group(1))
        print("  Kinds keys:", k_keys)
