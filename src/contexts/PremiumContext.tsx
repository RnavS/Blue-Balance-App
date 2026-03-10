import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface PremiumState {
  isPremium: boolean;
  bankConnected: boolean;
  bankLast4: string | null;
}

interface PremiumContextType extends PremiumState {
  upgradeToPremium: () => Promise<void>;
  cancelPremium: () => Promise<void>;
  connectBank: (last4: string) => Promise<void>;
  disconnectBank: () => Promise<void>;
  loading: boolean;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [state, setState] = useState<PremiumState>({
    isPremium: false,
    bankConnected: false,
    bankLast4: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setState({ isPremium: false, bankConnected: false, bankLast4: null });
      setLoading(false);
      return;
    }

    const stored = localStorage.getItem(`blueBalance_premium_${user.id}`);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load premium state:", e);
      }
    }
    setLoading(false);
  }, [user]);

  const saveState = (newState: PremiumState) => {
    setState(newState);
    if (user) {
      localStorage.setItem(`blueBalance_premium_${user.id}`, JSON.stringify(newState));
    }
  };

  const upgradeToPremium = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    saveState({ ...state, isPremium: true });
  };

  const cancelPremium = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    saveState({ ...state, isPremium: false });
  };

  const connectBank = async (last4: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    saveState({ ...state, bankConnected: true, bankLast4: last4 });
  };

  const disconnectBank = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    saveState({ ...state, bankConnected: false, bankLast4: null });
  };

  return (
    <PremiumContext.Provider
      value={{
        ...state,
        loading,
        upgradeToPremium,
        cancelPremium,
        connectBank,
        disconnectBank,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}
