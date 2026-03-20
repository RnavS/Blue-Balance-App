export type ThemeMode = 'light' | 'dark';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

type AccentSet = {
  light: string;
  dark: string;
};

const accents: Record<string, AccentSet> = {
  midnight: { light: '#1D4ED8', dark: '#6CA0FF' },
  ocean: { light: '#0E7490', dark: '#22D3EE' },
  mint: { light: '#0F766E', dark: '#2DD4BF' },
  sunset: { light: '#C2410C', dark: '#FB923C' },
  graphite: { light: '#334155', dark: '#94A3B8' },
};

const base = {
  light: {
    background: '#F4F8FF',
    backgroundElevated: '#ECF2FF',
    surface: '#FFFFFF',
    surfaceAlt: '#F2F6FF',
    border: '#D5E2FF',
    borderStrong: '#B7C9F2',
    text: '#0F172A',
    textMuted: '#64748B',
    input: '#F5F8FF',
    overlay: 'rgba(15, 23, 42, 0.18)',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    tabBar: 'rgba(255,255,255,0.94)',
    softHighlight: 'rgba(29, 78, 216, 0.08)',
  },
  dark: {
    background: '#060D1D',
    backgroundElevated: '#0B142B',
    surface: '#0F1A36',
    surfaceAlt: '#162447',
    border: '#2A3B68',
    borderStrong: '#3B4F83',
    text: '#E8EEFF',
    textMuted: '#9AAED8',
    input: '#131F3E',
    overlay: 'rgba(2, 6, 23, 0.58)',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#F87171',
    tabBar: 'rgba(8, 14, 31, 0.94)',
    softHighlight: 'rgba(108, 160, 255, 0.16)',
  },
};

export type AppTheme = ReturnType<typeof createTheme>;

export function createTheme(mode: ThemeMode, accentId?: string) {
  const neutral = base[mode];
  const accentKey = accentId && accents[accentId] ? accentId : 'midnight';
  const primary = accents[accentKey][mode];

  return {
    mode,
    isDark: mode === 'dark',
    colors: {
      background: neutral.background,
      backgroundElevated: neutral.backgroundElevated,
      surface: neutral.surface,
      surfaceAlt: neutral.surfaceAlt,
      border: neutral.border,
      borderStrong: neutral.borderStrong,
      text: neutral.text,
      textMuted: neutral.textMuted,
      input: neutral.input,
      overlay: neutral.overlay,
      success: neutral.success,
      warning: neutral.warning,
      danger: neutral.danger,
      tabBar: neutral.tabBar,
      softHighlight: neutral.softHighlight,
      primary,
      primarySoft: mode === 'dark' ? 'rgba(108, 160, 255, 0.2)' : 'rgba(29, 78, 216, 0.12)',
      primaryStrong: mode === 'dark' ? '#9CBFFF' : '#1E40AF',
      onPrimary: '#FFFFFF',
    },
    spacing: Spacing,
    radius: Radius,
    fontSize: FontSize,
    shadows: {
      card: mode === 'dark'
        ? {
            shadowColor: '#000000',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }
        : {
            shadowColor: '#1D4ED8',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          },
      glow: {
        shadowColor: primary,
        shadowOpacity: mode === 'dark' ? 0.34 : 0.18,
        shadowRadius: mode === 'dark' ? 18 : 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: mode === 'dark' ? 10 : 6,
      },
      floating: mode === 'dark'
        ? {
            shadowColor: '#000000',
            shadowOpacity: 0.45,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }
        : {
            shadowColor: '#1E293B',
            shadowOpacity: 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          },
    },
  };
}
