# -*- coding: utf-8 -*-
"""Voice lab for the Raja and Chittu story voices.

  python tools/voice_lab.py lines                      rebuild site/static/audio/story/lines.json from the lesson pages
  python tools/voice_lab.py sample                     audition every Tamil neural voice on real story lines (needs internet)
  python tools/voice_lab.py render --raja ta-IN-ValluvarNeural --chittu ta-IN-PallaviNeural --rate +8%
                                                       re-record all story lines with the voices you chose (needs internet)
  python tools/voice_lab.py import <folder>            turn real recordings (from /static/record.html) into app audio

Needs:  pip install edge-tts imageio-ffmpeg      (edge-tts only for sample / render)
"""
import argparse, asyncio, glob, html, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
LESSONS = os.path.join(ROOT, 'site', 'lessons')
AUDIO = os.path.join(ROOT, 'site', 'static', 'audio', 'story')
OUT = os.path.join(HERE, 'voice_lab_out')
NAMES = {'R': 'Raja', 'C': 'Chittu'}


# ------------------------------------------------------------------ story data (read from the lesson pages)
def load_stories():
    stories = {}
    for f in sorted(glob.glob(os.path.join(LESSONS, '*.html'))):
        s = open(f, encoding='utf-8').read()
        m = re.search(r"const STORY = (\{.*?\});\s*\n\s*const KEY = 'scx_story_(\w+)'", s, re.S)
        if not m:
            continue
        data = json.loads(m.group(1))
        stories[m.group(2)] = {'title': data['title'], 'lines': [{'who': l[0], 'en': l[2], 'ta': l[3]} for l in data['lines']]}
    return stories


# ------------------------------------------------------------------ make symbols and units sayable
def speech(t, lang):
    if lang == 'ta':
        t = t.replace('F = ma', 'எஃப் சமம் எம் ஏ')
        for pat, rep in [(r'(\d)\s*m/s²', r'\1 மீட்டர் பெர் செகண்ட் ஸ்கொயர்'), (r'(\d)\s*m/s', r'\1 மீட்டர் பெர் செகண்ட்'),
                         (r'(\d)\s*N m\b', r'\1 நியூட்டன் மீட்டர்'), (r'(\d)\s*N\b', r'\1 நியூட்டன்'), (r'(\d)\s*kg\b', r'\1 கிலோகிராம்'),
                         (r'(\d)\s*m\b', r'\1 மீட்டர்'), (r'(\d)\s*s\b', r'\1 விநாடி')]:
            t = re.sub(pat, rep, t)
        t = t.replace('F₁', 'எஃப் ஒன்று').replace('F₂', 'எஃப் இரண்டு')
        for a, b in [('×', ' பெருக்கல் '), ('÷', ' வகுத்தல் '), ('−', ' கழித்தல் '), ('+', ' கூட்டல் '), ('=', ' சமம் ')]:
            t = t.replace(a, b)
        for pat, rep in [(r'\bW\b', 'டபிள்யூ'), (r'\bm\b', 'எம்'), (r'\bg\b', 'ஜி'), (r'\bd\b', 'டி'), (r'\bN\b', 'நியூட்டன்')]:
            t = re.sub(pat, rep, t)
        t = re.sub(r'\s*\([^)]*[A-Za-z][^)]*\)', ' ', t)           # English glosses such as (see-saw)
    else:
        for pat, rep in [(r'(\d)\s*m/s²', r'\1 metres per second squared'), (r'(\d)\s*m/s', r'\1 metres per second'),
                         (r'(\d)\s*N m\b', r'\1 newton metres'), (r'(\d)\s*N\b', r'\1 newtons'), (r'(\d)\s*kg\b', r'\1 kilograms'),
                         (r'(\d)\s*m\b', r'\1 metres'), (r'(\d)\s*s\b', r'\1 seconds')]:
            t = re.sub(pat, rep, t)
        t = t.replace('F = ma', 'F equals m a').replace('F₁', 'F one').replace('F₂', 'F two')
        for a, b in [('×', ' times '), ('÷', ' divided by '), ('−', ' minus '), ('+', ' plus '), ('=', ' equals ')]:
            t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


# ------------------------------------------------------------------ edge-tts
async def synth(text, voice, path, rate='+0%', pitch='+0Hz'):
    import edge_tts
    last = None
    for _ in range(3):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(path)
            if os.path.getsize(path) > 800:
                return
        except Exception as e:                                       # network hiccup: try again
            last = e
            await asyncio.sleep(1.5)
    raise RuntimeError('could not synthesise "%s": %s' % (text[:40], last))


def cmd_lines(_):
    st = load_stories()
    os.makedirs(AUDIO, exist_ok=True)
    p = os.path.join(AUDIO, 'lines.json')
    json.dump(st, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', p, '(%d stories, %d lines)' % (len(st), sum(len(v['lines']) for v in st.values())))


def cmd_sample(a):
    import edge_tts
    os.makedirs(OUT, exist_ok=True)

    async def go():
        voices = [v for v in await edge_tts.list_voices() if v['Locale'].startswith('ta-')]
        st = load_stories()
        samples = [('Raja line', st['c11']['lines'][0]['ta']), ('Chittu line', st['c11']['lines'][3]['ta']), ('Tamil Nadu style', st['c5']['lines'][1]['ta'])]
        rows = []
        for v in voices:
            for rate in ('+0%', '+10%'):
                for k, (label, text) in enumerate(samples):
                    f = 'sample_%s_%s_%d.mp3' % (v['ShortName'], rate.replace('+', 'p').replace('%', ''), k)
                    await synth(speech(text, 'ta'), v['ShortName'], os.path.join(OUT, f), rate=rate)
                    rows.append((v['ShortName'], v['Gender'], v['Locale'], rate, label, f))
                    print('.', end='', flush=True)
        page = ['<!doctype html><meta charset="utf-8"><title>Tamil voice lab</title><style>body{font-family:system-ui;margin:20px;max-width:900px}td,th{padding:6px 10px;border-bottom:1px solid #ddd;text-align:left}</style>',
                '<h1>Tamil voice lab</h1><p>Listen with your eyes closed. Pick the voice that sounds like someone talking to you, not reading the news. '
                'Then run <code>python tools/voice_lab.py render --raja &lt;voice&gt; --chittu &lt;voice&gt; --rate +8%</code>.</p><table><tr><th>Voice</th><th>Gender</th><th>Region</th><th>Speed</th><th>Sentence</th><th>Play</th></tr>']
        for r in rows:
            page.append('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td><audio controls preload="none" src="%s"></audio></td></tr>' % tuple(html.escape(x) for x in r))
        page.append('</table>')
        open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write('\n'.join(page))
        print('\nopen', os.path.join(OUT, 'index.html'))
    asyncio.run(go())


def cmd_render(a):
    st = load_stories()
    voices = {'R': a.raja, 'C': a.chittu}
    pitch = {'R': a.pitch_raja, 'C': a.pitch_chittu}
    backup = os.path.join(OUT, 'backup')

    async def go():
        n = 0
        for sid, story in st.items():
            if a.only and sid not in a.only.split(','):
                continue
            folder = os.path.join(AUDIO, sid) if a.lang == 'ta' else os.path.join(AUDIO, sid, 'en')
            os.makedirs(folder, exist_ok=True)
            for i, line in enumerate(story['lines']):
                dst = os.path.join(folder, 'line%02d.mp3' % i)
                if os.path.exists(dst):
                    os.makedirs(os.path.join(backup, sid), exist_ok=True)
                    shutil.copy2(dst, os.path.join(backup, sid, ('en_' if a.lang == 'en' else '') + 'line%02d.mp3' % i))
                await synth(speech(line[a.lang], a.lang), voices[line['who']], dst, rate=a.rate, pitch=pitch[line['who']])
                n += 1
                print('%s line%02d (%s) ok' % (sid, i, NAMES[line['who']]))
        print('rendered %d lines. Previous files were copied to %s' % (n, backup))
    asyncio.run(go())


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which('ffmpeg') or sys.exit('ffmpeg not found: pip install imageio-ffmpeg')


def cmd_import(a):
    """Recordings made on /static/record.html are named  <story>_<lang>_<NN>.<ext>  (for example c5_ta_03.webm)."""
    files = [f for f in glob.glob(os.path.join(a.folder, '*')) if re.match(r'^(\w+)_(ta|en)_(\d\d)\.\w+$', os.path.basename(f))]
    if not files:
        sys.exit('no files like c5_ta_03.webm in ' + a.folder)
    out = a.out or AUDIO
    for f in sorted(files):
        sid, lang, nn = re.match(r'^(\w+)_(ta|en)_(\d\d)\.\w+$', os.path.basename(f)).groups()
        folder = os.path.join(out, sid) if lang == 'ta' else os.path.join(out, sid, 'en')
        os.makedirs(folder, exist_ok=True)
        dst = os.path.join(folder, 'line%s.mp3' % nn)
        # trim silence at both ends, even out the loudness, mono 44.1 kHz mp3
        flt = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-18:TP=-2'
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', f, '-af', flt, '-ac', '1', '-ar', '44100', '-b:a', '64k', dst], check=True)
        print('imported', os.path.basename(f), '->', os.path.relpath(dst, ROOT))
    print('done. Reload the lesson, tap Voices once to "Recorded voices".')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('lines').set_defaults(fn=cmd_lines)
    sub.add_parser('sample').set_defaults(fn=cmd_sample)
    r = sub.add_parser('render'); r.set_defaults(fn=cmd_render)
    r.add_argument('--lang', choices=['ta', 'en'], default='ta')
    r.add_argument('--raja', required=True, help='voice for Raja, e.g. ta-IN-ValluvarNeural')
    r.add_argument('--chittu', required=True, help='voice for Chittu, e.g. ta-IN-PallaviNeural')
    r.add_argument('--rate', default='+8%'); r.add_argument('--pitch-raja', default='+0Hz'); r.add_argument('--pitch-chittu', default='+0Hz')
    r.add_argument('--only', default='', help='comma separated story ids, e.g. c5,u2')
    i = sub.add_parser('import'); i.set_defaults(fn=cmd_import)
    i.add_argument('folder'); i.add_argument('--out', default='')
    a = p.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
