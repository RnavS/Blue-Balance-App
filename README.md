# Blue Balance - Hydration Tracking App

A React Native app built with Expo for tracking daily hydration with barcode scanning, AI coaching, and premium features.

## Project Structure

- **app/** - Expo Router navigation and screens
- **src/** - Shared components, contexts, utilities, and theme
- **assets/** - App icons, splash screens, and images
- **android/** - Native Android configuration (generated via Expo prebuild)
- **ios/** - Native iOS configuration (generated via Expo prebuild)
- **supabase/** - Backend configuration and Edge Functions

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_KEY=your_supabase_key
   EXPO_PUBLIC_SCANDIT_LICENSE_KEY=your_scandit_key
   ```

3. Run the app:
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
- **Subscription Management**: Stripe-powered in-app purchases
- **Dark Mode**: Optimized dark UI with customizable accent colors

## Publishing Checklist

- [x] Removed legacy App.tsx and utils directory
- [x] Cleaned up unnecessary permissions (iOS: Face ID, Microphone; Android: READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, RECORD_AUDIO, SYSTEM_ALERT_WINDOW)
- [x] Moved Supabase credentials to environment variables
- [x] Added runtime version configuration
- [x] Updated .gitignore with build artifacts
- [x] Added prebuild scripts

## Notes

- Supabase credentials are loaded from environment variables, not app.json
- The app uses Expo Router for navigation with typed routes
- Premium subscriptions are managed via Stripe and Supabase Edge Functions
- Deep links are configured for both iOS and Android
