import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/contexts/ProfileContext';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';

export default function HydrationStatus() {
  const { getTodayIntake, getExpectedIntake, isOnTrack, currentProfile } = useProfile();

  if (!currentProfile) return null;

  const intake = getTodayIntake();
  const expected = getExpectedIntake();
  const onTrack = isOnTrack();
  const remaining = Math.max(0, currentProfile.daily_goal - intake);

  return (
    <View style={[styles.container, { backgroundColor: onTrack ? Colors.primaryLight : 'rgba(239,68,68,0.1)' }]}>
      <Ionicons
        name={onTrack ? 'checkmark-circle' : 'alert-circle'}
        size={20}
        color={onTrack ? Colors.primary : Colors.destructive}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  text: { flex: 1 },
  status: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground },
  detail: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
});
