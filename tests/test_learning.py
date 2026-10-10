"""Browser regression checks for beginner paths and all small-phone lesson steps."""
import json, os, sys, tempfile, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from test_player import LESSONS, STUB
PORT=8769;BASE='http://localhost:%s'%PORT

def run():
    with tempfile.TemporaryDirectory() as tmp:
        env=dict(os.environ, DB_PATH=str(Path(tmp)/'audit.db'))
        for k in ('DATABASE_URL','POSTGRES_URL','VERCEL'):env.pop(k,None)
        server=subprocess.Popen([sys.executable,'-m','uvicorn','index:app','--port',str(PORT),'--log-level','warning'],cwd=str(ROOT/'api'),env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            for _ in range(80):
                try:urllib.request.urlopen(BASE+'/healthz',timeout=1);break
                except Exception:time.sleep(.25)
            with sync_playwright() as p:
                browser=p.chromium.launch(channel='msedge',headless=True)
                ctx=browser.new_context(viewport={'width':393,'height':760},is_mobile=True,has_touch=True)
                headers={'Content-Type':'application/json','X-Requested-With':'stemcloud'}
                ctx.request.post(BASE+'/api/signup',headers=headers,data=json.dumps({'username':'audit_admin','password':'LocalTest-2468'}))
                ctx.request.post(BASE+'/api/admin/create-user',headers=headers,data=json.dumps({'username':'audit_student','password':'LocalTest-2468','role':'student'}))
                ctx.request.post(BASE+'/api/login',headers=headers,data=json.dumps({'username':'audit_student','password':'LocalTest-2468'}))
                ctx.add_init_script(STUB)
                ctx.add_init_script("localStorage.setItem('stem_coach_done','1')")
                page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                widths=[]
                for lesson in LESSONS:
                    page.goto(BASE+'/lessons/'+lesson+'.html',wait_until='domcontentloaded');page.wait_for_timeout(400)
                    assert page.locator('.learning-option').count()==4,lesson+' understanding questions'
                    for width in (320,393):
                        page.set_viewport_size({'width':width,'height':760})
                        for i in range(page.evaluate('StemPlayer.count+2')):
                            page.evaluate('StemPlayer.go(%s)'%i);page.wait_for_timeout(70)
                            w=page.evaluate('[document.documentElement.scrollWidth,document.documentElement.clientWidth]')
                            if w[0]>w[1]+1:
                                offenders=page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&!e.closest('.stem-lightbox')&&e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').map(e=>({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,70),right:Math.round(e.getBoundingClientRect().right)})).slice(0,12)")
                                widths.append((lesson,width,i,w,offenders))
                    page.evaluate('StemPlayer.go(0)');page.locator('[data-route=explore]').click()
                    assert page.evaluate('StemPlayer.count')==2
                    page.evaluate("StemPlayer.go(2)")
                    page.locator('.learning-option[data-question="0"][data-option="1"]').click()
                    assert 'q0' not in page.evaluate("JSON.parse(localStorage.getItem('scx_path_checks_'+StemLearning.id)||'{}')"),'wrong answer marked correct'
                    page.locator('.learning-option[data-question="0"][data-option="0"]').click()
                    page.locator('.learning-option[data-question="1"][data-option="0"]').click()
                    assert page.evaluate('StemLearning.complete()'),lesson
                    page.evaluate('StemPlayer.go(3)');assert page.is_visible('#stem-explore-finish')
                    assert not page.is_visible('#fw_finish')
                    page.locator('[data-study]').click();assert page.evaluate('StemPlayer.count')>=12
                    print('PASS beginner questions and route: '+lesson,flush=True)
                print('WIDTH_FAILURES '+json.dumps(widths,ensure_ascii=False),flush=True)
                assert not errors,errors
                assert not widths,'phone overflow: see WIDTH_FAILURES'
                browser.close()
        finally:
            server.terminate();server.wait(timeout=10)

if __name__=='__main__':run()
