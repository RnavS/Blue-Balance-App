import { Platform } from 'react-native';

export const FREE_SCAN_LIMIT = 5;

// 1.0 ships without In-App Purchase, so iOS cannot sell Premium at all
// (App Store Guideline 3.1.1 forbids unlocking in-app features through an
// external checkout). Until StoreKit lands in 1.1, iOS gets every Premium
// feature for free and the paywall is hidden entirely.
//
// Remove this flag — and the `platform` argument threaded through the
// barcode-lookup and ai-coach edge functions — when IAP ships.
export const PREMIUM_FREE_PLATFORM = Platform.OS === 'ios';

export type PremiumPackageType = 'monthly' | 'annual';
export type PremiumPlatform = 'stripe' | null;

export interface PremiumState {
  isPremium: boolean;
  entitlementId: 'premium' | null;
  productId: string | null;
  priceId: string | null;
  platform: PremiumPlatform;
  expiresAt: string | null;
  willRenew: boolean | null;
  scansUsedThisMonth: number;
  scansLimitThisMonth: number | null;
}

export const EMPTY_PREMIUM_STATE: PremiumState = {
  isPremium: false,
  entitlementId: null,
  productId: null,
  priceId: null,
  platform: null,
  expiresAt: null,
  willRenew: null,
  scansUsedThisMonth: 0,
  scansLimitThisMonth: FREE_SCAN_LIMIT,
};

export function normalizePremiumPayload(payload: any): PremiumState {
  const isPremium = Boolean(payload?.isPremium);

  return {
    isPremium,
    entitlementId: payload?.entitlementId === 'premium' ? 'premium' : null,
    productId: typeof payload?.productId === 'string' ? payload.productId : null,
    priceId: typeof payload?.priceId === 'string' ? payload.priceId : null,
    platform: payload?.platform === 'stripe' ? 'stripe' : null,
    expiresAt: typeof payload?.expiresAt === 'string' ? payload.expiresAt : null,
    willRenew: typeof payload?.willRenew === 'boolean' ? payload.willRenew : null,
    scansUsedThisMonth: Number(payload?.scansUsedThisMonth ?? 0),
    scansLimitThisMonth:
      typeof payload?.scansLimitThisMonth === 'number'
        ? payload.scansLimitThisMonth
        : isPremium
          ? null
          : FREE_SCAN_LIMIT,
  };
}
