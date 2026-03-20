import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from './tokens';

export type ThemePreference = 'system' | ThemeMode;

interface ThemeModeContextType {
  themePreference: ThemePreference;
  resolvedMode: ThemeMode;
  setThemePreference: (next: ThemePreference) => Promise<void>;
}

const STORAGE_KEY = 'blueBalance_themePreference';

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (isThemePreference(value)) setThemePreferenceState(value);
      })
      .catch(() => {
        // Ignore storage errors and keep system fallback.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const resolvedMode: ThemeMode =
    themePreference === 'system'
      ? (colorScheme === 'light' ? 'light' : 'dark')
      : themePreference;

  const setThemePreference = async (next: ThemePreference) => {
    setThemePreferenceState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep in-memory value even if persistence fails.
    }
  };

  const value = useMemo(
    () => ({
      themePreference,
      resolvedMode,
      setThemePreference,
    }),
    [themePreference, resolvedMode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  const colorScheme = useColorScheme();
  const fallbackMode: ThemeMode = colorScheme === 'light' ? 'light' : 'dark';

  if (!context) {
    return {
      themePreference: 'system' as ThemePreference,
      resolvedMode: fallbackMode,
      setThemePreference: async () => {},
    };
  }

  return context;
}
