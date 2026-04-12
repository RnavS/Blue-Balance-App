export const FREE_SCAN_LIMIT = 5;

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
