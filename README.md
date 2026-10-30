# Mahatecz Learning — Android app

Expo (SDK 58) + Expo Router app for students: sign in, see enrolled courses, learn (video,
external video, articles), resources, live classes, notifications. **Consumption-only** (spec
§23.10): nothing can be bought in the app, and course pages only say that enrolment happens on
the website — no price, no purchase button, no purchase link (Google Play payments policy).

Talks to the API in `../mahatechz-solutions-Api`; shared Zod contracts are copied in with
`npm run contracts:sync` (never edit `src/contracts`).

## Run

```bash
npm install
npm run contracts:sync
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 npx expo start   # Android emulator → host API
```

Native modules (`expo-video`, `expo-secure-store`, `react-native-webview`) need a development
build: `npx eas-cli@latest build --profile development` (or `npx expo run:android` with the
Android SDK installed). A plain-http API URL only works in development builds; use https
everywhere else.

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | API origin (default `http://10.0.2.2:4000`) |
| `EXPO_PUBLIC_WEB_URL` | Website origin, for "manage your account on the website" |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (sign-in, ADR 0009 in the API repo) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (public by design; never the secret key) |

`npm run export:web` builds a web version that is used only for UI smoke tests in a browser
(SecureStore and WebView have no web build; the export falls back to memory and iframes).

## Structure (spec §23.1)

```
src/app/            Expo Router screens (incl. certificates)
  _layout.tsx       providers (React Query + NetInfo, auth), protected stack
  sign-in, register, verify-code (passwordless: emailed code or Google), auth-callback
  (tabs)/           My learning (index), Discover, Live, Profile
  course/[slug]     course details (no purchase UI)
  learn/[courseId]/ syllabus · resources · announcements · progress, and the lesson player
  live/[id]         join (opens Meet/Zoom), recording, notes
  notifications
src/api/            fetch client (bearer, single-flight refresh, X-Client-Version) + query hooks
src/auth/           Supabase client (in-memory session), refresh token in expo-secure-store,
                    access token in memory (spec §23.4)
src/features/       quiz runner, certificate PDF share; player (expo-video, Bunny via WebView + player.js), heartbeats (offline
                    queue replayed with original timestamps), resources (download + share sheet)
src/theme/          tokens mirroring the web design system
```

## Behaviour notes

- Progress is server-side: the player sends heartbeats every 30 s and on pause/end; the API
  credits time against its own clock. Resume position is stored on the server, so it follows
  the student between the website and the app.
- Sign-in is Supabase Auth: an emailed one-time code, or Google in an in-app browser that returns to
  `mahatecz://auth-callback` (add that URL to Supabase's redirect allow list). No passwords.
- Staff accounts are sent to the website (2FA lives there); the app is for learning.
- Account deletion is available in Profile (store requirement): 14-day grace, cancelled by
  signing in again. It needs a sign-in from the last 15 minutes; otherwise the app asks the user
  to sign out and back in first.

## Status (Phase 4)

Done: auth, My learning (dashboard), Discover, course details, player with heartbeats/resume,
manual completion, resources (download + open), announcements, progress, live classes (join,
recordings), notifications, account deletion, certificates, quizzes. Verified with typecheck, lint and a browser run of
the web export (sign-in → syllabus → video completed by heartbeats → live join → profile).

Phase 5: certificates screen (Profile → Certificates: download and share the PDF, share the
verification link), quizzes inside QUIZ lessons (one scrolling page, autosave, timer with
auto-submit, results with answers), quiz scores, remaining requirements and certificate status on
the course Progress tab. Verified in the web export (certificate list, a graded attempt).

Phase 6: CI (typecheck, lint, web export, gitleaks); "Mark as complete" waits for the session to
start; Play Store release steps, listing and data safety answers in
[docs/play-store-release.md](docs/play-store-release.md).

Open: running on a device/emulator and a Maestro flow on a low-end profile (no Android SDK on the
build machine yet), push notifications `[ENH]`, Play Console internal
testing track, screen-capture protection `[ENH]`, Bunny HLS for `expo-video` (Bunny currently
plays in its embedded player).
