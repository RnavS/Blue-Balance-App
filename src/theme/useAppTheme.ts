import { useMemo } from 'react';
import { createTheme } from './tokens';
import { useThemeMode } from './ThemeModeContext';

export function useAppTheme(accentId?: string) {
  const { resolvedMode } = useThemeMode();

  return useMemo(() => createTheme(resolvedMode, accentId), [resolvedMode, accentId]);
}
