import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const key = `blueBalance_premium_${user.id}`;
    AsyncStorage.getItem(key).then(stored => {
      if (stored) {
        try { setState(JSON.parse(stored)); } catch (_) {}
      }
      setLoading(false);
    });
  }, [user]);

  const saveState = async (newState: PremiumState) => {
    setState(newState);
    if (user) {
      await AsyncStorage.setItem(`blueBalance_premium_${user.id}`, JSON.stringify(newState));
    }
  };

  const upgradeToPremium = async () => {
    await new Promise(r => setTimeout(r, 800));
    await saveState({ ...state, isPremium: true });
  };

  const cancelPremium = async () => {
    await new Promise(r => setTimeout(r, 500));
    await saveState({ ...state, isPremium: false });
  };

  const connectBank = async (last4: string) => {
    await new Promise(r => setTimeout(r, 1500));
    await saveState({ ...state, bankConnected: true, bankLast4: last4 });
  };

  const disconnectBank = async () => {
    await new Promise(r => setTimeout(r, 500));
    await saveState({ ...state, bankConnected: false, bankLast4: null });
  };

  return (
    <PremiumContext.Provider value={{ ...state, loading, upgradeToPremium, cancelPremium, connectBank, disconnectBank }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) throw new Error('usePremium must be used within PremiumProvider');
  return context;
}
