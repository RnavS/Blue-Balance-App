# Blue Balance — App Store Submission Checklist

Audit date: 2026-07-30 · Version 1.0.0 (build 1) · Bundle ID `com.bluebalance.app`

---

## Service verification

Tested live from this machine. "Not verifiable" means the service could not be
exercised because a prerequisite (a deployed backend or a configured key) is missing —
not that it is known broken.

| # | Service | Result | Evidence |
|---|---------|--------|----------|
| 1 | TypeScript build (`tsc --noEmit`) | **PASS** | Exit 0 for both the app and `server/` |
| 1b | iOS JS bundle (`expo export`) | **PASS** | 6.16 MB Hermes bytecode; all imports resolve after the Supabase removal. See the minification caveat below |
| 1c | `expo-doctor` | **17/18** | Only the CNG warning remains — expected, see step 3 of the publishing guide |
| 2 | App icon assets | **PASS** | `icon.png` and iOS `App-Icon-1024x1024@1x.png` are 1024×1024, no alpha channel |
| 3 | iOS privacy manifest present | **PASS** | Declared in **both** `app.json` and `ios/BlueBalance/PrivacyInfo.xcprivacy`, so it survives a `prebuild --clean` |
| 4 | Open Food Facts barcode API | **PASS** | `5449000000996` → "coca-cola" / 33 cl; `3017620422003` → "Nutella"; `049000028911` → "Diet Coke Soft Drink" |
| 5 | UPCItemDB fallback API | **PASS** | `5449000000996` → HTTP 200, `code: OK`, 1 item |
| 6 | ~~Supabase project host~~ | **RETIRED** | `cqfetvdquwqnlevpuikw.supabase.co` did not resolve on the local resolver, `8.8.8.8`, or `1.1.1.1` — `NXDOMAIN`, while `supabase.com`, `api.stripe.com` and `world.openfoodfacts.org` all resolved from the same machine. The backend has since been rebuilt off Supabase entirely (see blocker #1) |
| 7 | Auth: signup, signin, refresh rotation, replay rejection | **PASS** | `server` smoke test — 40 assertions against real Postgres |
| 8 | Postgres CRUD (profiles, water_logs, beverages, scanned_beverages, chat_messages) | **PASS** | Smoke test; numeric columns verified to round-trip as numbers |
| 9 | Cross-user isolation (the RLS replacement) | **PASS** | Smoke test: a second user gets 404 attempting to read, write, update, or delete another user's data |
| 10 | `POST /functions/sync-premium-status` | **PASS** | Smoke test — returns free-tier state with a limit of 5 |
| 11 | `POST /functions/barcode-lookup` | **PASS** | Route verified in smoke test; upstream providers verified separately (#4, #5) |
| 12 | `POST /functions/ai-coach` | **PARTIAL** | Premium gating verified (402 for a non-premium Android caller). The OpenAI call itself is unverified — no API key configured |
| 13 | `DELETE /account` | **PASS** | Smoke test: succeeds, invalidates the access token immediately, and cascades away all profiles |
| 14 | Stripe checkout / portal / webhook | **NOT VERIFIABLE** | Code ported and typechecked, but `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and both price IDs are unset. `api.stripe.com` is reachable |
| 15 | OpenAI (powers the coach) | **NOT VERIFIABLE** | `OPENAI_API_KEY` is unset |
| 16 | Go-UPC (third barcode fallback) | **NOT VERIFIABLE** | `GO_UPC_API_KEY` unset; the code skips this provider when absent, so it degrades rather than breaks |
| 17 | Scandit barcode scanning | **DEGRADED** | `EXPO_PUBLIC_SCANDIT_LICENSE_KEY` is absent from `.env`. `app/(main)/scan.tsx` falls back to expo-camera. Ships as a working but non-Scandit scanner |

Rows 7–13 were verified by `cd server && npm run smoke`, which drives the real
routes and middleware against Postgres compiled to WebAssembly — no mocks, no
network. **They have not yet been verified against a deployed instance**, which
is the remaining step in blocker #1.

### Minified bundle cannot be verified on Windows

`npx expo export --platform ios` succeeds with `--no-minify` but fails with the
default minifier:

```
error: private properties are not supported
  react-native/src/private/webapis/geometry/DOMRectReadOnly.js
```

The Windows `hermesc.exe` shipped with React Native 0.81.5 rejects the private
class fields (`#x`, `#width`) that React Native's own DOMRect polyfill uses.

**This is pre-existing, not caused by the Supabase migration** — verified by
reinstalling the original dependency tree (`git stash` + `npm ci` on the previous
`package-lock.json`), which fails identically.

EAS builds iOS on macOS with a different Hermes binary, so this very likely does
not affect the real build — but it is unverified until the first Mac build runs.
If it does reproduce on the Mac, the fix is to add
`"transform": { "minify": false }` under `expo.extra` or set `EXPO_USE_METRO_MINIFIER`;
raise it with Expo rather than working around it blindly.

---

## Blockers before submission

### 1. Dead Supabase backend — RESOLVED by migrating off Supabase

The project ref `cqfetvdquwqnlevpuikw` no longer exists in DNS, which is what
happens when a Supabase project is paused or deleted. Two other refs in git
history (`nletlerswxuyxihqelrq`, `risngyykrjzdvyznyfxw`) do not resolve either.

Rather than restore it, the backend was rebuilt as a self-hosted service in
`server/` — Node + Hono + Postgres, no vendor SDK. See
[server/README.md](../server/README.md). The app no longer depends on Supabase at
all; `@supabase/supabase-js` has been removed from `package.json`.

**Still required before submission:** deploy `server/` somewhere, run
`npm run db:migrate` against the production database, and set
`EXPO_PUBLIC_API_URL` to the deployed URL. The table above should then be re-run
against the live deployment.

### 2. Stripe subscriptions violate Guideline 3.1.1 — RESOLVED for 1.0

`src/contexts/PremiumContext.tsx` opened a Stripe Checkout URL via
`Linking.openURL` to unlock in-app features (unlimited barcode scans, Blue AI
Coach). Apple requires digital content consumed inside the app to be sold through
In-App Purchase and prohibits linking out to an external checkout for it. There
was also no "Restore Purchases" control.

**Decision: ship 1.0 with Premium free on iOS, add StoreKit IAP in 1.1.**
Implemented below. Nothing is sold on iOS, so 3.1.1 no longer applies.

### 3. Fill in the EAS submit credentials

`eas.json` now has placeholders that must be replaced with real values:
`appleId`, `ascAppId`, `appleTeamId`.

### 4. Set the backend secrets on the host

`OPENAI_API_KEY` (the coach returns 500 without it), plus `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and both price IDs if you want billing on web/Android.
See `server/.env.example`.

### 5. Wire up password-reset email

`POST /auth/reset-password` currently issues a token but has no email provider to
send it through — in production it returns success and logs a warning without
delivering anything. Users who forget their password have no way back in. Wire up
Resend/Postmark/SES and drop the `resetToken` field from the development response
before launch.

---

## Applied in this pass

- **Migrated the entire backend off Supabase** into `server/` — Node + Hono +
  Drizzle + Postgres. Auth is scrypt password hashing with JWT access tokens and
  rotating opaque refresh tokens; the seven edge functions became ordinary
  routes; the row-level security policies became explicit ownership predicates in
  the handlers. `@supabase/supabase-js` is gone from the app, replaced by a typed
  client in `src/lib/api` that persists tokens and refreshes them transparently
  on a 401. A `npm run smoke` suite proves it works, and
  `server/src/scripts/import-from-supabase.ts` can carry data over if the old
  project is ever restored.

  **Watch this in review:** Postgres used to reject an unauthorized query
  automatically, and now nothing does — a route that forgets `assertProfileOwned`
  or a `user_id` predicate leaks data silently. The smoke test covers the
  isolation cases; keep them passing as routes are added.

- **Premium is free on iOS for 1.0** (resolves blocker #2). A single flag,
  `PREMIUM_FREE_PLATFORM` in `src/lib/premium.ts`, drives everything:
  - `PremiumContext` forces `isPremium` true and `scansLimitThisMonth` null on
    iOS, which opens every existing client gate — the scan cap card, the locked
    camera state, and the AI coach lock all key off `isPremium`.
  - A new `canPurchasePremium` flag replaces the Settings paywall with a plain
    "All features included" card, so there is no purchase or manage control on
    iOS at all.
  - Server-side, `supabase/functions/_shared/entitlement.ts` applies the matching
    rule. `barcode-lookup` and `ai-coach` now read a `platform` field from the
    request body and skip the cap / 402 for iOS. Without this the client would
    unlock the UI and then get rejected by the edge function.
  - `IOS_PREMIUM_FREE=false` is a kill switch that restores the paywall
    everywhere without a code deploy.

  **Caveat:** `platform` is client-supplied and spoofable. That is deliberate for
  1.0 — the only thing a spoofer gains is free hydration advice, and no purchase
  path is being undercut. Replace this with real StoreKit receipt validation in
  1.1. Stripe remains fully intact for web and Android.

- **In-app account deletion** (Guideline 5.1.1(v), previously missing and a hard
  rejection cause). New `supabase/functions/delete-account/index.ts` cancels any
  Stripe subscription, deletes the Stripe customer, then deletes the auth user —
  every app table cascades from `auth.users`, so all data goes with it.
  `AuthContext.deleteAccount()` calls it; Settings → Account exposes it behind a
  two-step destructive confirmation.
- **Encryption declaration.** `ITSAppUsesNonExemptEncryption = false` in
  `Info.plist` and `ios.config.usesNonExemptEncryption` in `app.json`. The app
  uses only HTTPS, which is exempt. Without this, every build stalls waiting on a
  manual answer in App Store Connect.
- **Privacy manifest data types.** `NSPrivacyCollectedDataTypes` was an empty
  array while the app collects email, username, body metrics, hydration logs,
  coach chat content, and subscription state. Now declares email address, name,
  fitness, other user content, and purchase history — all linked to identity, all
  App Functionality, none used for tracking. Mirrored into `app.json` so
  `expo prebuild` does not regenerate over it.
- **Explicit `buildNumber`** in `app.json` to match `CFBundleVersion`.
- **`eas.json`** submit block scaffolded and iOS build resource class set.
- **Multipack serving-size bug in `barcode-lookup`.** Open Food Facts reports the
  case volume for multipacks — barcode `049000028911` returns `144 fl oz` — and
  the old fallback (`Math.max(...pool)` when nothing was in the realistic
  120–3000 ml band) logged that as a single 144 oz drink. Both extractors now
  return `null` in that case so the caller falls back to its single-serving
  default (16.9 oz / 500 ml).

`tsc --noEmit` passes and all edited JSON/plist files parse.

---

## Remaining App Store Connect work (outside the repo)

- [ ] Apple Developer Program membership active ($99/yr)
- [ ] App record created in App Store Connect with bundle ID `com.bluebalance.app`
- [ ] **Privacy policy URL** — required; the app collects account and health-adjacent data
- [ ] **Support URL** — required
- [ ] App Privacy questionnaire answered to match `PrivacyInfo.xcprivacy` (see above)
- [ ] Screenshots: 6.9" and 6.5" iPhone required (app is `supportsTablet: false`, so no iPad set needed)
- [ ] Description, keywords, promotional text, category (Health & Fitness)
- [ ] Age rating questionnaire
- [ ] Demo account credentials for App Review — the app is fully gated behind sign-in, so review **will** fail without a working test account
- [ ] Review notes explaining the barcode scanner (reviewers need a product barcode to test)
- [ ] No subscription products needed for 1.0 — confirm the App Store Connect
      listing does **not** advertise in-app purchases, and that the description
      and screenshots make no mention of a paid tier

### Health-claim caution

The AI coach gives hydration advice from user-entered age, height, and weight.
Keep its output framed as general wellness guidance, not medical advice, and
avoid marketing copy that implies medical benefit — this is a common rejection
point under Guideline 1.4.1 for health apps.

---

## Build and submit

```bash
npx expo prebuild --clean
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

---

## Planned for 1.1: StoreKit In-App Purchase

To start charging iOS users, in roughly this order:

1. Add RevenueCat (or `expo-in-app-purchases`) and create the monthly and annual
   subscription products in App Store Connect under one subscription group.
2. Extend `subscription_entitlements.platform` to accept `apple` alongside
   `stripe`, and add a receipt-validation path so entitlement comes from Apple's
   server notifications rather than a client-supplied string.
3. Add a **Restore Purchases** button — App Review rejects subscription apps
   without one.
4. Delete `PREMIUM_FREE_PLATFORM`, `supabase/functions/_shared/entitlement.ts`,
   and the `platform` argument threaded into `barcode-lookup` and `ai-coach`.
5. Link the privacy policy and terms from the paywall, and state the price,
   duration, and auto-renewal terms there.

Be aware that re-introducing limits users had for free in 1.0 reads as a
takeaway. Consider grandfathering 1.0 accounts or making 1.1's free tier more
generous than the original five scans.
