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

data = []

for fname in lessons:
    fpath = os.path.join(LESSONS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Step IDs in order of <section id="...">
    secs = re.findall(r'<section\b[^>]*id="([^"]+)"', html)
    
    # Navlinks
    nav = re.findall(r'<a\b[^>]*href="#([^"]+)"[^>]*>(.*?)</a>', re.search(r'<div class="navlinks"[^>]*>(.*?)</div>', html, re.DOTALL).group(1))
    nav_ids = [n[0] for n in nav]
    
    # Section titles (from section-label or h2)
    sec_titles = {}
    for s in secs:
        sm = re.search(r'<section\b[^>]*id="' + s + r'"[^>]*>(.*?)</section>', html, re.DOTALL)
        if sm:
            h2 = re.search(r'<h2[^>]*>(.*?)</h2>', sm.group(1))
            sub = re.search(r'<div class="sub"[^>]*>(.*?)</div>', sm.group(1))
            sec_titles[s] = {
                'title': re.sub(r'<[^>]+>', '', h2.group(1)).strip() if h2 else '',
                'sub': re.sub(r'<[^>]+>', '', sub.group(1)).strip() if sub else ''
            }
            
    # Check JS STEPS definition if any
    steps_js = re.findall(r'id:\s*[\'"]([^\'"]+)[\'"]', html)
    
    # Check animation details in watch
    watch_anim_type = "none"
    if 'watch' in secs:
        wm = re.search(r'<section\b[^>]*id="watch"[^>]*>(.*?)</section>', html, re.DOTALL)
        if wm:
            if '<canvas' in wm.group(1): watch_anim_type = "canvas"
            elif '<svg' in wm.group(1): watch_anim_type = "svg"
            
    # Check lab details
    lab_type = "none"
    if 'lab' in secs:
        lm = re.search(r'<section\b[^>]*id="lab"[^>]*>(.*?)</section>', html, re.DOTALL)
        if lm:
            if '<svg' in lm.group(1): lab_type = "svg"

    data.append({
        'file': fname,
        'sections': secs,
        'nav_ids': nav_ids,
        'sec_titles': sec_titles,
        'watch_type': watch_anim_type,
        'lab_type': lab_type
    })

print(f"Total lessons: {len(data)}")
# Check consistency of section IDs
all_sec_patterns = set(tuple(d['sections']) for d in data)
print(f"Unique section sequences across 15 lessons: {len(all_sec_patterns)}")
for idx, p in enumerate(all_sec_patterns):
    matching = [d['file'] for d in data if tuple(d['sections']) == p]
    print(f"\nPattern {idx+1} ({len(matching)} lessons): {list(p)}")
    print(f"Lessons: {matching}")
