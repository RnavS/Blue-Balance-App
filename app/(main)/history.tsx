import { View, Text, ScrollView, Pressable, StyleSheet, FlatList } from 'react-native';
import { useState } from 'react';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/contexts/ProfileContext';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';
import { globalStyles } from '@/theme/styles';

type Filter = 'day' | 'week' | 'month';

export default function HistoryScreen() {
  const { getFilteredLogs, currentProfile, deleteWaterLog, getHydrationScore, getStreak } = useProfile();
  const [filter, setFilter] = useState<Filter>('day');

  if (!currentProfile) return null;

  const logs = getFilteredLogs(filter);
  const unit = currentProfile.unit_preference;
  const totalIntake = logs.reduce((s, l) => s + l.amount, 0);
  const score = getHydrationScore();
  const streak = getStreak();

  return (
    <View style={globalStyles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalIntake.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{unit} total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{score}</Text>
          <Text style={styles.statLabel}>Score</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['day', 'week', 'month'] as Filter[]).map(f => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={logs}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyText}>No logs for this period</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <View style={styles.logIconBox}>
              <Ionicons name="water" size={18} color={Colors.primary} />
            </View>
            <View style={styles.logInfo}>
              <Text style={styles.logName}>{item.drink_type}</Text>
              <Text style={styles.logTime}>{format(new Date(item.logged_at), 'MMM d, h:mm a')}</Text>
            </View>
            <View style={styles.logRight}>
              <Text style={styles.logAmount}>+{item.amount.toFixed(1)}</Text>
              <Text style={styles.logUnit}>{unit}</Text>
            </View>
            <Pressable onPress={() => deleteWaterLog(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground },
  statsRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  filterBtn: { flex: 1, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, color: Colors.muted },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  logIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logInfo: { flex: 1 },
  logName: { fontSize: FontSize.base, fontWeight: '500', color: Colors.foreground },
  logTime: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  logRight: { alignItems: 'flex-end' },
  logAmount: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  logUnit: { fontSize: FontSize.xs, color: Colors.muted },
  deleteBtn: { padding: Spacing.xs },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.base, color: Colors.muted },
});
