import os, re, json

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

    # Find navlinks
    navlinks_match = re.search(r'<div class="navlinks"[^>]*>(.*?)</div>', html, re.DOTALL)
    nav_hrefs = []
    if navlinks_match:
        nav_hrefs = re.findall(r'href="([^"]+)"', navlinks_match.group(1))

    # Find all sections with IDs in .wrap
    # match <section ... id="..."
    sections = re.findall(r'<section\b[^>]*id="([^"]+)"[^>]*>', html)

    # Check script for phases / STEPS array
    # Look for FW_PHASES or similar in scripts
    phases_script = []
    # search for phases data structure in js
    phase_m = re.findall(r'title:\s*["\']([^"\']+)["\'],\s*steps:', html)
    
    # check story title
    story_h = re.search(r'<h2[^>]*data-ta="[^"]*"[^>]*>(.*?)</h2>', html)
    
    # Check what kind of animations are in watch and lab
    # Look for fw_svg, fw_anim, and lab SVG
    has_watch = 'watch' in sections
    has_lab = 'lab' in sections
    has_basics = 'basics' in sections
    has_story = 'story' in sections
    has_notes = 'notes' in sections

    # Check notes headings count and sub-topics
    notes_match = re.search(r'<section\b[^>]*id="notes"[^>]*>(.*?)</section>', html, re.DOTALL)
    notes_titles = []
    if notes_match:
        # Check stepping stones / path-stone or headings
        stones = re.findall(r'class="path-stone[^"]*"[^>]*aria-label="([^"]+)"', notes_match.group(1))
        headings = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', notes_match.group(1), re.DOTALL)
        notes_titles = [re.sub(r'<[^>]+>', '', h).strip() for h in headings[:6]]

    results.append({
        'file': fname,
        'nav_links': nav_hrefs,
        'sections': sections,
        'has_basics': has_basics,
        'has_story': has_story,
        'has_watch': has_watch,
        'has_lab': has_lab,
        'has_notes': has_notes,
        'notes_sample': notes_titles[:4]
    })

print(json.dumps(results, indent=2))
