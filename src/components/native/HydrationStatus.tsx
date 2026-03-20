import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

export default function HydrationStatus() {
  const { getTodayIntake, getExpectedIntake, isOnTrack, currentProfile } = useProfile();

  if (!currentProfile) return null;
  const theme = useAppTheme(currentProfile.theme);

  const intake = getTodayIntake();
  const expected = getExpectedIntake();
  const onTrack = isOnTrack();
  const remaining = Math.max(0, currentProfile.daily_goal - intake);
  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: onTrack ? theme.colors.softHighlight : theme.isDark ? 'rgba(248,113,113,0.12)' : 'rgba(248,113,113,0.1)',
          borderColor: onTrack ? theme.colors.primarySoft : theme.colors.danger,
        },
      ]}
    >
      <Ionicons
        name={onTrack ? 'checkmark-circle' : 'alert-circle'}
        size={20}
        color={onTrack ? theme.colors.primary : theme.colors.danger}
      />
      <View style={styles.text}>
        <Text style={styles.status}>{onTrack ? 'On Track!' : 'Behind Pace'}</Text>
        <Text style={styles.detail}>
          {remaining > 0 ? `${remaining.toFixed(1)} ${currentProfile.unit_preference} remaining` : 'Goal met today!'}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
    },
    text: { flex: 1 },
    status: { fontSize: theme.fontSize.base, fontWeight: '700', color: theme.colors.text },
    detail: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2 },
  });
