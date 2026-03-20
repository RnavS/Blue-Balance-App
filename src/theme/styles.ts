import { StyleSheet } from 'react-native';
import { createTheme } from '@/theme/tokens';

const fallbackTheme = createTheme('dark');

export const createGlobalStyles = (theme: ReturnType<typeof createTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex1: {
      flex: 1,
    },
    safeTop: {
      paddingTop: theme.spacing.xl,
    },
  });

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: fallbackTheme.colors.background,
  },
  card: {
    backgroundColor: fallbackTheme.colors.surface,
    borderRadius: fallbackTheme.radius.lg,
    borderWidth: 1,
    borderColor: fallbackTheme.colors.border,
    padding: fallbackTheme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: {
    flex: 1,
  },
  safeTop: {
    paddingTop: fallbackTheme.spacing.xl,
  },
});
