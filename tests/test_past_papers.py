# -*- coding: utf-8 -*-
"""Past-paper API validation and real student flows using a disposable SQLite database.

python tests/test_past_papers.py
Uses installed Edge, as the shared browser runtime has no connected browser.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE='http://localhost:8769'
H={'Content-Type':'application/json','X-Requested-With':'stemcloud'}

def check(name, condition):
    assert condition, name
    print('PASS '+name)

def run():
    with tempfile.TemporaryDirectory() as temp:
        env=dict(os.environ,DB_PATH=str(Path(temp)/'test.db'))
        for k in ('DATABASE_URL','POSTGRES_URL','VERCEL'):env.pop(k,None)
        srv=subprocess.Popen([sys.executable,'-m','uvicorn','index:app','--port','8769','--log-level','warning'],cwd=ROOT/'api',env=env)
        try:
            for _ in range(80):
                try:urllib.request.urlopen(BASE+'/healthz',timeout=1);break
                except Exception:time.sleep(.25)
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='msedge',headless=True)
                admin=browser.new_context()
                check('admin setup',admin.request.post(BASE+'/api/signup',headers=H,data=json.dumps(dict(username='ppadmin',password='PastPaper-2468'))).ok)
                for name in ('student_one','student_two'):
                    check('student setup '+name,admin.request.post(BASE+'/api/admin/create-user',headers=H,data=json.dumps(dict(username=name,password='PastPaper-2468'))).ok)
                ctx=browser.new_context(viewport={'width':1280,'height':900})
                ctx.add_init_script("localStorage.setItem('stem_coach_done','1')")
                check('student login',ctx.request.post(BASE+'/api/login',headers=H,data=json.dumps(dict(username='student_one',password='PastPaper-2468'))).ok)
                page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(BASE+'/lessons/past-papers.html')
                page.locator('#pp-list button').first.wait_for()
                check('50 questions available',page.locator('#pp-list button').count()==50)
                page.locator('.pp-skip').focus();page.keyboard.press('Enter')
                check('skip link focuses question',page.evaluate("document.activeElement.id==='pp-question'"))
                page.locator('#pp-list [aria-current=true]').focus();page.keyboard.press('ArrowDown')
                check('question navigation supports keyboard',page.locator('#pp-list [aria-current=true]').get_attribute('data-q')=='ol2015-i-02')
                page.keyboard.press('ArrowUp');page.keyboard.press('Enter')
                check('bank source provenance',ctx.request.get(BASE+'/lessons/past-papers/2015.json').json()['teacherReviewed'] is False)
                bank=ctx.request.get(BASE+'/lessons/past-papers/2015.json').json()
                check('118 written subparts',sum(len(q.get('parts',[])) for q in bank['questions'])==118)
                page.locator('[name=pp-choice][value="0"]').check();page.locator('#pp-check').click()
                page.wait_for_function("document.querySelector('#pp-status').textContent.includes('Saved to your account')")
                check('MCQ feedback',page.locator('.pp-feedback').inner_text().startswith('Correct on your last attempt'))
                check('attempt persisted',len(ctx.request.get(BASE+'/api/past-papers/state').json()['attempts'])==1)
                page.locator('#pp-bookmark').click();page.wait_for_timeout(250)
                page.locator('#pp-review').select_option('saved')
                check('bookmark filter',page.locator('#pp-list button').count()==1)
                page.locator('#pp-clear').click();page.locator('#pp-subject').select_option('chemistry')
                check('subject filter',page.locator('#pp-list button').count()>0 and page.locator('#pp-list button').count()<50)
                page.locator('#pp-clear').click();page.locator('#pp-type').select_option('written')
                page.locator('#pp-answer-0').fill('Positive phototropism; light is the stimulus.')
                page.locator('#pp-save-written').click();page.wait_for_timeout(250)
                page.locator('#pp-ta').click()
                check('Tamil switch preserves written draft',page.locator('#pp-answer-0').input_value().startswith('Positive phototropism'))
                check('Tamil question text', 'கரையோர' in page.locator('#pp-question').inner_text())
                page.locator('#pp-en').click()
                page.reload();page.locator('#pp-type').select_option('written');page.locator('#pp-answer-0').wait_for()
                check('draft survives reload',page.locator('#pp-answer-0').input_value().startswith('Positive phototropism'))

                # Validate server scoring and strict input handling, including idempotent retries.
                event=dict(id='test_event_00000001',question='ol2015-i-02',choice=0,mode='practice',correct=True)
                r=ctx.request.post(BASE+'/api/past-papers/attempts',headers=H,data=json.dumps(dict(events=[event])))
                check('server ignores forged correctness',r.ok and r.json()['attempts'][0]['result']['correct'] is False)
                again=ctx.request.post(BASE+'/api/past-papers/attempts',headers=H,data=json.dumps(dict(events=[event])))
                check('retry uses same recorded timestamp',again.json()['attempts'][0]['at']==r.json()['attempts'][0]['at'])
                event['choice']=2
                check('reused ID cannot replace an attempt',ctx.request.post(BASE+'/api/past-papers/attempts',headers=H,data=json.dumps(dict(events=[event]))).status==409)
                for bad in (True,4,-1,'1'):
                    event.update(id='test_bad_'+str(bad).replace('-','x')+'_000000000',choice=bad)
                    check('invalid choice rejected '+str(bad),ctx.request.post(BASE+'/api/past-papers/attempts',headers=H,data=json.dumps(dict(events=[event]))).status==400)
                check('CSRF header required',ctx.request.put(BASE+'/api/past-papers/bookmark',data=json.dumps(dict(question='ol2015-i-01',saved=True))).status==403)
                other=browser.new_context();other.request.post(BASE+'/api/login',headers=H,data=json.dumps(dict(username='student_two',password='PastPaper-2468')))
                check('other account cannot see attempts',other.request.get(BASE+'/api/past-papers/state').json()=={'attempts':[],'bookmarks':[]})
                anon=browser.new_context()
                check('anonymous API rejected',anon.request.get(BASE+'/api/past-papers/state').status==401)
                check('anonymous bank gated',anon.request.get(BASE+'/lessons/past-papers/2015.json',max_redirects=0).status==401)
                check('past papers do not award XP',not ctx.request.get(BASE+'/api/progress').json()['progress'].get('scx_xp_total'))

                # A second device restores submitted written responses from account storage.
                second=browser.new_context();second.add_init_script("localStorage.setItem('stem_coach_done','1')")
                second.request.post(BASE+'/api/login',headers=H,data=json.dumps(dict(username='student_one',password='PastPaper-2468')))
                sp=second.new_page();sp.goto(BASE+'/lessons/past-papers.html');sp.locator('#pp-list button').first.wait_for()
                sp.wait_for_function("document.querySelector('#pp-status').textContent.includes('Saved to your account')")
                sp.locator('#pp-type').select_option('written')
                check('written response restores on second device',sp.locator('#pp-answer-0').input_value().startswith('Positive phototropism'))
                second.close()

                page.locator('#pp-clear').click();page.locator('#pp-exam-i').click();page.locator('#pp-confirm [value=ok]').click()
                page.locator('#pp-exam-bar').wait_for()
                check('timed MCQ hides explanations',page.locator('.pp-feedback').count()==0)
                page.locator('[name=pp-choice][value="0"]').check()
                before=page.locator('#pp-clock').inner_text();page.reload();page.locator('#pp-exam-bar').wait_for()
                check('exam responses survive reload',page.locator('[name=pp-choice][value="0"]').is_checked())
                check('exam deadline persists',page.locator('#pp-clock').inner_text()<=before)
                page.locator('#pp-submit').click();page.locator('#pp-confirm [value=ok]').click()
                page.locator('#pp-result').wait_for()
                check('unanswered MCQs score zero', '1/40' in page.locator('#pp-result').inner_text())
                page.wait_for_function("document.querySelector('#pp-status').textContent.includes('Saved to your account')")
                page.locator('#pp-exam-ii').click();page.locator('#pp-confirm [value=ok]').click()
                page.locator('#pp-submit').click()
                check('written selection rule enforced','Choose one Section B' in page.locator('#pp-status').inner_text())
                for q in ('ol2015-ii-05','ol2015-ii-07','ol2015-ii-09'):
                    page.locator('#pp-list [data-q="'+q+'"]').click();page.locator('#pp-choose').click()
                page.locator('#pp-submit').click();page.locator('#pp-confirm [value=ok]').click()
                check('written paper remains ungraded','7 written questions saved' in page.locator('#pp-result').inner_text())
                page.locator('#pp-type').select_option('written')
                check('blank timed submission preserves previous written response',page.locator('#pp-answer-0').input_value().startswith('Positive phototropism'))

                # Mark a retry offline, then ensure its exact event is replayed once online.
                page.locator('#pp-clear').click()
                page.wait_for_timeout(500);ctx.set_offline(True)
                page.locator('[name=pp-choice][value="1"]').check();page.locator('#pp-check').click()
                check('offline feedback available',page.locator('.pp-feedback').count()==1)
                page.wait_for_function("document.querySelector('#pp-status').textContent.includes('sync is pending')")
                ctx.set_offline(False);page.locator('#pp-status button').click()
                page.wait_for_function("document.querySelector('#pp-status').textContent.includes('Saved to your account')")
                check('offline attempt synced',ctx.request.get(BASE+'/api/past-papers/state').json()['attempts'][-1]['result']['choice']==1)
                # Reload once under service-worker control, then reopen the bank offline.
                page.wait_for_function('navigator.serviceWorker.controller !== null')
                page.reload();page.locator('#pp-list button').first.wait_for()
                page.locator('#pp-list [data-q="ol2015-i-28"]').click()
                page.locator('figure img').wait_for()
                page.wait_for_function("document.querySelector('figure img').naturalWidth>0")
                page.wait_for_function("caches.keys().then(async ks=>{let c=await caches.open(ks.find(k=>k.includes('pages')));return !!(await c.match('/lessons/past-papers/2015.json')) && !!(await c.match('/lessons/past-papers/catalog.json')) && !!(await c.match('/lessons/past-papers/2015/mcq-28.jpg'));})")
                ctx.set_offline(True);page.reload();page.locator('#pp-list button').first.wait_for()
                check('cached question bank reopens offline',page.locator('#pp-list button').count()==50)
                page.locator('#pp-list [data-q="ol2015-i-28"]').click()
                page.wait_for_function("document.querySelector('figure img').naturalWidth>0")
                check('visited diagram reopens offline',page.locator('figure img').is_visible())
                ctx.set_offline(False);page.reload();page.locator('#pp-list button').first.wait_for()
                # Return to unfiltered view for layout checks.
                page.set_viewport_size({'width':375,'height':812})
                page.locator('#pp-filter-panel summary').click()
                check('mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                page.locator('#pp-ta').click()
                check('Tamil mobile has no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                out=ROOT/'tmp'/'past-papers-qa';out.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(out/'mobile-tamil.png'),full_page=True)
                page.locator('#pp-en').click();page.set_viewport_size({'width':1280,'height':900})
                page.screenshot(path=str(out/'desktop.png'),full_page=True)
                check('no browser script errors',not errors)
                page.goto(BASE+'/lessons/g11-chapter-04-waves.html')
                check('lesson topic practice link',page.locator('#stem-past-link').get_attribute('href').endswith('?lesson=g11-chapter-04-waves'))
                page.goto(BASE+page.locator('#stem-past-link').get_attribute('href'));page.locator('#pp-list button').first.wait_for()
                check('lesson filter applied',0<page.locator('#pp-list button').count()<50)
                browser.close()
        finally:
            srv.terminate();srv.wait(timeout=10)

if __name__=='__main__':run()
