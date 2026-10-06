import os, re, json
from html.parser import HTMLParser

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

    # Extract Title
    h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.IGNORECASE)
    title = re.sub(r'<[^>]+>', '', h1_match.group(1)).strip() if h1_match else 'No H1'
    
    # Extract fw_phases
    # <div class="fw-phase" ...> <h4>...</h4> ... <a class="fw-step" href="#..." ...>...</a>
    phases = []
    phase_blocks = re.findall(r'<div class="fw-phase"[^>]*>(.*?)</div>\s*(?=<div class="fw-phase"|</div>\s*</div>|$)', html, re.DOTALL)
    for pb in phase_blocks:
        h4_m = re.search(r'<h4[^>]*>(.*?)</h4>', pb, re.DOTALL)
        pname = re.sub(r'<[^>]+>', '', h4_m.group(1)).strip() if h4_m else 'Phase'
        step_matches = re.findall(r'<a class="fw-step"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', pb, re.DOTALL)
        steps = []
        for href, stext in step_matches:
            steps.append({'href': href, 'text': re.sub(r'<[^>]+>', ' ', stext).strip()})
        phases.append({'phase': pname, 'steps': steps})

    step_ids = [s['href'].lstrip('#') for p in phases for s in p['steps']]

    # Check existence of key IDs
    has_story = 'story' in step_ids
    has_watch = 'watch' in step_ids
    has_lab = 'lab' in step_ids
    has_notes = 'notes' in step_ids
    has_quiz = 'quiz' in step_ids

    # Story intro / script analysis
    story_script_match = re.search(r'id="so_script"[^>]*>(.*?)</div>', html, re.DOTALL)
    story_lines = len(re.findall(r'<div\b', story_script_match.group(1))) if story_script_match else 0
    
    # Story prompt or situation
    story_hook = ""
    hook_m = re.search(r'<div class="so-hook"[^>]*>(.*?)</div>', html, re.DOTALL)
    if hook_m: story_hook = re.sub(r'<[^>]+>', '', hook_m.group(1)).strip()

    # Notes headings: find all headings inside id="notes"
    notes_match = re.search(r'<section\b[^>]*id="notes"[^>]*>(.*?)</section>', html, re.DOTALL)
    notes_headings = []
    if notes_match:
        headings = re.findall(r'<h[234][^>]*>(.*?)</h[234]>', notes_match.group(1), re.DOTALL)
        notes_headings = [re.sub(r'<[^>]+>', '', h).strip() for h in headings]

    # Watch animation analysis: check if SVG canvas or interactive loop
    watch_match = re.search(r'<section\b[^>]*id="watch"[^>]*>(.*?)</section>', html, re.DOTALL)
    watch_has_svg = bool(re.search(r'<svg\b', watch_match.group(1))) if watch_match else False
    watch_has_canvas = bool(re.search(r'<canvas\b', watch_match.group(1))) if watch_match else False
    watch_has_prediction = 'fw_pred' in (watch_match.group(1) if watch_match else '')

    # Lab simulation analysis:
    lab_match = re.search(r'<section\b[^>]*id="lab"[^>]*>(.*?)</section>', html, re.DOTALL)
    lab_sliders = len(re.findall(r'<input\b[^>]*type="range"', lab_match.group(1))) if lab_match else 0
    lab_missions = len(re.findall(r'class="ls-m"', lab_match.group(1))) if lab_match else 0

    results.append({
        'file': fname,
        'title': title,
        'step_count': len(step_ids),
        'step_ids': step_ids,
        'phases': [{p['phase']: [s['href'] for s in p['steps']]} for p in phases],
        'has_story': has_story,
        'story_lines': story_lines,
        'has_watch': has_watch,
        'watch_has_prediction': watch_has_prediction,
        'has_lab': has_lab,
        'lab_sliders': lab_sliders,
        'lab_missions': lab_missions,
        'has_notes': has_notes,
        'notes_headings_count': len(notes_headings),
        'notes_sample_headings': notes_headings[:4]
    })

print(json.dumps(results, indent=2))
