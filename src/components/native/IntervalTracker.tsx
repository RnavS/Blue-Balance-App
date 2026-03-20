import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

export default function IntervalTracker() {
  const { getCurrentIntervalProgress, currentProfile } = useProfile();
  const [, setNowTick] = useState(Date.now());

  if (!currentProfile) return null;
  const theme = useAppTheme(currentProfile.theme);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { current, target, timeRemaining, intervalIndex, totalIntervals } = getCurrentIntervalProgress();
  const pct = Math.min(current / Math.max(target, 1), 1);
  const mins = Math.floor(timeRemaining / 60000);
  const secs = Math.floor((timeRemaining % 60000) / 1000);
  const unit = currentProfile.unit_preference;
  const styles = createStyles(theme);

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
        <View style={[styles.fill, { width: `${pct * 100}%` as any, backgroundColor: theme.colors.primary }]} />
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    label: { fontSize: theme.fontSize.base, fontWeight: '700', color: theme.colors.text },
    meta: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
    timerBox: { alignItems: 'flex-end' },
    timerText: { fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.primary },
    timerLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
    track: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4 },
  });
