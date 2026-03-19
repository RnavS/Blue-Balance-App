import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Modal, FlatList, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Colors, Spacing, Radius, FontSize } from '@/theme/colors';
import { globalStyles } from '@/theme/styles';
import ProgressRing from '@/components/native/ProgressRing';
import IntervalTracker from '@/components/native/IntervalTracker';
import HydrationStatus from '@/components/native/HydrationStatus';

export default function DashboardScreen() {
  const {
    currentProfile, waterLogs, addWaterLog, undoLastLog,
    beverages, addBeverage, deleteBeverage, getTodayIntake,
  } = useProfile();
  const [showBevModal, setShowBevModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSize, setNewSize] = useState('');

  if (!currentProfile) return null;

  const unit = currentProfile.unit_preference;
  const todayIntake = getTodayIntake();
  const goalPct = Math.min(todayIntake / currentProfile.daily_goal, 1) * 100;

  const rawName = currentProfile.first_name && currentProfile.first_name.length > 1
    ? currentProfile.first_name
    : currentProfile.username && currentProfile.username.length > 1
      ? currentProfile.username
      : 'there';

  const presetBevs = beverages.length > 0
    ? beverages.slice(0, 6)
    : DEFAULT_BEVERAGES.slice(0, 6).map(b => ({
        id: b.name,
        name: b.name,
        serving_size: unit === 'oz' ? b.serving_size_oz : b.serving_size_ml,
        hydration_factor: b.hydration_factor,
        icon: b.icon,
        profile_id: '',
        is_default: true,
        created_at: '',
      }));

  const todayLogs = waterLogs.filter(l => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return new Date(l.logged_at) >= d;
  });

  const handleQuickLog = useCallback((bev: typeof presetBevs[0]) => {
    addWaterLog(bev.serving_size, bev.name, bev.hydration_factor);
    Toast.show({ type: 'success', text1: `+${bev.serving_size.toFixed(0)} ${unit}`, text2: bev.name });
  }, [addWaterLog, unit]);

  const handleAddCustomBev = async () => {
    if (!newName.trim()) { Toast.show({ type: 'error', text1: 'Name required' }); return; }
    await addBeverage({ name: newName.trim(), serving_size: parseFloat(newSize) || 8, hydration_factor: 1.0, icon: 'droplet' });
    setNewName(''); setNewSize('');
    Toast.show({ type: 'success', text1: 'Beverage added!' });
  };

  return (
    <View style={globalStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Blue Balance</Text>
            <Text style={styles.greeting}>Good {getTimeOfDay()}, {rawName} 👋</Text>
          </View>
          <Pressable onPress={undoLastLog} style={styles.iconBtn} accessibilityLabel="Undo last log">
            <Ionicons name="arrow-undo-outline" size={20} color={Colors.muted} />
          </Pressable>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.glowBehind} />
          <ProgressRing
            percentage={goalPct}
            intake={todayIntake}
            goal={currentProfile.daily_goal}
            unit={unit}
          />
          <Text style={styles.heroSubtext}>
            {todayIntake >= currentProfile.daily_goal
              ? '🎉 Goal achieved!'
              : `${(currentProfile.daily_goal - todayIntake).toFixed(1)} ${unit} to go`}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <HydrationStatus />
        </View>
        <IntervalTracker />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Add</Text>
            <Pressable onPress={() => setShowBevModal(true)} style={styles.managePill}>
              <Ionicons name="settings-outline" size={13} color={Colors.primary} />
              <Text style={styles.managePillText}>Manage</Text>
            </Pressable>
          </View>

          <View style={styles.bevGrid}>
            {presetBevs.map(bev => (
              <Pressable
                key={bev.id}
                style={({ pressed }) => [styles.bevCard, pressed && styles.bevCardPressed]}
                onPress={() => handleQuickLog(bev)}
              >
                <Text style={styles.bevAmount}>{bev.serving_size.toFixed(0)}</Text>
                <Text style={styles.bevUnit}>{unit}</Text>
                <Text style={styles.bevName} numberOfLines={1}>{bev.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.logsSection]}>
          <Text style={styles.sectionTitle}>Today's Logs</Text>
          {todayLogs.length === 0 ? (
            <View style={styles.emptyLogs}>
              <Ionicons name="water-outline" size={32} color={Colors.muted} />
              <Text style={styles.emptyLogsText}>No logs yet today — tap Quick Add to start!</Text>
            </View>
          ) : (
            todayLogs.slice(0, 10).map((log, i) => (
              <View key={log.id} style={[styles.logRow, i < todayLogs.length - 1 && styles.logRowBorder]}>
                <View style={styles.logIconBox}>
                  <Ionicons name="water" size={14} color={Colors.primary} />
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logDrink}>{log.drink_type}</Text>
                  <Text style={styles.logTime}>
                    {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.logAmount}>+{log.amount.toFixed(1)} {unit}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={showBevModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBevModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalDrag} />
          <Text style={styles.modalTitle}>Manage Beverages</Text>

          <View style={styles.modalAddRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Beverage name"
              placeholderTextColor={Colors.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, { width: 80 }]}
              placeholder={unit}
              placeholderTextColor={Colors.muted}
              value={newSize}
              onChangeText={setNewSize}
              keyboardType="numeric"
            />
            <Pressable style={styles.addBtn} onPress={handleAddCustomBev}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

          <FlatList
            data={beverages}
            keyExtractor={b => b.id}
            renderItem={({ item }) => (
              <View style={styles.bevListRow}>
                <View style={styles.bevListIcon}>
                  <Ionicons name="water" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bevListName}>{item.name}</Text>
                  <Text style={styles.bevListMeta}>{item.serving_size} {unit} · {Math.round(item.hydration_factor * 100)}% hydration</Text>
                </View>
                <Pressable onPress={() => deleteBeverage(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyLogsText}>Add a custom beverage above.</Text>
            }
          />

          <Pressable style={styles.doneBtn} onPress={() => setShowBevModal(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'web' ? Spacing.xl : 60,
    paddingBottom: Spacing.sm,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.foreground,
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    position: 'relative',
  },
  glowBehind: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primaryGlow,
    opacity: 0.25,
  },
  heroSubtext: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.muted,
    fontWeight: '500',
  },

  statusRow: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },

  section: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  logsSection: {
    paddingBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.foreground,
  },
  managePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  managePillText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },

  bevGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  bevCard: {
    width: '30%',
    minWidth: 80,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  bevCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  bevAmount: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  bevUnit: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    opacity: 0.7,
    marginTop: -2,
  },
  bevName: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  logRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: { flex: 1 },
  logDrink: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.foreground },
  logTime: { fontSize: FontSize.xs, color: Colors.muted },
  logAmount: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  emptyLogs: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyLogsText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },

  modal: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalDrag: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: Spacing.lg,
  },
  modalAddRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    color: Colors.foreground,
    fontSize: FontSize.base,
  },
  addBtn: {
    width: 48, height: 48,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bevListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bevListIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bevListName: { fontSize: FontSize.base, color: Colors.foreground, fontWeight: '500' },
  bevListMeta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  deleteBtn: { padding: Spacing.xs },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: 40,
  },
  doneBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '600' },
});
