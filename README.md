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

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` (see `.env.example`):
   ```
   EXPO_PUBLIC_API_URL=http://localhost:8787
   EXPO_PUBLIC_SCANDIT_LICENSE_KEY=your_scandit_key
   ```

3. Start the backend (first time only: `cd server && npm install && npm run db:migrate`):
   ```bash
   cd server && npm run dev
   ```

4. Run the app:
   ```bash
   npm start
   ```

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
