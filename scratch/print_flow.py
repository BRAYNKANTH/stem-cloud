import re, sys
sys.stdout.reconfigure(encoding='utf-8')

html = open('site/lessons/chapter-04-newtons-laws.html', encoding='utf-8').read()
sections = re.findall(r'<section\b[^>]*id="([^"]+)"', html)
for i, s in enumerate(sections):
    sec_match = re.search(r'<section\b[^>]*id="' + s + r'"[^>]*>(.*?)</section>', html, re.DOTALL)
    sec_content = sec_match.group(1) if sec_match else ''
    h = re.search(r'<h[23][^>]*>(.*?)</h[23]>', sec_content)
    htxt = re.sub(r'<[^>]+>', '', h.group(1)).strip() if h else ''
    print(f"{i:2d}. #{s:15} | {htxt}")
