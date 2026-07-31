import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { functions } from '@/lib/api';
import { PREMIUM_HAS_ANYTHING_TO_SELL } from '@/lib/features';
import {
  EMPTY_PREMIUM_STATE,
  normalizePremiumPayload,
  PREMIUM_FREE_PLATFORM,
  PremiumPackageType,
  PremiumState,
} from '@/lib/premium';

interface PremiumContextType extends PremiumState {
  purchasePremium: (packageType: PremiumPackageType) => Promise<void>;
  openManageSubscription: () => Promise<void>;
  refreshPremium: () => Promise<void>;
  loading: boolean;
  /** False on platforms where Premium cannot be sold and is therefore free. */
  canPurchasePremium: boolean;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

function getReturnUrls() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin;
    return {
      successUrl: `${origin}/settings?premium=success`,
      cancelUrl: `${origin}/settings?premium=cancelled`,
      returnUrl: `${origin}/settings`,
    };
  }

  return {
    successUrl: 'bluebalance://settings?premium=success',
    cancelUrl: 'bluebalance://settings?premium=cancelled',
    returnUrl: 'bluebalance://settings',
  };
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PremiumState>(EMPTY_PREMIUM_STATE);
  const [loading, setLoading] = useState(true);

  const refreshPremium = useCallback(async () => {
    if (!user) {
      setState(EMPTY_PREMIUM_STATE);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await functions.syncPremiumStatus();
      setState(normalizePremiumPayload(data));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshPremium().catch((error) => {
      console.error('Premium refresh failed:', error);
      setLoading(false);
    });
  }, [refreshPremium]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && user) {
        refreshPremium().catch(() => null);
      }
    });

    return () => subscription.remove();
  }, [refreshPremium, user]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', () => {
      if (user) {
        refreshPremium().catch(() => null);
      }
    });

    return () => subscription.remove();
  }, [refreshPremium, user]);

  const purchasePremium = useCallback(
    async (packageType: PremiumPackageType) => {
      if (!user) {
        throw new Error('You must be signed in to buy Premium.');
      }

      setLoading(true);
      try {
        const urls = getReturnUrls();
        const data = await functions.createCheckoutSession({
          packageType,
          platform: Platform.OS,
          ...urls,
        });

        if (!data?.url) {
          throw new Error('Stripe checkout URL was not returned.');
        }

        await Linking.openURL(data.url);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const openManageSubscription = useCallback(async () => {
    if (!user) {
      throw new Error('You must be signed in to manage Premium.');
    }

    setLoading(true);
    try {
      const { returnUrl } = getReturnUrls();
      const data = await functions.createPortalSession({ returnUrl });

      if (!data?.url) {
        throw new Error('Stripe portal URL was not returned.');
      }

      await Linking.openURL(data.url);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return (
    <PremiumContext.Provider
      value={{
        ...state,
        // On a platform that cannot sell Premium, every gate falls open. This
        // single override is what unlocks the scan cap and the AI coach in the
        // UI; the API applies the matching rule server-side.
        isPremium: state.isPremium || PREMIUM_FREE_PLATFORM,
        scansLimitThisMonth: PREMIUM_FREE_PLATFORM ? null : state.scansLimitThisMonth,
        // Also false when both paid features are gated behind "coming soon" —
        // there would be nothing behind the paywall to buy.
        canPurchasePremium: !PREMIUM_FREE_PLATFORM && PREMIUM_HAS_ANYTHING_TO_SELL,
        loading,
        purchasePremium,
        openManageSubscription,
        refreshPremium,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) throw new Error('usePremium must be used within PremiumProvider');
  return context;
}
