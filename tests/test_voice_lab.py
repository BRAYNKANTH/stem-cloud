# -*- coding: utf-8 -*-
"""Checks for the voice tools: story data, the recorder page (fake microphone), importing recordings, re-rendering voices (network faked).

    python tests/test_voice_lab.py
"""
import importlib.util, json, os, subprocess, sys, tempfile, time, types, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8768
BASE = 'http://localhost:%d' % PORT
fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)


def load_lab():
    spec = importlib.util.spec_from_file_location('voice_lab', os.path.join(ROOT, 'tools', 'voice_lab.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


def run():
    lab = load_lab()
    tmp = tempfile.mkdtemp()

    # ---------------------------------------------------------------- story data and speech normaliser
    st = lab.load_stories()
    check('all six stories are read from the lesson pages', sorted(st) == ['c11', 'c12', 'c4', 'c5', 'c9', 'u2'], sorted(st))
    check('every story has 9 lines, Raja first', all(len(v['lines']) == 9 and v['lines'][0]['who'] == 'R' for v in st.values()))
    lines_json = json.load(open(os.path.join(lab.AUDIO, 'lines.json'), encoding='utf-8'))
    check('lines.json (used by the recorder) matches the lesson pages', lines_json == st)
    check('Tamil speech turns units into words and drops English glosses', 'நியூட்டன்' in lab.speech('சீசா (see-saw) 300 N', 'ta') and 'see-saw' not in lab.speech('சீசா (see-saw) 300 N', 'ta'))

    # ---------------------------------------------------------------- render (network faked)
    import edge_tts
    made = []

    class Fake:
        def __init__(self, text, voice, rate='+0%', pitch='+0Hz'):
            self.t, self.v, self.r, self.p = text, voice, rate, pitch

        async def save(self, path):
            made.append((self.v, self.r))
            open(path, 'wb').write(b'ID3' + b'\0' * 2000)
    real = edge_tts.Communicate
    edge_tts.Communicate = Fake
    lab.AUDIO = os.path.join(tmp, 'audio'); lab.OUT = os.path.join(tmp, 'out')
    args = types.SimpleNamespace(lang='ta', raja='ta-IN-ValluvarNeural', chittu='ta-IN-PallaviNeural', rate='+8%', pitch_raja='+0Hz', pitch_chittu='+0Hz', only='c5')
    lab.cmd_render(args)
    edge_tts.Communicate = real
    files = sorted(os.listdir(os.path.join(lab.AUDIO, 'c5')))
    check('render writes line00..line08 for the chosen story', files == ['line%02d.mp3' % i for i in range(9)], files)
    check('Raja and Chittu get their own voices at the chosen speed', {m[0] for m in made} == {'ta-IN-ValluvarNeural', 'ta-IN-PallaviNeural'} and {m[1] for m in made} == {'+8%'}, set(made))

    # ---------------------------------------------------------------- recorder page -> import
    env = dict(os.environ, DB_PATH=os.path.join(tmp, 't.db'))
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'], cwd=os.path.join(ROOT, 'api'), env=env)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1); break
            except Exception:
                time.sleep(0.3)
        dl = os.path.join(tmp, 'downloads'); os.makedirs(dl)
        with sync_playwright() as p:
            b = p.chromium.launch(channel='msedge', headless=True, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
            ctx = b.new_context(viewport={'width': 393, 'height': 760}, permissions=['microphone'], accept_downloads=True)
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
            pg.goto(BASE + '/static/record.html', wait_until='domcontentloaded'); pg.wait_for_selector('.line')
            check('recorder lists all 9 lines of the first story', pg.locator('.line').count() == 9, pg.locator('.line').count())
            pg.select_option('#story', 'c5'); pg.wait_for_timeout(200)
            pg.click('#l0 [data-act=rec]'); pg.wait_for_timeout(1600); pg.click('#l0 [data-act=rec]'); pg.wait_for_timeout(800)
            check('a line can be recorded and is marked done', 'done' in pg.get_attribute('#l0', 'class') and not pg.is_disabled('#l0 [data-act=save]'))
            pg.click('#l1 [data-act=rec]'); pg.wait_for_timeout(1200); pg.click('#l1 [data-act=rec]'); pg.wait_for_timeout(800)
            with pg.expect_download() as d0:
                pg.click('#l0 [data-act=save]')
            f0 = d0.value; f0.save_as(os.path.join(dl, f0.suggested_filename))
            check('saved file is named for the story, language and line', f0.suggested_filename.startswith('c5_ta_00.'), f0.suggested_filename)
            pg.select_option('#lang', 'en'); pg.wait_for_timeout(200)
            check('switching to English shows the English sentences', 'Look Chittu' in pg.inner_text('#l0 .say'), pg.inner_text('#l0 .say')[:50])
            pg.select_option('#lang', 'ta'); pg.wait_for_timeout(200)
            with pg.expect_download() as d1:
                pg.click('#l1 [data-act=save]')
            f1 = d1.value; f1.save_as(os.path.join(dl, f1.suggested_filename))
            check('no script errors on the recorder page', not errs, errs)
            b.close()
        out = os.path.join(tmp, 'app_audio')
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'voice_lab.py'), 'import', dl, '--out', out], capture_output=True, text=True, encoding='utf-8')
        check('import converts the recordings', r.returncode == 0, (r.stdout + r.stderr)[-300:])
        mp3 = os.path.join(out, 'c5', 'line00.mp3')
        check('the Tamil recording becomes c5/line00.mp3', os.path.exists(mp3) and os.path.getsize(mp3) > 1500, os.path.exists(mp3))
        head = open(mp3, 'rb').read(3) if os.path.exists(mp3) else b''
        check('it is a real mp3 (phones and iPhones can play it)', head == b'ID3' or head[:1] == b'\xff', head)
    finally:
        srv.terminate()
        try:
            srv.wait(8)
        except Exception:
            srv.kill()


if __name__ == '__main__':
    run()
    print('\n%s' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails)))
    sys.exit(1 if fails else 0)
