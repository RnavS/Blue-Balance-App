# Blue Balance - Hydration Tracking App

A React Native app built with Expo for tracking daily hydration with barcode scanning, AI coaching, and premium features.

## Project Structure

- **app/** - Expo Router navigation and screens
- **src/** - Shared components, contexts, utilities, and theme
- **assets/** - App icons, splash screens, and images
- **android/** - Native Android configuration (generated via Expo prebuild)
- **ios/** - Native iOS configuration (generated via Expo prebuild)
- **server/** - The backend API (Node + Hono + Postgres). See [server/README.md](server/README.md)
- **supabase/** - Legacy, no longer used. See [supabase/LEGACY.md](supabase/LEGACY.md)

## Setup

```bash
npm install
npm run dev
```

That is the whole thing. `npm run dev` creates any missing `.env` files, installs
the server's dependencies on first run, starts the API on `:8787`, and starts the
Metro bundler on `:8081`.

The API needs **no configuration to run locally** — it defaults to embedded
Postgres (real Postgres compiled to WebAssembly, persisted to `server/pgdata/`),
generates a development signing key on first boot, and applies migrations
automatically at startup. There is no database to install and no connection
string to set.

Optional keys live in `server/.env`: `OPENAI_API_KEY` for the AI coach, the
Stripe keys for billing, `GO_UPC_API_KEY` for the third barcode provider. The app
reads `EXPO_PUBLIC_SCANDIT_LICENSE_KEY` from the root `.env`; without it the
scanner falls back to expo-camera.

Useful variants:

| Command | What it does |
|---|---|
| `npm run dev` | API + Metro together |
| `npm run dev:api` | API only |
| `npm run dev:app` | Metro only |
| `npm run dev:lan` | Both, with Metro on the LAN for a physical device |
| `npm run start:clear` | Metro with a cleared cache (needed after editing `.env`) |

**Before deploying**, set `DATABASE_URL` and `AUTH_JWT_SECRET` — the server
refuses to start with `NODE_ENV=production` unless both are present.

## Building for App Store

### iOS

1. Clean prebuild:
   ```bash
   npm run prebuild:clean
   ```

2. Build for iOS:
   ```bash
   npm run prebuild:ios
   ```

3. Submit to App Store:
   ```bash
   eas build --platform ios --auto-submit
   ```

### Android

1. Build for Android:
   ```bash
   npm run prebuild:android
   ```

2. Submit to Google Play:
   ```bash
   eas build --platform android --auto-submit
   ```

## Key Features

- **Barcode Scanning**: Fast beverage logging via barcode (powered by Scandit)
- **Manual Logging**: Add beverages manually with custom sizes
- **Daily Tracking**: Visual progress ring and hydration status
- **Premium AI Coach**: Get personalized hydration coaching
- **Subscription Management**: Stripe on web/Android; free on iOS in 1.0 pending In-App Purchase
- **Dark Mode**: Optimized dark UI with customizable accent colors

## Publishing Checklist

- [docs/PUBLISHING_ON_MAC.md](docs/PUBLISHING_ON_MAC.md) — step-by-step release walkthrough
- [docs/APP_STORE_SUBMISSION.md](docs/APP_STORE_SUBMISSION.md) — audit, per-service verification, open blockers

Note: iOS cannot be built on Windows — `expo prebuild --platform ios` refuses to
run there. Use a Mac.

- [x] Removed legacy App.tsx and utils directory
- [x] Cleaned up unnecessary permissions (iOS: Face ID, Microphone; Android: READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, RECORD_AUDIO, SYSTEM_ALERT_WINDOW)
- [x] Added runtime version configuration
- [x] Updated .gitignore with build artifacts
- [x] Added prebuild scripts
- [x] Added in-app account deletion (App Store Guideline 5.1.1(v))
- [x] Declared encryption exemption and privacy manifest data types
- [x] Migrated off Supabase to a self-hosted API

## Notes

- The app talks to the API in `server/` via `src/lib/api`; there is no vendor SDK
- The app uses Expo Router for navigation with typed routes
- Deep links are configured for both iOS and Android
