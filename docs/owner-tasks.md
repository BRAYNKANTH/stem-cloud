# Owner tasks

These are the steps only the site owner can do, because they need Vercel, Neon, Cloudflare or GitHub account access. Do them in any order when you have access, and tick them off here. The migration keeps going without them; where something is blocked, the item says so.

Never paste secrets into a chat or a commit. Put them straight into the service's settings, or into a local `.env*.local` file (git ignores those).

## Security
- [ ] **Reset the Neon database password.** It was pasted into a chat on 2026-10-10.
  1. Neon console → project → **Roles** → `neondb_owner` → **Reset password**.
  2. Update `DATABASE_URL` (and any other `POSTGRES_*` variables) in **Vercel → Settings → Environment Variables**, unless the Neon integration does it for you.
  3. Redeploy. Then the **Production smoke check** (GitHub → Actions) or `https://www.stemcloud.site/healthz` should show `"ok":true`.
- [ ] **Keep the R2 upload token only in `.env.r2.local`.** It's needed again only when new media is uploaded. You can delete it in Cloudflare and create a new one when needed.

## Vercel
- [ ] **Lesson gate secret (unblocks milestone 2.4).**
  - Add `GATE_SECRET` for Production and Preview: a long random value, for example from `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
  - Then tell Claude, who will add the edge middleware that protects `/learn/*`.
  - Not urgent: those lesson pages only arrive in Phase 5.
- [ ] **Give previews their own database.**
  - Today, Preview deployments use the production database, so a preview can change real data.
  - In the Neon integration (Vercel → Storage → the Neon database → Settings), turn on **a database branch per preview deployment**.
- [ ] **Optional: let automated checks open previews.**
  - Vercel → Settings → **Deployment Protection** → **Protection Bypass for Automation** → create a secret.
  - Add it to GitHub as a repository secret named `VERCEL_AUTOMATION_BYPASS_SECRET`.
  - Claude can then run the smoke check against each pull request's preview, not just production after merging.

## Neon
- [ ] **Backup branch now, if it wasn't made in Phase 0.** Neon console → **Branches** → **Create branch** from `main`, named like `backup-2026-10-pre-migration`. It is an instant copy that stays inside Neon.
- [ ] **Another backup branch before the progress migration (Phase 6).** Same steps, named like `backup-before-progress-v2`. Needed before Phase 6, not now.

## GitHub (repository owner: BRAYNKANTH)
- [ ] **Agree a merge routine.** Claude opens pull requests and merges them only when CI passes, then runs the production smoke check. If BRAYNKANTH also merges, follow the order written in each pull request; some pull requests say "merge X first".
- [ ] **Delete merged branches.** Either turn on Settings → General → **Automatically delete head branches**, or ask Claude to clean them up.

## The domain is blocked on some networks
Some school and office web filters block `stemcloud.site` as a **newly registered domain**; the Palo Alto Networks filter on your own network does. Students on those networks can't open the site.
- [ ] Ask for recategorisation as *Education* on each vendor's checking page:
  - Palo Alto: `urlfiltering.paloaltonetworks.com`
  - Fortinet: FortiGuard "Web Filter Lookup"
  - Cisco Talos: `talosintelligence.com`
- [ ] Tell partner schools' IT staff to allow `stemcloud.site` and `www.stemcloud.site`.

## Content
- [ ] **Read the Terms page** (`/terms`). It was written from how the app works and says the owner should check it.
- [ ] **New interface labels** (Understand, Watch, Explore, Practice, buttons and messages in the topic view) need Tamil and Sinhala wording from a reviewer.

## Done
- 2026-10-10: R2 bucket, tokens, CORS, and Vercel R2 variables (Phase 1b). Production serves lesson media from R2.
