import { config } from '../config.js';

// Mirrors PREMIUM_FREE_PLATFORM in src/lib/premium.ts.
//
// Blue Balance 1.0 ships without In-App Purchase, so App Store Guideline 3.1.1
// leaves no legal way to sell Premium on iOS. iOS therefore gets every Premium
// feature for free until StoreKit lands in 1.1.
//
// The platform string is client-supplied and therefore spoofable. That is
// accepted for 1.0: the only thing an attacker gains is free hydration advice,
// and there is no purchase path to undercut. Remove this module — and the
// `platform` field its callers read — when IAP ships.
const FREE_PREMIUM_PLATFORMS = new Set(['ios']);

export function hasPremiumAccess(isActive: boolean, platform: unknown): boolean {
  if (isActive) return true;

  // Kill switch: IOS_PREMIUM_FREE=false restores the paywall everywhere.
  if (config.iosPremiumFree === 'false') return false;

  return typeof platform === 'string' && FREE_PREMIUM_PLATFORMS.has(platform.toLowerCase());
}
