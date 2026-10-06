import re, sys
sys.stdout.reconfigure(encoding='utf-8')

html = open('site/lessons/unit-02-motion-in-a-straight-line.html', encoding='utf-8').read()
cards = re.findall(r'<div class="card[^"]*"[^>]*data-idx="(\d+)"[^>]*>(.*?)</div>\s*(?=<div class="card|<div class="notes-grid"|</div>\s*</div>|$)', html, re.DOTALL)
print("=== Unit 2 Motion in a Straight Line Subtopics ===")
for i, c in cards:
    h3 = re.search(r'<h3[^>]*>(.*?)</h3>', c)
    txt = re.sub(r'<[^>]+>', '', h3.group(1)).strip() if h3 else 'None'
    print(f"[{i}] {txt}")

# Check watch animation captions in unit 2
wm = re.search(r'<section\b[^>]*id="watch"[^>]*>(.*?)</section>', html, re.DOTALL)
if wm:
    caps = re.findall(r'en:\s*["\']([^"\']+)["\']', wm.group(1))
    print("\n=== Unit 2 Watch Animation Scenes ===")
    for idx, cap in enumerate(caps):
        print(f"  Scene {idx+1}: {cap}")
