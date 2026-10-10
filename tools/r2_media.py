"""Plan, upload, verify and activate whole-app media storage on Cloudflare R2.

Default is read-only. No files are deleted. --activate always verifies uploads first.
Credentials come only from environment variables. See cloudflare-r2.md.
"""
import argparse
import hashlib
import json
import mimetypes
import os
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api import r2_storage

MEDIA = {'.pdf','.jpg','.jpeg','.png','.webp','.gif','.svg','.avif','.mp3','.wav','.ogg','.m4a','.mp4','.webm'}


def build_manifest(include_public=False):
    assets = {}
    folders = [(ROOT/'site/lessons', 'lessons', 'private')]
    if include_public:
        folders.append((ROOT/'public/static', 'static', 'public'))
    for folder, prefix, visibility in folders:
        for path in sorted(folder.rglob('*')):
            if not path.is_file() or path.suffix.lower() not in MEDIA:
                continue
            if folder.resolve() not in path.resolve().parents:
                raise ValueError('Media must stay inside the app folder')
            rel = path.relative_to(folder)
            # PWA icons and branding are tiny and need to remain in the app shell.
            if prefix == 'static' and rel.parts[0] in ('icons','brand'):
                continue
            logical = prefix + '/' + rel.as_posix()
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            assets[logical] = dict(key='media/'+sha+'/'+logical, visibility=visibility,
                sha256=sha, size=path.stat().st_size,
                contentType=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
    return dict(schemaVersion=1, assets=assets)


def local_path(logical):
    prefix, rel = logical.split('/',1)
    base = ROOT/('site/lessons' if prefix=='lessons' else 'public/static')
    return base/rel


def bucket_for(asset):
    name = 'R2_BUCKET_PRIVATE' if asset['visibility']=='private' else 'R2_BUCKET_PUBLIC'
    bucket = os.environ.get(name, '').strip()
    if not bucket:
        raise ValueError(name+' must be configured')
    return bucket


def verify_manifest(s3, data, deep=False):
    for logical, asset in data['assets'].items():
        head = s3.head_object(Bucket=bucket_for(asset), Key=asset['key'])
        if head['ContentLength'] != asset['size'] or head.get('Metadata',{}).get('sha256') != asset['sha256']:
            raise ValueError('Remote checksum/size mismatch: '+logical)
        if deep:
            body=s3.get_object(Bucket=bucket_for(asset),Key=asset['key'])['Body']
            sha=hashlib.sha256()
            try:
                for chunk in iter(lambda:body.read(1024*1024),b''):sha.update(chunk)
            finally:body.close()
            if sha.hexdigest()!=asset['sha256']:raise ValueError('Remote file bytes do not match: '+logical)


def configure_cors(s3, data, origins):
    if not origins:raise ValueError('Provide at least one --origin for browser access')
    for origin in origins:
        parts=urlsplit(origin)
        if parts.scheme not in ('http','https') or not parts.netloc or parts.path or parts.query or parts.fragment or parts.username:
            raise ValueError('Provide complete origins without a path')
    cors={'CORSRules':[{'AllowedOrigins':origins,'AllowedMethods':['GET','HEAD'],
        'AllowedHeaders':['Range'],'ExposeHeaders':['Content-Length','Content-Range','ETag','Accept-Ranges'],'MaxAgeSeconds':3600}]}
    for bucket in {bucket_for(a) for a in data['assets'].values()}:
        s3.put_bucket_cors(Bucket=bucket,CORSConfiguration=cors)


def verify_cors(s3, data, origins=()):
    """Browsers must be allowed to read the files. Read the bucket's CORS rules when the token may; an object-only
    token (the least-privilege upload token) may not, so then ask R2 for a file the way a browser does, per --origin."""
    from botocore.exceptions import ClientError
    for bucket in {bucket_for(a) for a in data['assets'].values()}:
        try:
            rules=s3.get_bucket_cors(Bucket=bucket).get('CORSRules',[])
        except ClientError as e:
            if e.response['Error']['Code']!='AccessDenied':
                raise
            if not origins:
                raise ValueError('This token cannot read the bucket CORS rules; add --origin https://your-app-domain to check them with a real request')
            key=next(a['key'] for a in data['assets'].values() if bucket_for(a)==bucket)
            url=s3.generate_presigned_url('get_object',Params={'Bucket':bucket,'Key':key},ExpiresIn=300)
            for origin in origins:
                with urllib.request.urlopen(urllib.request.Request(url,headers={'Origin':origin,'Range':'bytes=0-0'}),timeout=30) as res:
                    allowed=res.headers.get('Access-Control-Allow-Origin')
                if allowed not in (origin,'*'):
                    raise ValueError('The bucket CORS policy does not allow '+origin+'; add it in the Cloudflare dashboard')
            continue
        if not any(r.get('AllowedOrigins') and {'GET','HEAD'}.issubset(set(r.get('AllowedMethods',[]))) for r in rules):
            raise ValueError('Configure GET/HEAD CORS for the app origin before activation')


def upload_manifest(s3, data):
    from botocore.exceptions import ClientError
    for logical, asset in data['assets'].items():
        bucket = bucket_for(asset)
        try:
            head = s3.head_object(Bucket=bucket,Key=asset['key'])
            if head['ContentLength']==asset['size'] and head.get('Metadata',{}).get('sha256')==asset['sha256']:
                continue
        except ClientError as e:
            if e.response['Error']['Code'] not in ('404','NoSuchKey','NotFound'):
                raise
        cache = 'public, max-age=31536000, immutable' if asset['visibility']=='public' else 'private, max-age=3600'
        s3.upload_file(str(local_path(logical)),bucket,asset['key'],ExtraArgs={
            'ContentType':asset['contentType'],'CacheControl':cache,'Metadata':{'sha256':asset['sha256']}})


def save_manifest(data, keep_public=False):
    target = ROOT/'site/media-manifest.json'
    if keep_public and target.is_file():
        # A private-only run keeps the planned public entries; they stay inert until R2_PUBLIC_BASE_URL is set.
        old = json.loads(target.read_text(encoding='utf-8')).get('assets', {})
        data = dict(data, assets={**data['assets'], **{k: a for k, a in old.items() if a['visibility'] == 'public'}})
    temp = target.with_suffix('.json.tmp')
    temp.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    temp.replace(target)
    r2_storage.manifest.cache_clear()


def activate(data):
    """Exclude verified files from the deployment, while retaining local originals."""
    if any(a['visibility']=='public' for a in data['assets'].values()):
        base=os.environ.get('R2_PUBLIC_BASE_URL','')
        if not base or '.r2.dev' in base:
            raise ValueError('Public migration needs an HTTPS custom domain, not the development URL')
        if os.environ.get('R2_BUCKET_PUBLIC')==os.environ.get('R2_BUCKET_PRIVATE'):
            raise ValueError('Private and public buckets must be separate')
        # Reuse runtime validation for the URL before changing deployment files.
        previous=os.environ.get('R2_MEDIA_ENABLED')
        try:
            os.environ['R2_MEDIA_ENABLED']='1'
            sample=next(k for k,a in data['assets'].items() if a['visibility']=='public')
            r2_storage.asset_target(sample)
        finally:
            if previous is None:os.environ.pop('R2_MEDIA_ENABLED',None)
            else:os.environ['R2_MEDIA_ENABLED']=previous
    # Exact paths exclude only verified objects, never a new file that wasn't uploaded.
    paths=[('site/' if k.startswith('lessons/') else 'public/')+k for k in data['assets']]
    # .vercelignore keeps the files out of the upload, so the function can never bundle them. vercel.json's
    # excludeFiles is not used: Vercel rejects values longer than 256 characters, and exact paths soon exceed that.
    config_path=ROOT/'vercel.json'
    config=json.loads(config_path.read_text(encoding='utf-8'))
    if config['functions']['api/index.py'].pop('excludeFiles',None) is not None:
        config_path.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
    ignore_path=ROOT/'.vercelignore'
    start='# BEGIN VERIFIED R2 MEDIA';end='# END VERIFIED R2 MEDIA'
    text=ignore_path.read_text(encoding='utf-8')
    if start in text:
        before,remaining=text.split(start,1);_,after=remaining.split(end,1);text=before.rstrip()+'\n'+after.lstrip('\n')
    ignore_path.write_text(text.rstrip()+'\n'+start+'\n'+'\n'.join(paths)+'\n'+end+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--include-public',action='store_true',help='Also migrate public audio/images; requires a separate bucket/domain')
    parser.add_argument('--write-manifest',action='store_true',help='Write the local manifest; does not enable R2')
    parser.add_argument('--upload',action='store_true')
    parser.add_argument('--verify',action='store_true')
    parser.add_argument('--activate',action='store_true',help='Verify all remote objects, then exclude their local originals from Vercel')
    parser.add_argument('--configure-cors',action='store_true',help='Set read-only browser access for the provided app origins')
    parser.add_argument('--origin',action='append',default=[],help='Exact app origin, e.g. https://stem-cloud.vercel.app; repeat for previews/local testing')
    args=parser.parse_args();data=build_manifest(args.include_public)
    ignore=(ROOT/'.vercelignore').read_text(encoding='utf-8')
    if not args.include_public and '# BEGIN VERIFIED R2 MEDIA' in ignore and any(line.startswith('public/static/') for line in ignore.splitlines()):
        raise ValueError('Public media is already migrated; use --include-public to retain it')
    total=sum(a['size'] for a in data['assets'].values())
    print(f"Media plan: {len(data['assets'])} files, {total/1024/1024:.2f} MiB")
    if not data['assets']:raise ValueError('No media found')
    if args.upload or args.verify or args.activate or args.configure_cors:
        s3=r2_storage.client()
        if args.upload:upload_manifest(s3,data)
        if args.configure_cors:configure_cors(s3,data,args.origin)
        verify_manifest(s3,data,deep=args.activate)
        if args.activate:verify_cors(s3,data,args.origin)
        print('Every remote object has the expected size and SHA-256 metadata.')
        save_manifest(data,keep_public=not args.include_public)
        if args.activate:
            activate(data)
            print('Deployment exclusions prepared. Set R2_MEDIA_ENABLED=1 in Vercel before deploying.')
    elif args.write_manifest:
        save_manifest(data,keep_public=not args.include_public)
        print('Local manifest written. Existing file delivery remains active until R2_MEDIA_ENABLED=1.')
    else:
        print('Read-only plan. Nothing uploaded, activated or deleted.')


if __name__=='__main__':
    try:main()
    except ValueError as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # SDK tracebacks can contain request details; never print credentials or signed URLs.
        print('R2 operation failed ('+type(error).__name__+'). Check configuration, bucket permissions and remote objects.',file=sys.stderr)
        sys.exit(1)
