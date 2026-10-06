import os, re, sys
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

results = []

for fname in lessons:
    fpath = os.path.join(LESSONS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Watch animation scope
    wm = re.search(r'<section\b[^>]*id="watch"[^>]*>(.*?)</section>', html, re.DOTALL)
    watch_title = ""
    watch_caps = []
    if wm:
        h2 = re.search(r'<h2[^>]*>(.*?)</h2>', wm.group(1))
        if h2: watch_title = re.sub(r'<[^>]+>', '', h2.group(1)).strip()
        caps = re.findall(r'en:\s*["\']([^"\']+)["\']', wm.group(1))
        watch_caps = caps[:3]

    # 2. Lab simulation scope
    lm = re.search(r'<section\b[^>]*id="lab"[^>]*>(.*?)</section>', html, re.DOTALL)
    lab_title = ""
    if lm:
        h2 = re.search(r'<h2[^>]*>(.*?)</h2>', lm.group(1))
        if h2: lab_title = re.sub(r'<[^>]+>', '', h2.group(1)).strip()

    # 3. Notes subtopics
    nm = re.search(r'<section\b[^>]*id="notes"[^>]*>(.*?)</section>', html, re.DOTALL)
    cards = []
    if nm:
        card_matches = re.findall(r'<div class="card[^"]*"[^>]*data-idx="(\d+)"[^>]*>(.*?)</div>\s*(?=<div class="card|<div class="notes-grid"|</div>\s*</div>|$)', nm.group(1), re.DOTALL)
        for idx, chtml in card_matches:
            h3 = re.search(r'<h3[^>]*>(.*?)</h3>', chtml)
            h3_text = re.sub(r'<[^>]+>', '', h3.group(1)).strip() if h3 else 'Subtopic'
            # Check if this subtopic has svg figures, animations, formula-box, worked examples
            has_svg = len(re.findall(r'<svg\b', chtml))
            has_formula = bool(re.search(r'class="formula-box"', chtml))
            has_worked = len(re.findall(r'class="worked"', chtml))
            cards.append({
                'idx': idx,
                'heading': h3_text,
                'svg_count': has_svg,
                'has_formula': has_formula,
                'worked_count': has_worked
            })

    results.append({
        'file': fname,
        'watch_title': watch_title,
        'watch_scenes_count': len(watch_caps),
        'lab_title': lab_title,
        'subtopic_count': len(cards),
        'subtopics': cards
    })

for r in results:
    print(f"\n=======================================================")
    print(f"FILE: {r['file']}")
    print(f"WATCH ANIMATION: {r['watch_title']}")
    print(f"LAB SIMULATION:  {r['lab_title']}")
    print(f"TOTAL NOTES SUBTOPICS: {r['subtopic_count']}")
    for s in r['subtopics']:
        print(f"   [{s['idx']}] {s['heading'][:50]:50} | SVGs: {s['svg_count']} | Formula: {s['has_formula']} | Worked: {s['worked_count']}")
