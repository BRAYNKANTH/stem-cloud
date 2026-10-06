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

for fname in lessons:
    fpath = os.path.join(LESSONS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()
    sections = re.findall(r'<section\b[^>]*id="([^"]+)"[^>]*>', html)
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', html)
    h1_txt = re.sub(r'<[^>]+>', '', h1.group(1)).strip() if h1 else ''
    
    # Check what is after story
    story_idx = sections.index('story') if 'story' in sections else -1
    after_story = sections[story_idx + 1] if story_idx >= 0 and story_idx + 1 < len(sections) else 'none'
    
    # check where notes is
    notes_idx = sections.index('notes') if 'notes' in sections else -1
    
    print(f"{fname[:30]:30} | {h1_txt[:25]:25} | secs={len(sections)} | after_story={after_story} | notes_at_pos={notes_idx}")
