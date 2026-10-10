# Cloudflare R2 for the whole app

The integration is prepared but disabled until `R2_MEDIA_ENABLED=1`.
No cloud upload or production activation has happened just by adding this code.
Local media files remain available, and the current Vercel deployment remains usable.

## What moves

- All large lesson media: textbooks, scanned papers, diagrams, future audio/video.
  These files require login today, so they use a **private bucket**. The app checks
  the student's session, then redirects to a one-hour signed R2 download URL.
- Public story recordings and promotional media can optionally move to a **separate
  public bucket** with a Cloudflare custom domain and caching.
- HTML lessons, JavaScript/CSS animations, question JSON, login, quizzes and progress
  remain on Vercel. Small PWA icons and logos remain with the app shell for offline use.

The current whole-app media plan is approximately 125 MiB across 202 files.
This removes about 122 MiB of private media from the Python bundle when activated,
plus optional public media. It does not relocate accounts or the database.

## Cloudflare setup

1. Enable **R2 Standard storage** and create `stem-cloud-private`. Keep both public
   development access and custom-domain public access disabled for this bucket.
2. Create an R2 S3 API token with **Object Read & Write** scoped to this bucket
   for the upload tool. Store Account ID, Access Key ID and Secret Access Key
   locally as environment variables. Do not paste secrets into chat or commit them.
3. In Vercel, configure the names in [.env.r2.example](.env.r2.example). Use a
   separate **Object Read only** token scoped to the private bucket for production.
   Keep `R2_MEDIA_ENABLED=0` until the files are uploaded and verified.
4. A domain is **not required for private signed downloads**. They use R2's S3
   endpoint and do not use the public Cloudflare CDN cache. Browser/device caching
   still avoids repeat image downloads, and PDFs support native byte ranges.
5. For optional public media, create `stem-cloud-public`, attach a domain you own
   (for example `files.example.com`) and enable Cloudflare caching. Set
   `R2_BUCKET_PUBLIC` and `R2_PUBLIC_BASE_URL`. Never attach that domain to the
   private lesson bucket. The development `r2.dev` URL is not a production CDN.

Official setup references: [R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/),
[signed downloads](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[browser CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[public caching](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/).

## Upload, then activate

Install the app requirements first. Set environment variables in your local shell
without adding their values to the repository. The uploader reads them directly.

```powershell
python -m pip install -r requirements.txt
# Read-only plan; no credentials needed:
python tools/r2_media.py
# Upload private lesson media and permit browser reads from your actual app origin:
python tools/r2_media.py --upload --configure-cors --origin https://YOUR-APP.vercel.app
# Verify complete remote file bytes before preparing deployment exclusions:
python tools/r2_media.py --activate
```

For public media, add `--include-public` to **both** upload and activation commands.
The public bucket and custom domain must be configured before activation. Include
additional `--origin` values in the CORS command for a custom app domain, preview
URL, or local testing (for example `http://localhost:8000`). Origins have no trailing
slash. Configuring CORS replaces the bucket's rules, so supply all desired origins.

`--activate` downloads and checks every object against its local SHA-256, then adds
only those exact verified paths to `.vercelignore`, which keeps them out of the upload (and so out of
the function bundle). It does not use `excludeFiles` in `vercel.json`: Vercel rejects values longer than
256 characters. Files are not deleted from your computer or Git. Do not exclude files manually before uploading.
Set `R2_MEDIA_ENABLED=1` in Vercel, then commit and deploy the generated manifest,
exclusions and app integration together. Check login, scan images, PDF page links
and story audio on the deployed site before considering the migration complete.

When adding or changing media, rerun upload and activation before deploying. Objects
use content hashes in their keys, so updated files get new URLs and avoid stale CDN
content. Existing objects with matching metadata are skipped. Old R2 objects are
retained; the tool never automatically deletes cloud data.

## Rollback and offline behavior

To return to local media, restore the previous `.vercelignore`,
set `R2_MEDIA_ENABLED=0`, and redeploy with original files included. Turning off the
flag alone does not restore files that were excluded from a deployment.

The private page cache stores visited bank data and JPGs under their existing app
paths, including authenticated R2 redirects, and is cleared on logout. Signed URLs
are not stored in question JSON. PDFs and audio use the network for range support.

R2 offers a free Standard allowance, but usage above it is billed. Use Cloudflare's
usage dashboard and alerts. Domain registration, if needed for public caching, is
separate. [Current R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Checks

```powershell
python tests/test_r2_storage.py
python -X utf8 tests/test_past_papers.py
python -X utf8 tests/test_pwa.py
```

The automated R2 checks use fake storage and dummy credentials. A live upload and
deployment smoke test still require access to your Cloudflare and Vercel accounts.
