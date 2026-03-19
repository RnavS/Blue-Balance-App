import { View, Text, StyleSheet } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';

export default function IntervalTracker() {
  const { getCurrentIntervalProgress, currentProfile } = useProfile();

  if (!currentProfile) return null;

  const { current, target, timeRemaining, intervalIndex, totalIntervals } = getCurrentIntervalProgress();
  const pct = Math.min(current / Math.max(target, 1), 1);
  const mins = Math.floor(timeRemaining / 60000);
  const secs = Math.floor((timeRemaining % 60000) / 1000);
  const unit = currentProfile.unit_preference;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Interval {intervalIndex + 1} of {totalIntervals}</Text>
          <Text style={styles.meta}>{current.toFixed(1)} / {target.toFixed(1)} {unit}</Text>
        </View>
        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{mins}:{String(secs).padStart(2, '0')}</Text>
          <Text style={styles.timerLabel}>remaining</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground },
  meta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  timerBox: { alignItems: 'flex-end' },
  timerText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  timerLabel: { fontSize: FontSize.xs, color: Colors.muted },
  track: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
});
