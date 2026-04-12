import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import {
  EMPTY_PREMIUM_STATE,
  normalizePremiumPayload,
  PremiumPackageType,
  PremiumState,
} from '@/lib/premium';

interface PremiumContextType extends PremiumState {
  purchasePremium: (packageType: PremiumPackageType) => Promise<void>;
  openManageSubscription: () => Promise<void>;
  refreshPremium: () => Promise<void>;
  loading: boolean;
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

async function invokeFunction<T>(name: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);

  if (error) {
    const context = (error as any)?.context;
    if (context && typeof context.json === 'function') {
      let details: any = null;
      try {
        details = await context.json();
      } catch (_) {
        details = null;
      }

      const message =
        (typeof details?.message === 'string' && details.message) ||
        (typeof details?.error === 'string' && details.error) ||
        error.message ||
        'Request failed.';
      throw new Error(message);
    }

    throw new Error(error.message || 'Request failed.');
  }

  return data as T;
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
      const data = await invokeFunction('sync-premium-status');
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
        const data = await invokeFunction<{ url?: string }>('create-stripe-checkout-session', {
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
      const data = await invokeFunction<{ url?: string }>('create-stripe-portal-session', {
        returnUrl,
      });

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
