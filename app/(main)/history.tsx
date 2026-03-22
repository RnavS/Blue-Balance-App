import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile, WaterLog } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatCategoryLabel } from '@/utils/beverageCategory';

type Filter = 'day' | 'week' | 'month' | 'year';

type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toDayStart = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');
const monthKey = (date: Date) => format(date, 'yyyy-MM');

const consumedAmount = (log: WaterLog) => Number(log.raw_amount ?? log.amount);
const toDetailLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const toDetailValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
};

const buildTrendSeries = (logs: WaterLog[], filter: Filter, selectedDay: Date): ChartPoint[] => {
  const now = new Date();

  if (filter === 'day') {
    const start = toDayStart(selectedDay);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const points: ChartPoint[] = [];
    for (let h = 0; h < 24; h += 2) {
      const bucketStart = new Date(start);
      bucketStart.setHours(h, 0, 0, 0);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setHours(bucketEnd.getHours() + 2);

      const value = logs
        .filter((log) => {
          const t = new Date(log.logged_at);
          return t >= bucketStart && t < bucketEnd && t < end;
        })
        .reduce((sum, log) => sum + consumedAmount(log), 0);

      const label = h % 4 === 0 ? format(bucketStart, 'ha').toLowerCase() : '';
      points.push({ key: `${dayKey(start)}-${h}`, label, value: Number(value.toFixed(2)) });
    }
    return points;
  }

  if (filter === 'week') {
    const totals = new Map<string, number>();
    logs.forEach((log) => {
      const key = dayKey(new Date(log.logged_at));
      totals.set(key, (totals.get(key) || 0) + consumedAmount(log));
    });

    const points: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = toDayStart(new Date(now));
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      points.push({ key, label: format(d, 'EEE'), value: Number((totals.get(key) || 0).toFixed(2)) });
    }
    return points;
  }

  if (filter === 'month') {
    const totals = new Map<string, number>();
    logs.forEach((log) => {
      const key = dayKey(new Date(log.logged_at));
      totals.set(key, (totals.get(key) || 0) + consumedAmount(log));
    });

    const points: ChartPoint[] = [];
    for (let i = 28; i >= 0; i -= 2) {
      const d = toDayStart(new Date(now));
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      points.push({ key, label: format(d, 'M/d'), value: Number((totals.get(key) || 0).toFixed(2)) });
    }
    return points;
  }

  const totals = new Map<string, number>();
  logs.forEach((log) => {
    const d = new Date(log.logged_at);
    const key = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
    totals.set(key, (totals.get(key) || 0) + consumedAmount(log));
  });

  const points: ChartPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    points.push({ key, label: format(d, 'MMM'), value: Number((totals.get(key) || 0).toFixed(2)) });
  }
  return points;
};

const buildDayBars = (logs: WaterLog[], day: Date): ChartPoint[] => {
  const start = toDayStart(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const points: ChartPoint[] = [];
  for (let h = 0; h < 24; h += 3) {
    const bucketStart = new Date(start);
    bucketStart.setHours(h, 0, 0, 0);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setHours(bucketEnd.getHours() + 3);

    const value = logs
      .filter((log) => {
        const t = new Date(log.logged_at);
        return t >= bucketStart && t < bucketEnd && t < end;
      })
      .reduce((sum, log) => sum + consumedAmount(log), 0);

    points.push({
      key: `${dayKey(start)}-${h}`,
      label: format(bucketStart, 'ha').toLowerCase(),
      value: Number(value.toFixed(2)),
    });
  }

  return points;
};

const buildCalendarCells = (monthCursor: Date): Array<Date | null> => {
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const startPadding = firstDay.getDay();
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPadding; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const createSmoothPath = (coords: { x: number; y: number }[]) => {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const current = coords[i];
    const cp1x = prev.x + (current.x - prev.x) * 0.5;
    const cp1y = prev.y;
    path += ` Q ${cp1x} ${cp1y} ${current.x} ${current.y}`;
  }
  return path;
};

function StockLineChart({ points, unit, theme }: { points: ChartPoint[]; unit: 'oz' | 'ml'; theme: ReturnType<typeof useAppTheme> }) {
  const styles = createStyles(theme);
  const chartHeight = 192;
  const chartWidth = 100;
  const leftPad = 8;
  const rightPad = 8;
  const topPad = 16;
  const bottomPad = 28;

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

  const highlightIndex = points.reduce((bestIdx, point, idx, arr) => {
    if (arr[bestIdx]?.value === undefined || point.value > arr[bestIdx].value) return idx;
    return bestIdx;
  }, 0);
  const highlightPoint = points[highlightIndex];
  const highlightCoord = coords[highlightIndex];

  return (
    <View style={styles.stockWrap}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="stockBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? '#2A87C5' : '#56B7E8'} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={theme.isDark ? '#1E5E8C' : '#3AA8DD'} stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="stockArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={chartWidth} height={chartHeight} rx="8" fill="url(#stockBg)" />
        {linePath ? <Path d={areaPath} fill="url(#stockArea)" /> : null}
        {linePath ? <Path d={linePath} fill="none" stroke="#F7FCFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}

        {highlightCoord && highlightPoint ? (
          <>
            <Circle cx={highlightCoord.x} cy={highlightCoord.y} r={3.2} fill="#D9FF66" />
            <Rect x={Math.max(2, highlightCoord.x - 10)} y={Math.max(2, highlightCoord.y - 16)} width={20} height={10} rx={4} fill="#FFFFFF" opacity={0.98} />
          </>
        ) : null}
      </Svg>

      <View style={styles.stockValuePillWrap}>
        <View style={styles.stockValuePill}>
          <Text style={styles.stockValueText}>{highlightPoint ? `${highlightPoint.value.toFixed(1)}${unit}` : `0${unit}`}</Text>
        </View>
      </View>

      <View style={styles.stockLabelsRow}>
        {points.map((p, idx) => (
          <View key={p.key} style={styles.stockLabelCell}>
            <Text style={styles.stockLabelText}>{idx % 2 === 0 || idx === points.length - 1 ? p.label : ''}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DayBarChart({ points, unit, theme }: { points: ChartPoint[]; unit: 'oz' | 'ml'; theme: ReturnType<typeof useAppTheme> }) {
  const styles = createStyles(theme);
  const maxValue = Math.max(1, ...points.map((p) => p.value));

  return (
    <View style={styles.barChartWrap}>
      <View style={styles.barChartRow}>
        {points.map((p) => {
          const hPct = Math.max(4, (p.value / maxValue) * 100);
          return (
            <View key={p.key} style={styles.barCell}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${hPct}%` }]} />
              </View>
              <Text style={styles.barLabel}>{p.label}</Text>
              <Text style={styles.barValue}>{p.value > 0 ? p.value.toFixed(0) : '0'}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.barUnitHint}>{unit} in 3-hour buckets</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { getFilteredLogs, getFluidMix, currentProfile, deleteWaterLog, getHydrationScore, getStreak, waterLogs } = useProfile();
  const [filter, setFilter] = useState<Filter>('week');
  const [monthCursor, setMonthCursor] = useState(toDayStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(toDayStart(new Date()));
  const [selectedLog, setSelectedLog] = useState<WaterLog | null>(null);

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);

  const selectedDayRange = useMemo(() => {
    const start = toDayStart(selectedDay);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [selectedDay]);

  const logs = useMemo(() => {
    if (filter === 'day') return getFilteredLogs('custom', selectedDayRange);
    return getFilteredLogs(filter);
  }, [filter, getFilteredLogs, selectedDayRange]);

  const fluidMix = useMemo(() => {
    if (filter === 'day') return getFluidMix('custom', selectedDayRange);
    return getFluidMix(filter);
  }, [filter, getFluidMix, selectedDayRange]);

  const unit = currentProfile.unit_preference;
  const totalIntake = logs.reduce((s, l) => s + consumedAmount(l), 0);
  const score = getHydrationScore();
  const streak = getStreak();
  const chartPoints = useMemo(() => buildTrendSeries(waterLogs, filter, selectedDay), [waterLogs, filter, selectedDay]);
  const dayBars = useMemo(() => buildDayBars(waterLogs, selectedDay), [waterLogs, selectedDay]);
  const calendarCells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);
  const selectedLogDetails = useMemo(() => {
    if (!selectedLog?.details || typeof selectedLog.details !== 'object') return [];
    return Object.entries(selectedLog.details)
      .map(([key, value]) => ({ key, value: toDetailValue(value) }))
      .filter((entry) => entry.value.length > 0);
  }, [selectedLog]);

  return (
    <ScreenContainer scroll accentId={currentProfile.theme}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Track hydration by date, range, and drink makeup.</Text>
        </View>

        <View style={styles.statsGrid}>
          <SurfaceCard style={styles.statCard} accent>
            <Text style={styles.statValue}>{totalIntake.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{unit} consumed</Text>
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
          {(['day', 'week', 'month', 'year'] as Filter[]).map((f) => (
            <Pressable key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <SurfaceCard style={styles.calendarCard}>
          <View style={styles.calendarHead}>
            <Pressable style={styles.calendarNavBtn} onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} />
            </Pressable>
            <Text style={styles.calendarTitle}>{format(monthCursor, 'MMMM yyyy')}</Text>
            <Pressable style={styles.calendarNavBtn} onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.weekHeaderRow}>
            {WEEKDAY_LABELS.map((d, idx) => (
              <Text key={`${d}-${idx}`} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((date, idx) => {
              if (!date) return <View key={`blank-${idx}`} style={styles.calendarCell} />;
              const isSelected = dayKey(date) === dayKey(selectedDay);
              const isToday = dayKey(date) === dayKey(new Date());
              return (
                <Pressable
                  key={dayKey(date)}
                  style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                  onPress={() => {
                    setSelectedDay(toDayStart(date));
                    setFilter('day');
                  }}
                >
                  <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected, isToday && !isSelected && styles.calendarCellTodayText]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.barCard}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>Day Bars</Text>
            <Text style={styles.cardSub}>{format(selectedDay, 'MMM d')}</Text>
          </View>
          <DayBarChart points={dayBars} unit={unit} theme={theme} />
        </SurfaceCard>

        <SurfaceCard style={styles.chartCard} accent>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>Trend</Text>
            <Text style={styles.cardSub}>{Math.round(Math.max(1, ...chartPoints.map((p) => p.value)))} {unit} peak</Text>
          </View>
          <StockLineChart points={chartPoints} unit={unit} theme={theme} />
        </SurfaceCard>

        <SurfaceCard style={styles.mixCard}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>Fluid Makeup</Text>
            <Text style={styles.cardSub}>Grouped by category</Text>
          </View>
          {fluidMix.length === 0 ? (
            <Text style={styles.emptyText}>No fluid mix data yet for this range.</Text>
          ) : (
            fluidMix.slice(0, 5).map((item) => (
              <View key={item.category} style={styles.mixRow}>
                <View style={styles.mixRowTop}>
                  <Text style={styles.mixName}>{formatCategoryLabel(item.category)}</Text>
                  <Text style={styles.mixPct}>{item.percentage}%</Text>
                </View>
                <View style={styles.mixTrack}>
                  <View style={[styles.mixFill, { width: `${Math.max(item.percentage, 4)}%` }]} />
                </View>
              </View>
            ))
          )}
        </SurfaceCard>

        <Text style={styles.logsTitle}>Logs</Text>
        <View style={styles.logsWrap}>
          {logs.length === 0 ? (
            <SurfaceCard style={styles.emptyCard}>
              <Ionicons name="water-outline" size={42} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No logs yet</Text>
              <Text style={styles.emptyText}>Switch range or log from Dashboard/Scan.</Text>
            </SurfaceCard>
          ) : (
            logs.map((item) => (
              <SurfaceCard key={item.id} style={styles.logItem}>
                <Pressable style={styles.logMainPress} onPress={() => setSelectedLog(item)}>
                  <View style={styles.logIconBox}>
                    <Ionicons name="water" size={16} color={theme.colors.primary} />
                  </View>
                  <View style={styles.logInfo}>
                    <Text style={styles.logName}>{item.drink_type || 'Water'}</Text>
                    <Text style={styles.logTime}>{format(new Date(item.logged_at), 'MMM d, h:mm a')}</Text>
                  </View>
                  <View style={styles.logRight}>
                    <Text style={styles.logAmount}>+{consumedAmount(item).toFixed(1)}</Text>
                    <Text style={styles.logUnit}>{unit}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => deleteWaterLog(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                </Pressable>
              </SurfaceCard>
            ))
          )}
        </View>
      </View>

      <Modal visible={!!selectedLog} transparent animationType="fade" onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeadRow}>
              <Text style={styles.detailTitle}>Log Detail</Text>
              <Pressable style={styles.detailCloseBtn} onPress={() => setSelectedLog(null)}>
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {selectedLog && (
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>Fluid</Text>
                <Text style={styles.detailValue}>{selectedLog.drink_type || 'Water'}</Text>

                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{formatCategoryLabel(selectedLog.category || 'other')}</Text>

                <Text style={styles.detailLabel}>Consumed</Text>
                <Text style={styles.detailValue}>{consumedAmount(selectedLog).toFixed(1)} {unit}</Text>

                <Text style={styles.detailLabel}>Hydration Credit</Text>
                <Text style={styles.detailValue}>{selectedLog.amount.toFixed(1)} {unit}</Text>

                <Text style={styles.detailLabel}>Source</Text>
                <Text style={styles.detailValue}>{selectedLog.source || 'manual'}</Text>

                {selectedLog.barcode ? (
                  <>
                    <Text style={styles.detailLabel}>Barcode</Text>
                    <Text style={styles.detailValue}>{selectedLog.barcode}</Text>
                  </>
                ) : null}

                <Text style={styles.detailLabel}>Logged</Text>
                <Text style={styles.detailValue}>{new Date(selectedLog.logged_at).toLocaleString()}</Text>

                {selectedLogDetails.length > 0 ? (
                  <>
                    <Text style={styles.detailLabel}>Scan details</Text>
                    {selectedLogDetails.map((entry) => (
                      <View key={entry.key} style={styles.detailKvRow}>
                        <Text style={styles.detailKvLabel}>{toDetailLabel(entry.key)}</Text>
                        <Text style={styles.detailKvValue}>{entry.value}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
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

    calendarCard: { marginBottom: theme.spacing.md, gap: theme.spacing.sm },
    calendarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    calendarNavBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.input,
    },
    calendarTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    weekHeaderRow: { flexDirection: 'row' },
    weekdayLabel: { flex: 1, textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    calendarCellSelected: { backgroundColor: theme.colors.primary },
    calendarCellText: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
    calendarCellTextSelected: { color: theme.colors.onPrimary, fontWeight: '800' },
    calendarCellTodayText: { color: theme.colors.primary, fontWeight: '800' },

    cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
    cardTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    cardSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },

    barCard: { marginBottom: theme.spacing.md },
    barChartWrap: { gap: theme.spacing.xs },
    barChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 134 },
    barCell: { flex: 1, alignItems: 'center', gap: 3 },
    barTrack: {
      width: '100%',
      height: 94,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      backgroundColor: theme.colors.primary,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    barLabel: { color: theme.colors.textMuted, fontSize: 10 },
    barValue: { color: theme.colors.text, fontSize: 10, fontWeight: '700' },
    barUnitHint: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },

    chartCard: {
      marginBottom: theme.spacing.md,
      backgroundColor: theme.isDark ? '#11233C' : '#DCF2FF',
      borderColor: theme.isDark ? '#1E3553' : '#B6DFF6',
      gap: theme.spacing.xs,
    },
    stockWrap: { width: '100%' },
    stockValuePillWrap: { position: 'absolute', top: 8, left: 10 },
    stockValuePill: {
      backgroundColor: '#FFFFFF',
      borderRadius: theme.radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    stockValueText: { color: '#304F69', fontSize: theme.fontSize.xs, fontWeight: '800' },
    stockLabelsRow: { flexDirection: 'row', marginTop: 4 },
    stockLabelCell: { flex: 1, alignItems: 'center' },
    stockLabelText: { color: theme.isDark ? '#D5E9FF' : '#2C5E80', fontSize: 10, fontWeight: '600' },

    mixCard: { marginBottom: theme.spacing.md },
    mixRow: { marginBottom: theme.spacing.sm },
    mixRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mixName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700' },
    mixPct: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '800' },
    mixTrack: {
      marginTop: 5,
      height: 8,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
    },
    mixFill: { height: '100%', backgroundColor: theme.colors.primary },

    logsTitle: {
      color: theme.colors.text,
      fontSize: theme.fontSize.base,
      fontWeight: '700',
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    logsWrap: { paddingBottom: 130, gap: theme.spacing.sm },
    logItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    logMainPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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

    detailBackdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    detailCard: {
      width: '100%',
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      ...theme.shadows.floating,
    },
    detailHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
    detailCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    detailBody: { gap: 2, marginTop: 2 },
    detailLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
    detailValue: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    detailKvRow: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
    },
    detailKvLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.fontSize.xs,
      fontWeight: '700',
    },
    detailKvValue: {
      marginTop: 1,
      color: theme.colors.text,
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
    },
  });
