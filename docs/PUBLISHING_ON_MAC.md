# Publishing Blue Balance from a Mac

This project was developed on Windows, which **cannot build iOS at all** —
`npx expo prebuild --platform ios` refuses to run there and `pod install` and
`xcodebuild` do not exist. Everything below assumes you have moved to a Mac.

Read [APP_STORE_SUBMISSION.md](APP_STORE_SUBMISSION.md) first for the open
blockers. The big one: **the backend must be deployed before the app is usable**,
and App Review will reject an app they cannot sign into.

---

## Step 0 — What you need before starting

- A Mac with macOS 14+ and **Xcode 15+** from the App Store (~10 GB, install it first, it is slow)
- **Apple Developer Program** membership, $99/year, active
- Node 20+ and CocoaPods (`sudo gem install cocoapods`)
- The backend from `server/` deployed and reachable over HTTPS

```bash
git clone <your-repo> && cd "Blue Balance"
npm install
```

---

---

## Step 0.5 — Running the dev build (read this if the app shows "No development servers found")

A **development build** (what `npx expo run:ios` produces) contains no JavaScript.
It downloads the JS from a Metro bundler at launch. With no bundler running it
scans ports 8081–8085 and 19000–19002, gets connection-refused on every one, and
shows the "No development servers found" screen. That is not a crash — nothing is
broken, the app simply has nothing to load.

One command runs everything:

```bash
npm run dev
```

That creates any missing `.env` files, installs the server's dependencies on
first run, starts the API on `:8787` (embedded Postgres, migrations applied
automatically — no database to install, nothing to configure), and starts Metro
on `:8081`.

Then launch the app. It should find Metro automatically; if not, tap
**Enter URL manually** and type `http://localhost:8081`.

To run just one half: `npm run dev:api` or `npm run dev:app`.

**The simulator resolves `localhost` to the Mac**, so `http://localhost:8787`
works there. On a **physical device** it does not — the phone's own localhost has
nothing on it. Use your Mac's LAN IP instead:

```bash
ipconfig getifaddr en0            # e.g. 192.168.1.42
```

Set `EXPO_PUBLIC_API_URL=http://192.168.1.42:8787` in `.env`, run
`npm run start:lan`, and keep both devices on the same Wi-Fi.

### `.env` is gitignored, so a fresh clone has none

`npm run dev` creates it for you from `.env.example`. Worth knowing why it
matters: `EXPO_PUBLIC_*` values are inlined **at bundle time**, not read at
runtime, so without `.env` the app builds and launches normally and then fails on
every screen. The app logs a loud `[Blue Balance] EXPO_PUBLIC_API_URL is not set`
error at startup if it is ever missing.

**After editing `.env`, restart the bundler with `npm run start:clear`** — a
running Metro keeps serving the old inlined value.

### Plain HTTP on a physical device

`Info.plist` sets `NSAllowsArbitraryLoads: false`. Loopback is exempt, so the
simulator is fine, but App Transport Security may block plain `http://` to a LAN
IP from a real device. If requests fail there with no server-side log, that is the
cause — deploy the backend behind HTTPS (step 1) and point the device at that
rather than adding a permanent ATS exception.

---

## Step 1 — Deploy the backend first

Nothing in the app works without it: every authenticated screen calls the API on
mount. Any Postgres host works; Railway is the fewest steps.

```bash
cd server
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — from Neon, Railway, Render, or Fly
- `AUTH_JWT_SECRET` — generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `OPENAI_API_KEY` — without it the AI coach returns a 500

Then create the schema, verify, and deploy:

```bash
npm install
npm run db:migrate
npm run smoke
```

`npm run smoke` should print **40 passed, 0 failed**. It runs against Postgres
compiled to WebAssembly, so it needs no database and proves auth, CRUD, and
cross-user isolation all work before you touch the deployment.

Deploy it (Railway shown; any Node host works), set the same environment
variables in the host's dashboard, then run `npm run db:migrate` against the
production `DATABASE_URL`.

Confirm it is live:

```bash
curl https://your-api-host.com/health
# {"status":"ok","database":"up"}
```

---

## Step 2 — Point the app at the deployed API

In the **repo root** `.env` (not `server/.env`):

```
EXPO_PUBLIC_API_URL=https://your-api-host.com
EXPO_PUBLIC_SCANDIT_LICENSE_KEY=your_scandit_key
```

`EXPO_PUBLIC_*` values are **baked into the binary at build time**, not read at
runtime. Setting this wrong means shipping a build that talks to `localhost` and
fails on every device. Double-check it before building.

Leaving the Scandit key blank is safe — the scanner falls back to `expo-camera`
and still works, just without the Scandit engine.

---

## Step 3 — Decide how native files are generated

`expo-doctor` reports one warning, and it matters here:

> This project contains native project folders but also has native configuration
> properties in app.json. When the android/ios folders are present, EAS Build
> will not sync: orientation, icon, userInterfaceStyle, splash, ios, android,
> plugins, scheme.

`ios/` and `android/` are committed **and** `app.json` describes the same
settings. Both are currently consistent — the encryption declaration and the full
privacy manifest exist in `app.json` *and* in `ios/BlueBalance/`. Pick one to be
the source of truth:

**Option A — regenerate from `app.json` (recommended).** Nothing in `ios/` is
hand-written: the Podfile is stock Expo and Scandit links itself through
CocoaPods autolinking, so nothing is lost.

```bash
npx expo prebuild --platform ios --clean
```

Then confirm the two Apple-facing files came out right — if either is missing,
stop, because both cause rejections:

```bash
grep -A1 ITSAppUsesNonExemptEncryption ios/BlueBalance/Info.plist
grep -c "NSPrivacyCollectedDataType<" ios/BlueBalance/PrivacyInfo.xcprivacy   # expect 5
```

Optionally `git rm -r --cached ios android` afterwards so the folders stop being
committed, which makes the warning go away permanently.

**Option B — keep the committed native folders.** Skip prebuild entirely. The
native files are already correct. Just know that future `app.json` edits under
`ios`/`android`/`plugins` will silently do nothing, so you would edit
`Info.plist` directly instead.

---

## Step 4 — Fill in the EAS submit credentials

`eas.json` still has placeholders:

```json
"appleId": "REPLACE_WITH_APPLE_ID_EMAIL",
"ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID",
"appleTeamId": "REPLACE_WITH_APPLE_TEAM_ID"
```

- **appleId** — the email you sign in to App Store Connect with
- **appleTeamId** — 10 characters, from developer.apple.com → Membership
- **ascAppId** — the numeric App ID, which only exists *after* you create the app
  record in step 5

---

## Step 5 — Create the App Store Connect record

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → **+** → New App:

- Platform: iOS
- Bundle ID: `com.bluebalance.app` (register it first at developer.apple.com →
  Identifiers if it is not in the dropdown)
- SKU: anything unique, e.g. `bluebalance-001`

Then open **App Information** and copy the **Apple ID** number into `ascAppId`.

Fill in, because submission is blocked without them:

- **Privacy Policy URL** — required; the app collects account and health-adjacent data
- **Support URL** — required
- Category: Health & Fitness
- Age rating questionnaire

### App Privacy questionnaire

Answer it to match `PrivacyInfo.xcprivacy` exactly, or the build gets flagged.
Declare collected, linked to identity, **not** used for tracking:

| Data | Purpose |
|---|---|
| Email Address | App Functionality |
| Name | App Functionality |
| Health & Fitness | App Functionality |
| Other User Content (coach chat) | App Functionality |
| Purchase History | App Functionality |

Do **not** advertise in-app purchases. 1.0 sells nothing on iOS — the paywall is
replaced by an "All features included" card. Make sure the description and
screenshots do not mention a paid tier, or review will look for a purchase flow
that does not exist.

---

## Step 6 — Build

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
```

EAS will offer to generate the distribution certificate and provisioning profile —
let it, unless you already have them.

The build runs on EAS's macOS workers (~15–25 min). You do not strictly need
Xcode for this path, but you do want it for step 7.

**If the build fails on Hermes with `private properties are not supported`:** this
reproduces locally on Windows and is documented in
[APP_STORE_SUBMISSION.md](APP_STORE_SUBMISSION.md#minified-bundle-cannot-be-verified-on-windows).
It comes from React Native's own DOMRect polyfill, not from this app's code.
It is expected to *not* occur on EAS's macOS Hermes, but if it does, that is the
cause.

To build locally in Xcode instead:

```bash
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
open ios/BlueBalance.xcworkspace
```

Then in Xcode: set the team under Signing & Capabilities, choose
**Any iOS Device (arm64)**, and Product → Archive.

---

## Step 7 — Test on a real device before submitting

Do not skip this. The Supabase→self-hosted migration changed every network call
in the app, and none of it has run against a deployed backend yet.

```bash
eas build --platform ios --profile preview
```

Install on your iPhone and walk the whole flow:

- [ ] Sign up with a new email
- [ ] Create a profile
- [ ] Log water manually; confirm it persists after force-quitting the app
- [ ] Scan a real drink barcode
- [ ] Open the AI coach and send a message (needs `OPENAI_API_KEY`)
- [ ] Kill and relaunch — you should stay signed in (token refresh)
- [ ] Settings → Delete Account, then confirm that email can sign up again

The last one is what App Review checks for Guideline 5.1.1(v).

---

## Step 8 — Submit

```bash
eas submit --platform ios --profile production
```

Then in App Store Connect, attach the build and add:

- Screenshots — **6.9" and 6.5" iPhone required**. `supportsTablet` is false, so
  no iPad set is needed.
- Description, keywords, promotional text

**App Review Information — the two fields that decide whether you pass:**

1. **Demo account.** The app is fully gated behind sign-in. Give a real working
   email and password on your production backend. Reviewers reject rather than
   sign up themselves. Create it and verify you can sign in with it.
2. **Notes.** Say the app is a hydration tracker, that barcode scanning needs a
   physical drink barcode, and give one they can test against — `5449000000996`
   (Coca-Cola) is confirmed working against the live lookup providers.

Then Submit for Review. First review is typically 24–48 hours.

---

## Common rejection causes, all already addressed

| Guideline | Issue | Status |
|---|---|---|
| 5.1.1(v) | No in-app account deletion | Settings → Delete Account, two-step confirm |
| 3.1.1 | Selling digital content outside IAP | Nothing is sold on iOS in 1.0 |
| 2.1 | Reviewer cannot sign in | **You must supply a demo account** |
| 5.1.1 | Missing privacy policy | **You must supply the URL** |
| 2.3.x | Privacy answers disagree with the manifest | Table in step 5 |
| 1.4.1 | Medical claims | Keep the coach framed as general wellness, not medical advice |

The two in bold are the ones still on you.

---

## Before 1.1: things deliberately left undone

- **Password reset does not send email.** There is no provider wired up, so a
  user who forgets their password is locked out permanently. Fix this early.
- **No rate limiting** on sign-in or password reset.
- **In-App Purchase** to start charging iOS users — see the 1.1 plan in
  [APP_STORE_SUBMISSION.md](APP_STORE_SUBMISSION.md).
