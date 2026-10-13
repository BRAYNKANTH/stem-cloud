# Putting STEM Cloud on Google Play (Phase 10)

The Android app is the website itself, opened full screen by a small app (a *Trusted Web Activity*). There is no
second codebase: every deploy of the site updates the app, and a student signs in exactly as on the website. The
site is ready for it (`public/static/manifest.webmanifest`, the service worker, the icons, and
`/.well-known/assetlinks.json`, which Android checks before it opens the site without a browser bar).

You need: a Google Play developer account (one-time fee, in Play Console), about an hour, and a phone to test on.

## 1. Make the app package (PWABuilder, in the browser)

1. Open **https://www.pwabuilder.com**, enter `https://www.stemcloud.site` and press **Start**.
2. It checks the site. The manifest, service worker and icons should all pass. Press **Package for stores**, then choose **Android** → **Generate package**.
3. In the options:
   - **Package ID:** `site.stemcloud.app`. It can never change once published, so choose it once; this name is the suggestion.
   - **App name:** `STEM Cloud: O/L Physics`; **short name:** `STEM Cloud`.
   - **Signing key:** **Create new**. PWABuilder makes the upload key. Fill in your name and organisation.
4. Press **Download**. You get a zip with:
   - `app-release-bundle.aab`, the file you upload;
   - the signing key (`signing.keystore`) and `signing-key-info.txt`.
   **Keep the key and the info file safe and private.** Every future update must be signed with the same key. Don't put them in this repository, and don't paste them into a chat.

## 2. Create the app in Play Console

1. **Play Console** → **Create app**: name `STEM Cloud: O/L Physics`, default language English, *App*, *Free*.
2. Fill in the store listing:
   - a short and a full description;
   - the icon (`public/static/icons/icon-512.png`);
   - two or more phone screenshots, taken on a phone;
   - the privacy policy link: `https://www.stemcloud.site/privacy`.
3. **App content:** answer the questions honestly:
   - target audience: students, 13+;
   - data safety: the account name and learning progress are stored, nothing is sold, and accounts can be deleted from the account page.
4. **Testing → Internal testing → Create release**, upload `app-release-bundle.aab`, and add yourself and a few testers by email.

## 3. Tell the site which app it may open in (assetlinks)

1. In Play Console → your app → **Setup → App integrity → App signing**, copy the **SHA-256 certificate fingerprint** of the *app signing key*. It looks like `AB:CD:…` (32 pairs).
   - If you also want the build you install yourself to open full screen, copy the *upload key* fingerprint too. It's in PWABuilder's `signing-key-info.txt`.
2. In **Vercel** → the project → **Settings → Environment Variables**, add for **Production**:
   - `ANDROID_PACKAGE` = `site.stemcloud.app`
   - `ANDROID_CERT_SHA256` = the fingerprint. For two, separate them with a comma.
3. Redeploy (**Deployments** → the latest → **⋯** → **Redeploy**).
4. Check that `https://www.stemcloud.site/.well-known/assetlinks.json` now shows the package and the fingerprint. Until both settings are there, that address says "not found", which is expected.

## 4. Test, then publish

1. Install the internal test from the Play Store link on a phone.
2. It should open with **no browser address bar**. If you see one, the fingerprint in step 3 doesn't match the key that signed the app; check which one you copied.
3. Sign in, open a lesson, try a lab, go offline once, and reopen a lesson.
4. When it's right: **Production → Create release**, using the same bundle, and send it for review.

## Updates

- The lessons and the app's content update with every deploy of the site. Nothing needs to go to the Play Store again.
- Only a change to the app shell (its name, icon, or the package itself) needs a new bundle from PWABuilder, signed with the **same key**, with a higher version number.

## iOS, later

Apple doesn't accept an app that is just a website. The plan (Phase 10) is a small native shell with something extra, such as chapters downloaded for offline use, once there is demand. Students on iPhone can already add the site to their home screen from Safari (**Share → Add to Home Screen**).
