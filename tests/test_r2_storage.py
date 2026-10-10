"""R2 routing, login protection and migration verification without cloud access."""
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from api import r2_storage
from tools import r2_media
from fastapi.testclient import TestClient

CREDS={'R2_ACCOUNT_ID':'0'*32,'R2_ACCESS_KEY_ID':'test-access','R2_SECRET_ACCESS_KEY':'test-secret',
       'R2_BUCKET_PRIVATE':'private','R2_BUCKET_PUBLIC':'public','R2_MEDIA_ENABLED':'1'}


class FakeStorage:
    def __init__(self):self.calls=[];self.corrupt=False
    def generate_presigned_url(self,operation,Params,ExpiresIn):
        self.calls.append((operation,Params,ExpiresIn))
        return 'https://'+'0'*32+'.r2.cloudflarestorage.com/private/'+Params['Key']+'?test-signature=temporary'
    def head_object(self,**args):
        return {'ContentLength':3,'Metadata':{'sha256':hashlib.sha256(b'abc').hexdigest()}}
    def get_object(self,**args):return {'Body':io.BytesIO(b'xyz' if self.corrupt else b'abc')}


class StorageTests(unittest.TestCase):
    def test_plan_keeps_application_and_pwa_files_local(self):
        data=r2_media.build_manifest(include_public=True)['assets']
        self.assertTrue(data)
        self.assertTrue(any(k.startswith('static/audio/') for k in data))
        for path,a in data.items():
            self.assertNotIn(Path(path).suffix,{'.html','.js','.css','.json'})
            self.assertFalse(path.startswith(('static/icons/','static/brand/')))
            self.assertEqual(a['visibility'],'private' if path.startswith('lessons/') else 'public')
            self.assertIn(a['sha256'],a['key'])

    def test_private_downloads_use_manifest_and_expire(self):
        fake=FakeStorage()
        with patch.dict(os.environ,CREDS),patch.object(r2_storage,'client',return_value=fake):
            self.assertIsNone(r2_storage.asset_target('lessons/unknown.pdf'))
            target=r2_storage.asset_target('lessons/textbooks/g10-p2-ta.pdf')
            self.assertEqual(target[1],'private')
            self.assertNotIn('test-secret',target[0])
            self.assertEqual(fake.calls[0][0],'get_object')
            self.assertEqual(fake.calls[0][2],3600)
            self.assertEqual(fake.calls[0][1]['Bucket'],'private')

    def test_public_media_stays_local_without_domain(self):
        with patch.dict(os.environ,{**CREDS,'R2_PUBLIC_BASE_URL':''}):
            self.assertIsNone(r2_storage.asset_target('static/audio/story/c4/line01.mp3'))
            key=next(k for k,a in r2_storage.manifest().items() if a['visibility']=='public')
            self.assertIsNone(r2_storage.asset_target(key))
            with patch.dict(os.environ,{'R2_PUBLIC_BASE_URL':'https://files.example.com'}):
                self.assertTrue(r2_storage.asset_target(key)[0].startswith('https://files.example.com/media/'))
            with patch.dict(os.environ,{'R2_PUBLIC_BASE_URL':'http://files.example.com'}):
                with self.assertRaises(ValueError):r2_storage.asset_target(key)

    def test_activation_checks_actual_bytes(self):
        fake=FakeStorage();data={'assets':{'lessons/a.pdf':dict(key='a',visibility='private',size=3,sha256=hashlib.sha256(b'abc').hexdigest())}}
        with patch.dict(os.environ,CREDS):
            r2_media.verify_manifest(fake,data,deep=True)
            fake.corrupt=True
            with self.assertRaises(ValueError):r2_media.verify_manifest(fake,data,deep=True)

    def test_activation_excludes_verified_media_only(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            # an excludeFiles list from an older activation is removed: Vercel rejects values over 256 characters
            (root/'vercel.json').write_text(json.dumps({'functions':{'api/index.py':{'includeFiles':'{site,public}/**','maxDuration':30,'excludeFiles':'{'+','.join(['site/lessons/x%03d.pdf'%i for i in range(30)])+'}'}}}))
            (root/'.vercelignore').write_text('tests/\n')
            data={'assets':{'lessons/a.pdf':{'visibility':'private','key':'a'}}}
            with patch.object(r2_media,'ROOT',root):
                r2_media.activate(data)
            config=json.loads((root/'vercel.json').read_text())
            fn=config['functions']['api/index.py']
            self.assertNotIn('excludeFiles',fn)
            self.assertEqual(fn['includeFiles'],'{site,public}/**')
            self.assertEqual(fn['maxDuration'],30)
            self.assertTrue(all(len(v)<=256 for v in fn.values() if isinstance(v,str)))
            ignore=(root/'.vercelignore').read_text()
            self.assertIn('tests/',ignore)
            self.assertIn('\nsite/lessons/a.pdf\n',ignore)
            self.assertNotIn('*.pdf',ignore)

    def test_api_login_then_redirect_and_local_fallback(self):
        with tempfile.TemporaryDirectory() as temp,patch.dict(os.environ,{'DB_PATH':str(Path(temp)/'test.db'),'DATABASE_URL':'','POSTGRES_URL':'','VERCEL':''}):
            from api import index
            index._ready=False
            fake=FakeStorage()
            with TestClient(index.app) as app,patch.dict(os.environ,CREDS),patch.object(r2_storage,'client',return_value=fake):
                pdf='/lessons/textbooks/g10-p2-ta.pdf'
                self.assertEqual(app.get(pdf,follow_redirects=False).status_code,401)
                self.assertFalse(fake.calls)
                signup=app.post('/api/signup',headers={'X-Requested-With':'stemcloud'},json={'username':'r2_test','password':'R2-test-password-5678'})
                self.assertEqual(signup.status_code,200,signup.text)
                login=app.post('/api/login',headers={'X-Requested-With':'stemcloud'},json={'username':'r2_test','password':'R2-test-password-5678'})
                self.assertEqual(login.status_code,200)
                res=app.get(pdf,follow_redirects=False)
                self.assertEqual(res.status_code,307)
                self.assertIn('no-store',res.headers['cache-control'])
                self.assertIn('temporary',res.headers['location'])
                self.assertEqual(app.get('/lessons/past-papers/2015.json').status_code,200)
                self.assertEqual(app.get('/lessons/unknown.pdf',follow_redirects=False).status_code,404)
                self.assertEqual(app.get('/lessons/%2e%2e/requirements.txt',follow_redirects=False).status_code,404)
                with patch.dict(os.environ,{'R2_MEDIA_ENABLED':'0'}):
                    res=app.get(pdf,headers={'Range':'bytes=0-7'})
                    self.assertEqual(res.status_code,206)
                    self.assertTrue(res.content.startswith(b'%PDF'))
                with patch.dict(os.environ,{'R2_PUBLIC_BASE_URL':'https://files.example.com'}):
                    key=next(k for k,a in r2_storage.manifest().items() if a['visibility']=='public')
                    res=app.get('/'+key,follow_redirects=False)
                    self.assertEqual(res.status_code,307)
                    self.assertTrue(res.headers['location'].startswith('https://files.example.com/media/'))
                with patch.dict(os.environ,{'R2_ACCESS_KEY_ID':''}):
                    res=app.get(pdf,follow_redirects=False)
                    self.assertEqual(res.status_code,503)
                    self.assertNotIn('test-secret',res.text)


if __name__=='__main__':unittest.main()
