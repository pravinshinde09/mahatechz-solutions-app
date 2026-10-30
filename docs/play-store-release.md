# Google Play release (spec §23, §31.2 Phase 6)

The app is consumption-only: students sign in, learn, take quizzes, join live classes and download
certificates. Courses are bought on the website. There is no purchase flow, price or "buy" link in
the app, and `com.android.vending.BILLING` is blocked in `app.config.ts`, which keeps it outside Play's
billing requirements (spec §23.10). Keep it that way: don't add prices or links to checkout in the app.

## One-time setup

1. **Play Console** developer account (organisation account, D-U-N-S number needed). Create the app
   `Mahatecz Learning`, package `com.mahatecz.learning`, free, category Education.
2. **EAS:** `npx eas login`, `npx eas init` (links the project), then set the production API URL:

   ```bash
   npx eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.<domain> --visibility plaintext
   npx eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.staging.<domain> --visibility plaintext
   # Sign-in (Supabase Auth): each environment's project URL and publishable key
   npx eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<prod-ref>.supabase.co --visibility plaintext
   npx eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
   ```

   `EXPO_PUBLIC_*` values are bundled into the app and visible to anyone, so only URLs and the
   publishable key go here, never Supabase's secret key. Add `mahatecz://auth-callback` to the
   Supabase project's redirect URLs for Google sign-in.
3. **Signing:** let EAS generate the upload key on the first build, and enrol in Play App Signing.
   Download a backup of the upload key (`npx eas credentials`) into the password manager.
4. **Service account for `eas submit`:** Play Console → Setup → API access → create a service account
   with "Release manager" permission; save its JSON key as an EAS secret
   (`eas credentials` → Google Service Account). The first upload has to be manual (Play's rule).

## Store listing

| Field | Content |
|---|---|
| Short description (80) | Learn AutoCAD Electrical, panel design and more, from lessons to certificate. |
| Full description | What students can do in the app; that courses are enrolled on the website; the trademark line: "AutoCAD, AutoCAD Electrical and Revit are trademarks of Autodesk, Inc. Mahatecz Solutions is not affiliated with or endorsed by Autodesk." |
| Graphics | 512×512 icon (from `assets/icon.png`), 1024×500 feature graphic, ≥ 2 phone screenshots (dashboard, player, quiz, certificate). No Autodesk logos (spec §29.8). |
| Contact | Support email, website, privacy policy URL `https://<domain>/privacy` |
| Ads | No ads |
| Target audience | 18+ unless parental consent is decided (spec Q-14); choosing under-18 brings Families policy requirements |
| Content rating | Complete the IARC questionnaire: education app, no user-generated public content, no violence |

## Data safety form

Based on what the app does today; review again whenever a feature or SDK is added.

| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name, email address | Yes (sign-up and sign-in) | No | Account management | No |
| App interactions (lessons opened, watch progress, quiz answers, live class joins) | Yes | No | App functionality | No |
| Purchase history | No: purchases happen on the website and the app only shows which courses are unlocked | | | |
| Crash logs / diagnostics | No (the app has no crash SDK yet; update if Sentry is added) | | | |
| Location, contacts, photos, files | No | | | |

- Data is encrypted in transit (HTTPS only).
- Users can request deletion: in the app (Profile → Delete account) and on the web at
  `https://<domain>/app/settings` after signing in. Data is anonymised after a 14-day grace period;
  payment records are kept as the law requires (say so in the form's "data retained" note).
- "Shared" means given to third parties for their own use. Service providers processing data for us
  (hosting, video delivery, email) don't count as sharing under Play's definition.

## Release

```bash
# Internal testing (the default submit track in eas.json)
npx eas build --platform android --profile production
npx eas submit --platform android --profile production --latest
```

1. **Internal testing** (up to 100 testers by email): staff and a few students for at least a week.
   Check sign-in, video playback on mobile data, resources download, live join, quiz, certificate
   download and share, account deletion. On a low-end device too (2–3 GB RAM).
2. **Closed testing:** new personal developer accounts need 12+ testers for 14 days before
   production access; organisation accounts don't, but a short closed round is still worth it.
3. **Production, staged rollout:** Play Console → Production → create release from the tested build →
   rollout **10 %** → watch for 48 h (Play vitals: crash rate < 1 %, ANR rate < 0.5 %; support
   tickets) → **50 %** → **100 %**. Halt the rollout from the console if something is wrong; a halted
   release stops reaching new devices.

`autoIncrement` in `eas.json` raises `versionCode` on every production build (`appVersionSource:
remote`). Raise `version` in `app.config.ts` for each user-visible release.

## Before each release

- `npm run typecheck && npm run lint` and the web export pass (CI).
- The API in production is compatible with this build (the app calls `/api/v1`; never remove a
  field the current store version uses).
- Store listing and data safety still match the app.
