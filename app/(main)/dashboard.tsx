import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile, DEFAULT_BEVERAGES, WaterLog } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';
import ProgressRing from '@/components/native/ProgressRing';
import IntervalTracker from '@/components/native/IntervalTracker';
import HydrationStatus from '@/components/native/HydrationStatus';
import { formatCategoryLabel } from '@/utils/beverageCategory';

const toDetailLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

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

export default function DashboardScreen() {
  const {
    currentProfile,
    waterLogs,
    addWaterLog,
    undoLastLog,
    beverages,
    addBeverage,
    deleteBeverage,
    getTodayIntake,
    getFluidMix,
  } = useProfile();
  const [showBevModal, setShowBevModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSize, setNewSize] = useState('');
  const [showManualLog, setShowManualLog] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [showMixModal, setShowMixModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WaterLog | null>(null);

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);

  const unit = currentProfile.unit_preference;
  const todayIntake = getTodayIntake();
  const goalPct = Math.min(todayIntake / currentProfile.daily_goal, 1) * 100;

  const rawName =
    currentProfile.first_name && currentProfile.first_name.length > 1
      ? currentProfile.first_name
      : currentProfile.username && currentProfile.username.length > 1
        ? currentProfile.username
        : 'there';

  const presetBevs =
    beverages.length > 0
      ? beverages.slice(0, 8)
      : DEFAULT_BEVERAGES.slice(0, 8).map((b) => ({
          id: b.name,
          name: b.name,
          serving_size: unit === 'oz' ? b.serving_size_oz : b.serving_size_ml,
          hydration_factor: b.hydration_factor,
          icon: b.icon,
          profile_id: '',
          is_default: true,
          created_at: '',
        }));

  const todayLogs = waterLogs.filter((l) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return new Date(l.logged_at) >= d;
  });
  const fluidMix = useMemo(() => getFluidMix('day'), [getFluidMix]);
  const selectedLogDetails = useMemo(() => {
    if (!selectedLog?.details || typeof selectedLog.details !== 'object') return [];
    return Object.entries(selectedLog.details)
      .map(([key, value]) => ({ key, value: toDetailValue(value) }))
      .filter((entry) => entry.value.length > 0);
  }, [selectedLog]);

  const handleQuickLog = useCallback(
    (bev: (typeof presetBevs)[0]) => {
      addWaterLog(bev.serving_size, bev.name, bev.hydration_factor, { source: 'quick' });
      Toast.show({ type: 'success', text1: `${bev.name} logged`, text2: `+${bev.serving_size.toFixed(0)} ${unit}` });
    },
    [addWaterLog, unit]
  );

  const handleAddCustomBev = async () => {
    if (!newName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required' });
      return;
    }
    await addBeverage({
      name: newName.trim(),
      serving_size: parseFloat(newSize) || (unit === 'oz' ? 8 : 240),
      hydration_factor: 1.0,
      icon: 'droplet',
    });
    setNewName('');
    setNewSize('');
    Toast.show({ type: 'success', text1: 'Beverage added' });
  };

  const handleManualLog = async () => {
    if (!manualName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Enter a drink name to log manually.' });
      return;
    }
    const amount = parseFloat(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid amount', text2: `Enter a valid ${unit} amount.` });
      return;
    }
    await addWaterLog(amount, manualName.trim(), 1.0, { source: 'manual' });
    Toast.show({ type: 'success', text1: `${manualName.trim()} logged`, text2: `+${amount.toFixed(1)} ${unit}` });
    setManualName('');
    setManualAmount('');
    setShowManualLog(false);
  };

  return (
    <ScreenContainer scroll accentId={currentProfile.theme}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Hydration Overview</Text>
            <Text style={styles.title}>Hello, {rawName}</Text>
          </View>
          <Pressable style={styles.undoBtn} onPress={undoLastLog} accessibilityLabel="Undo last log">
            <Ionicons name="arrow-undo" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <SurfaceCard style={styles.heroCard} accent>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Today's progress</Text>
            <View style={styles.heroTopActions}>
              <View style={styles.goalPill}>
                <Ionicons name="flag-outline" size={12} color={theme.colors.primary} />
                <Text style={styles.goalPillText}>{currentProfile.daily_goal} {unit} goal</Text>
              </View>
              <Pressable style={styles.mixBtn} onPress={() => setShowMixModal(true)}>
                <Text style={styles.mixBtnText}>Mix</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heroBody}>
            <ProgressRing percentage={goalPct} intake={todayIntake} goal={currentProfile.daily_goal} unit={unit} accentId={currentProfile.theme} />
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{Math.max(currentProfile.daily_goal - todayIntake, 0).toFixed(0)}</Text>
                <Text style={styles.heroStatLabel}>{unit} remaining</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{Math.round(goalPct)}%</Text>
                <Text style={styles.heroStatLabel}>goal completion</Text>
              </View>
            </View>
          </View>
        </SurfaceCard>

        <HydrationStatus />
        <IntervalTracker />

        <SurfaceCard style={styles.manualPrimaryCard} accent>
          <Text style={styles.sectionTitle}>Log</Text>
          {!showManualLog ? (
            <Pressable style={styles.bigLogBtn} onPress={() => setShowManualLog(true)}>
              <Ionicons name="create-outline" size={18} color={theme.colors.onPrimary} />
              <Text style={styles.bigLogBtnText}>Log Drink Manually</Text>
            </Pressable>
          ) : (
            <View style={styles.manualLogStack}>
              <TextInput
                style={styles.input}
                placeholder="Drink name"
                placeholderTextColor={theme.colors.textMuted}
                value={manualName}
                onChangeText={setManualName}
              />
              <View style={styles.manualLogWrap}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder={`Amount in ${unit}`}
                  placeholderTextColor={theme.colors.textMuted}
                  value={manualAmount}
                  onChangeText={setManualAmount}
                  keyboardType="decimal-pad"
                />
                <Pressable style={styles.inlineLogAddBtn} onPress={handleManualLog}>
                  <Ionicons name="add" size={18} color={theme.colors.onPrimary} />
                </Pressable>
              </View>
              <Pressable style={styles.logCancelBtn} onPress={() => setShowManualLog(false)}>
                <Text style={styles.logCancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </SurfaceCard>

        <SurfaceCard style={styles.quickAddCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick add</Text>
            <Pressable style={styles.manageBtn} onPress={() => setShowBevModal(true)}>
              <Ionicons name="options-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.manageText}>Manage</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickStrip}>
            {presetBevs.map((bev) => (
              <Pressable key={bev.id} style={styles.quickChip} onPress={() => handleQuickLog(bev)}>
                <Text style={styles.quickAmount}>{bev.serving_size.toFixed(0)}</Text>
                <Text style={styles.quickUnit}>{unit}</Text>
                <Text style={styles.quickName} numberOfLines={1}>{bev.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SurfaceCard>

        <SurfaceCard style={styles.logCard}>
          <Text style={styles.sectionTitle}>Recent logs</Text>
          {todayLogs.length === 0 ? (
            <View style={styles.emptyLogs}>
              <Ionicons name="water-outline" size={28} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No entries yet for today.</Text>
            </View>
          ) : (
            todayLogs.slice(0, 8).map((log, i) => (
              <Pressable
                key={log.id}
                style={[styles.logRow, i < Math.min(todayLogs.length, 8) - 1 && styles.logBorder]}
                onPress={() => setSelectedLog(log)}
              >
                <View style={styles.logIconWrap}>
                  <Ionicons name="water" size={14} color={theme.colors.primary} />
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logDrink}>{log.drink_type}</Text>
                  <Text style={styles.logTime}>{new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.logAmount}>+{(log.raw_amount ?? log.amount).toFixed(1)} {unit}</Text>
              </Pressable>
            ))
          )}
        </SurfaceCard>

        <View style={styles.bottomSpacer} />
      </View>

      <Modal visible={showBevModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBevModal(false)}>
        <ScreenContainer accentId={currentProfile.theme}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Manage Beverages</Text>

            <View style={styles.modalAddRow}>
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholder="Beverage name"
                placeholderTextColor={theme.colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.input, styles.modalAmountInput]}
                placeholder={unit}
                placeholderTextColor={theme.colors.textMuted}
                value={newSize}
                onChangeText={setNewSize}
                keyboardType="numeric"
              />
              <Pressable style={styles.addBtn} onPress={handleAddCustomBev}>
                <Ionicons name="add" size={20} color={theme.colors.onPrimary} />
              </Pressable>
            </View>

            <FlatList
              data={beverages}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <View style={styles.bevListRow}>
                  <View style={styles.bevIconWrap}>
                    <Ionicons name="water" size={15} color={theme.colors.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.bevName}>{item.name}</Text>
                    <Text style={styles.bevMeta}>{item.serving_size} {unit} · {Math.round(item.hydration_factor * 100)}% hydration</Text>
                  </View>
                  <Pressable onPress={() => deleteBeverage(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Add your first custom beverage above.</Text>}
            />

            <Pressable style={styles.doneBtn} onPress={() => setShowBevModal(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </Modal>

      <Modal visible={showMixModal} transparent animationType="fade" onRequestClose={() => setShowMixModal(false)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeadRow}>
              <Text style={styles.detailTitle}>Fluid Mix</Text>
              <Pressable onPress={() => setShowMixModal(false)} style={styles.detailCloseBtn}>
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.detailSub}>Today by beverage category</Text>

            {fluidMix.length === 0 ? (
              <Text style={styles.emptyText}>No drinks logged yet today.</Text>
            ) : (
              fluidMix.map((item) => (
                <View key={item.category} style={styles.mixRow}>
                  <View style={styles.mixRowTop}>
                    <Text style={styles.mixName}>{formatCategoryLabel(item.category)}</Text>
                    <Text style={styles.mixPct}>{item.percentage}%</Text>
                  </View>
                  <View style={styles.mixTrack}>
                    <View style={[styles.mixFill, { width: `${Math.max(item.percentage, 4)}%` }]} />
                  </View>
                  <Text style={styles.mixMeta}>{item.amount.toFixed(1)} {unit} · {item.entries} logs</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedLog} transparent animationType="fade" onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeadRow}>
              <Text style={styles.detailTitle}>Log Detail</Text>
              <Pressable onPress={() => setSelectedLog(null)} style={styles.detailCloseBtn}>
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
                <Text style={styles.detailValue}>{(selectedLog.raw_amount ?? selectedLog.amount).toFixed(1)} {unit}</Text>

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
    container: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    eyebrow: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: '700',
    },
    title: {
      marginTop: 3,
      fontSize: theme.fontSize.xxl + 2,
      color: theme.colors.text,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    undoBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: { gap: theme.spacing.sm },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroTopActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    heroLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    goalPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 5,
    },
    goalPillText: { fontSize: theme.fontSize.xs, color: theme.colors.text, fontWeight: '600' },
    mixBtn: {
      height: 28,
      minWidth: 46,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    mixBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.xs, fontWeight: '800' },
    heroBody: { alignItems: 'center', gap: theme.spacing.sm },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
    },
    heroStatItem: { flex: 1, alignItems: 'center' },
    heroStatValue: { fontSize: theme.fontSize.xl, color: theme.colors.text, fontWeight: '800' },
    heroStatLabel: { marginTop: 2, fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
    heroStatDivider: { width: 1, height: 28, backgroundColor: theme.colors.border },
    manualPrimaryCard: { gap: theme.spacing.sm },
    bigLogBtn: {
      height: 54,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    bigLogBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '800' },
    manualLogStack: { gap: theme.spacing.sm },
    logCancelBtn: {
      height: 40,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    logCancelText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '700' },
    quickAddCard: { gap: theme.spacing.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    manageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      backgroundColor: theme.colors.softHighlight,
    },
    manageText: { fontSize: theme.fontSize.xs, color: theme.colors.primary, fontWeight: '700' },
    quickStrip: { gap: theme.spacing.sm },
    quickChip: {
      width: 92,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      backgroundColor: theme.colors.softHighlight,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
    },
    quickAmount: { color: theme.colors.primary, fontSize: theme.fontSize.xl, fontWeight: '800' },
    quickUnit: { marginTop: -2, color: theme.colors.primary, fontSize: theme.fontSize.xs, opacity: 0.8 },
    quickName: { marginTop: 4, color: theme.colors.textMuted, fontSize: theme.fontSize.xs, textAlign: 'center' },
    manualLogWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    logCard: { gap: theme.spacing.xs },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
    logBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    logIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logInfo: { flex: 1 },
    logDrink: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
    logTime: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 1 },
    logAmount: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '800' },
    emptyLogs: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
    emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center' },
    bottomSpacer: { height: 100 },
    modalWrap: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: 24 },
    modalHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.borderStrong,
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: theme.spacing.md,
    },
    modalTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800', marginBottom: theme.spacing.md },
    modalAddRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    input: {
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      height: 48,
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.text,
      fontSize: theme.fontSize.base,
    },
    flex1: { flex: 1 },
    inlineLogAddBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    modalAmountInput: { width: 84 },
    addBtn: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bevListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    bevIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bevName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '600' },
    bevMeta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 1 },
    deleteBtn: { padding: theme.spacing.xs },
    doneBtn: {
      marginTop: theme.spacing.md,
      height: 52,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    doneBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
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
    detailSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.xs },
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
    mixRow: { marginBottom: theme.spacing.sm },
    mixRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mixName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700' },
    mixPct: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '800' },
    mixTrack: {
      marginTop: 6,
      height: 8,
      borderRadius: 5,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mixFill: { height: '100%', backgroundColor: theme.colors.primary },
    mixMeta: { marginTop: 4, color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  });
