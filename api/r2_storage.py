"""Optional R2 media delivery. HTML, application code and question data stay local."""
import json
import os
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'site' / 'media-manifest.json'


def enabled():
    return os.environ.get('R2_MEDIA_ENABLED') == '1'


@lru_cache(maxsize=1)
def manifest():
    if not MANIFEST.is_file():
        return {}
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if data.get('schemaVersion') != 1:
        raise ValueError('Unsupported R2 manifest')
    return data['assets']


def settings():
    names = ('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_PRIVATE')
    config = {n: os.environ.get(n, '').strip() for n in names}
    if not all(config.values()):
        raise ValueError('R2 credentials and private bucket must be configured')
    if not re.fullmatch(r'[a-fA-F0-9]{32}', config['R2_ACCOUNT_ID']):
        raise ValueError('Invalid R2 account ID')
    return config


@lru_cache(maxsize=1)
def client():
    config = settings()
    import boto3
    from botocore.config import Config
    return boto3.client('s3', endpoint_url='https://' + config['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
        aws_access_key_id=config['R2_ACCESS_KEY_ID'], aws_secret_access_key=config['R2_SECRET_ACCESS_KEY'],
        region_name='auto', config=Config(signature_version='s3v4', s3={'addressing_style': 'path'},
        connect_timeout=10, read_timeout=30, retries={'max_attempts': 3}))


def asset_target(path):
    """Return (URL, visibility) for an exact manifest match, never an arbitrary key.

    Callers must check authentication before requesting a private lesson target.
    Public assets stay local until their separate public bucket/domain is ready.
    """
    if not enabled():
        return None
    asset = manifest().get(path)
    if not asset:
        return None
    visibility = asset['visibility']
    if visibility == 'public':
        base = os.environ.get('R2_PUBLIC_BASE_URL', '').rstrip('/')
        if not base:
            return None
        parsed = urlsplit(base)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment or parsed.username:
            raise ValueError('R2 public URL must be an HTTPS origin or path')
        return base + '/' + quote(asset['key'], safe='/'), visibility
    if visibility != 'private':
        raise ValueError('Invalid R2 asset visibility')
    config = settings()
    url = client().generate_presigned_url('get_object',
        Params={'Bucket': config['R2_BUCKET_PRIVATE'], 'Key': asset['key']}, ExpiresIn=3600)
    return url, visibility
