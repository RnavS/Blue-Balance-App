import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile, WaterLog } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

type Filter = 'day' | 'week' | 'month';

type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

const localDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const localHourKey = (date: Date) => `${localDayKey(date)}-${String(date.getHours()).padStart(2, '0')}`;

function buildSeries(logs: WaterLog[], filter: Filter): ChartPoint[] {
  const now = new Date();

  if (filter === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const totals = new Map<string, number>();
    logs.forEach((log) => {
      const d = new Date(log.logged_at);
      if (d >= start) {
        const key = localHourKey(d);
        totals.set(key, (totals.get(key) || 0) + log.amount);
      }
    });

    const points: ChartPoint[] = [];
    for (let h = 0; h < 24; h += 3) {
      const bucket = new Date(start);
      bucket.setHours(h, 0, 0, 0);
      const keys = [0, 1, 2].map((offset) => {
        const d = new Date(bucket);
        d.setHours(h + offset, 0, 0, 0);
        return localHourKey(d);
      });
      const value = keys.reduce((sum, key) => sum + (totals.get(key) || 0), 0);
      const shortLabel = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
      points.push({ key: `${localDayKey(bucket)}-${h}`, label: shortLabel, value: Number(value.toFixed(2)) });
    }
    return points;
  }

  if (filter === 'week') {
    const totals = new Map<string, number>();
    logs.forEach((log) => {
      const key = localDayKey(new Date(log.logged_at));
      totals.set(key, (totals.get(key) || 0) + log.amount);
    });

    const points: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = localDayKey(d);
      points.push({ key, label: format(d, 'EEE'), value: Number((totals.get(key) || 0).toFixed(2)) });
    }
    return points;
  }

  const totals = new Map<string, number>();
  logs.forEach((log) => {
    const key = localDayKey(new Date(log.logged_at));
    totals.set(key, (totals.get(key) || 0) + log.amount);
  });

  const points: ChartPoint[] = [];
  for (let i = 26; i >= 0; i -= 2) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = localDayKey(d);
    points.push({ key, label: format(d, 'M/d'), value: Number((totals.get(key) || 0).toFixed(2)) });
  }
  return points;
}

function createSmoothPath(coords: { x: number; y: number }[]) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const current = coords[i];
    const cpx = (prev.x + current.x) / 2;
    path += ` Q ${cpx} ${prev.y} ${current.x} ${current.y}`;
  }
  return path;
}

function HydrationLineChart({
  points,
  filter,
  unit,
  theme,
}: {
  points: ChartPoint[];
  filter: Filter;
  unit: 'oz' | 'ml';
  theme: ReturnType<typeof useAppTheme>;
}) {
  const styles = createStyles(theme);
  const chartHeight = 180;
  const chartWidth = 100;
  const leftPad = 10;
  const rightPad = 10;
  const topPad = 16;
  const bottomPad = 26;

  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const innerW = Math.max(1, chartWidth - leftPad - rightPad);
  const innerH = chartHeight - topPad - bottomPad;

  const coords = points.map((point, idx) => {
    const x = leftPad + (idx / Math.max(points.length - 1, 1)) * innerW;
    const y = topPad + (1 - point.value / maxValue) * innerH;
    return { x, y };
  });

  const linePath = createSmoothPath(coords);
  const first = coords[0] || { x: leftPad, y: topPad + innerH };
  const last = coords[coords.length - 1] || { x: leftPad + innerW, y: topPad + innerH };
  const areaPath = `${linePath} L ${last.x} ${topPad + innerH} L ${first.x} ${topPad + innerH} Z`;
  const lineStart = theme.isDark ? '#8A97AD' : '#68758A';
  const lineEnd = theme.isDark ? '#D6DEE9' : '#51637D';
  const dotColor = theme.isDark ? '#DDF05C' : '#9AAB27';

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartHeadRow}>
        <Text style={styles.chartHeadLabel}>Hydration Trend</Text>
        <Text style={styles.chartHeadMeta}>{Math.round(maxValue)} {unit} peak</Text>
      </View>

      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hydrationArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={lineEnd} stopOpacity="0.24" />
            <Stop offset="100%" stopColor={lineEnd} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="hydrationLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={lineStart} />
            <Stop offset="100%" stopColor={lineEnd} />
          </LinearGradient>
        </Defs>

        <Path d={`M ${leftPad} ${topPad + innerH} L ${leftPad + innerW} ${topPad + innerH}`} stroke={theme.colors.border} strokeWidth={1} />
        <Path d={`M ${leftPad} ${topPad} L ${leftPad + innerW} ${topPad}`} stroke={theme.colors.border} strokeWidth={1} opacity={0.5} />

        {linePath ? <Path d={areaPath} fill="url(#hydrationArea)" /> : null}
        {linePath ? <Path d={linePath} fill="none" stroke="url(#hydrationLine)" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /> : null}

        {coords.length > 0 ? <Circle cx={last.x} cy={last.y} r={3.2} fill={dotColor} /> : null}
      </Svg>

      <View style={styles.chartLabelsRow}>
        {points.map((p, idx) => {
          const shouldShow = filter === 'day' ? idx % 2 === 0 : filter === 'week' ? true : idx % 3 === 0 || idx === points.length - 1;
          return (
            <View key={p.key} style={styles.chartLabelCell}>
              <Text style={styles.chartLabelText}>{shouldShow ? p.label : ''}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { getFilteredLogs, currentProfile, deleteWaterLog, getHydrationScore, getStreak, waterLogs } = useProfile();
  const [filter, setFilter] = useState<Filter>('week');

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);

  const logs = getFilteredLogs(filter);
  const unit = currentProfile.unit_preference;
  const totalIntake = logs.reduce((s, l) => s + l.amount, 0);
  const score = getHydrationScore();
  const streak = getStreak();
  const chartPoints = useMemo(() => buildSeries(waterLogs, filter), [waterLogs, filter]);

  return (
    <ScreenContainer accentId={currentProfile.theme}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Review your hydration patterns and progress trends.</Text>
        </View>

        <View style={styles.statsGrid}>
          <SurfaceCard style={styles.statCard} accent>
            <Text style={styles.statValue}>{totalIntake.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{unit} this {filter}</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.statCard}>
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>hydration score</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.statCard}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </SurfaceCard>
        </View>

        <View style={styles.filterRow}>
          {(['day', 'week', 'month'] as Filter[]).map((f) => (
            <Pressable key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <SurfaceCard style={styles.chartCard} accent>
          <HydrationLineChart points={chartPoints} filter={filter} unit={unit} theme={theme} />
        </SurfaceCard>

        <Text style={styles.logsTitle}>Logs</Text>
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <SurfaceCard style={styles.emptyCard}>
              <Ionicons name="water-outline" size={42} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No logs yet</Text>
              <Text style={styles.emptyText}>Switch filters or start logging from Dashboard.</Text>
            </SurfaceCard>
          }
          renderItem={({ item }) => (
            <SurfaceCard style={styles.logItem}>
              <View style={styles.logIconBox}>
                <Ionicons name="water" size={16} color={theme.colors.primary} />
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
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
              </Pressable>
            </SurfaceCard>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
    header: { marginBottom: theme.spacing.md },
    title: { fontSize: theme.fontSize.xxl + 2, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
    subtitle: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
    statsGrid: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    statCard: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 88, paddingHorizontal: theme.spacing.sm },
    statValue: { fontSize: theme.fontSize.xl, fontWeight: '900', color: theme.colors.primary },
    statLabel: { marginTop: 4, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'center' },
    filterRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 4,
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    filterBtn: { flex: 1, height: 34, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
    filterBtnActive: { backgroundColor: theme.colors.softHighlight },
    filterText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    filterTextActive: { color: theme.colors.primary, fontWeight: '700' },
    chartCard: {
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingBottom: 10,
      backgroundColor: theme.isDark ? '#101A2C' : '#EDF2F8',
      borderColor: theme.isDark ? '#1E2A42' : '#D5DEEA',
    },
    chartWrap: { width: '100%' },
    chartHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    chartHeadLabel: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    chartHeadMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    chartLabelsRow: { flexDirection: 'row', marginTop: -2 },
    chartLabelCell: { flex: 1, alignItems: 'center' },
    chartLabelText: { color: theme.colors.textMuted, fontSize: 10 },
    logsTitle: {
      color: theme.colors.text,
      fontSize: theme.fontSize.base,
      fontWeight: '700',
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    list: { paddingBottom: 130, gap: theme.spacing.sm },
    logItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    logIconBox: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    logInfo: { flex: 1 },
    logName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    logTime: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    logRight: { alignItems: 'flex-end' },
    logAmount: { color: theme.colors.primary, fontSize: theme.fontSize.base, fontWeight: '800' },
    logUnit: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    deleteBtn: { padding: theme.spacing.xs },
    emptyCard: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl, marginTop: theme.spacing.lg },
    emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', lineHeight: 20 },
  });
