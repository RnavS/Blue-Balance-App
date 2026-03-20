import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScreenContainer from '@/components/ui/ScreenContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePremium } from '@/contexts/PremiumContext';
import { useAppTheme } from '@/theme/useAppTheme';
import { ThemePreference, useThemeMode } from '@/theme/ThemeModeContext';

const THEMES: { id: string; label: string; color: string }[] = [
  { id: 'midnight', label: 'Midnight', color: '#4f46e5' },
  { id: 'ocean', label: 'Ocean', color: '#0891b2' },
  { id: 'mint', label: 'Mint', color: '#10b981' },
  { id: 'sunset', label: 'Sunset', color: '#f97316' },
  { id: 'graphite', label: 'Graphite', color: '#64748b' },
];

const UNITS: { id: 'oz' | 'ml'; label: string }[] = [
  { id: 'oz', label: 'oz' },
  { id: 'ml', label: 'ml' },
];

const DISPLAY_MODES: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { currentProfile, updateProfile, profiles, setCurrentProfile } = useProfile();
  const { isPremium, upgradeToPremium, cancelPremium, bankConnected, bankLast4, connectBank, disconnectBank } = usePremium();
  const { themePreference, setThemePreference } = useThemeMode();

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);

  const [goalInput, setGoalInput] = useState(String(currentProfile.daily_goal ?? ''));

  const save = async (updates: any) => {
    await updateProfile(updates);
    Toast.show({ type: 'success', text1: 'Saved' });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleUpgrade = async () => {
    if (isPremium) {
      Alert.alert('Cancel Premium', 'Are you sure?', [
        { text: 'Keep Premium', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: cancelPremium },
      ]);
    } else {
      await upgradeToPremium();
      Toast.show({ type: 'success', text1: 'Premium activated' });
    }
  };

  return (
    <ScreenContainer scroll accentId={currentProfile.theme} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage profile, reminders, premium, and preferences.</Text>
      </View>

      <Section title="Profiles" theme={theme}>
        {profiles.map((p) => (
          <Pressable key={p.id} style={[styles.profileRow, currentProfile.id === p.id && styles.profileRowActive]} onPress={() => setCurrentProfile(p)}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{(p.first_name || p.username || '?').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.profileName}>{p.first_name || p.username}</Text>
              <Text style={styles.profileMeta}>{p.daily_goal} {p.unit_preference} · {p.theme}</Text>
            </View>
            {currentProfile.id === p.id && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
          </Pressable>
        ))}
      </Section>

      <Section title="Hydration" theme={theme}>
        <Row label="Daily Goal" theme={theme}>
          <TextInput
            style={styles.inlineInput}
            value={goalInput}
            onChangeText={setGoalInput}
            keyboardType="numeric"
            onBlur={() => save({ daily_goal: parseFloat(goalInput) || currentProfile.daily_goal })}
          />
          <Text style={styles.inlineUnit}>{currentProfile.unit_preference}</Text>
        </Row>

        <Row label="Unit" theme={theme}>
          <View style={styles.segmented}>
            {UNITS.map((u) => (
              <Pressable key={u.id} style={[styles.segBtn, currentProfile.unit_preference === u.id && styles.segBtnActive]} onPress={() => save({ unit_preference: u.id })}>
                <Text style={[styles.segText, currentProfile.unit_preference === u.id && styles.segTextActive]}>{u.label}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Section>

      <Section title="Schedule" theme={theme}>
        <Row label="Wake Time" theme={theme}>
          <TextInput style={styles.inlineInput} value={currentProfile.wake_time} onEndEditing={(e) => save({ wake_time: e.nativeEvent.text })} />
        </Row>
        <Row label="Sleep Time" theme={theme}>
          <TextInput style={styles.inlineInput} value={currentProfile.sleep_time} onEndEditing={(e) => save({ sleep_time: e.nativeEvent.text })} />
        </Row>
        <Row label="Reminder Interval" theme={theme}>
          <View style={styles.segmented}>
            {[30, 45, 60, 90].map((v) => (
              <Pressable key={v} style={[styles.segBtn, currentProfile.interval_length === v && styles.segBtnActive]} onPress={() => save({ interval_length: v })}>
                <Text style={[styles.segText, currentProfile.interval_length === v && styles.segTextActive]}>{v}m</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Section>

      <Section title="Notifications" theme={theme}>
        <Row label="Reminders" theme={theme}>
          <Switch value={currentProfile.reminders_enabled} onValueChange={(v) => save({ reminders_enabled: v })} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} />
        </Row>
        <Row label="Vibration" theme={theme}>
          <Switch value={currentProfile.vibration_enabled} onValueChange={(v) => save({ vibration_enabled: v })} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} />
        </Row>
      </Section>

      <Section title="Theme Accent" theme={theme}>
        {THEMES.map((t) => (
          <Pressable key={t.id} style={[styles.themeRow, currentProfile.theme === t.id && { borderColor: t.color, borderLeftWidth: 3 }]} onPress={() => save({ theme: t.id })}>
            <View style={[styles.themeCircle, { backgroundColor: t.color }]} />
            <Text style={styles.themeLabel}>{t.label}</Text>
            {currentProfile.theme === t.id && <Ionicons name="checkmark-circle" size={18} color={t.color} />}
          </Pressable>
        ))}
      </Section>

      <Section title="Appearance" theme={theme}>
        <Row label="Mode" theme={theme}>
          <View style={styles.segmented}>
            {DISPLAY_MODES.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.segBtn, themePreference === m.id && styles.segBtnActive]}
                onPress={async () => {
                  await setThemePreference(m.id);
                  Toast.show({ type: 'success', text1: `Theme set to ${m.label}` });
                }}
              >
                <Text style={[styles.segText, themePreference === m.id && styles.segTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Section>

      <Section title="Premium" theme={theme}>
        <View style={[styles.premiumCard, isPremium && styles.premiumCardActive]}>
          <View style={styles.premiumHeader}>
            <Ionicons name={isPremium ? 'star' : 'star-outline'} size={22} color={isPremium ? '#f59e0b' : theme.colors.textMuted} />
            <View style={styles.flex1}>
              <Text style={styles.premiumTitle}>{isPremium ? 'Premium Active' : 'Blue Balance Premium'}</Text>
              <Text style={styles.premiumSub}>{isPremium ? 'AI coach and advanced insights enabled' : 'Unlock AI coaching and advanced features'}</Text>
            </View>
          </View>
          <Pressable style={[styles.premiumBtn, isPremium && styles.premiumCancelBtn]} onPress={handleUpgrade}>
            <Text style={styles.premiumBtnText}>{isPremium ? 'Cancel Premium' : 'Upgrade ($4.99/mo)'}</Text>
          </Pressable>
        </View>

        {isPremium && (
          <View style={styles.bankCard}>
            <Text style={styles.bankTitle}>Bank Account</Text>
            {bankConnected ? (
              <View style={styles.bankRow}>
                <Ionicons name="card" size={18} color={theme.colors.success} />
                <Text style={styles.bankText}>Account ending in {bankLast4}</Text>
                <Pressable onPress={disconnectBank}>
                  <Text style={styles.bankUnlink}>Unlink</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.bankBtn} onPress={() => connectBank(String(Math.floor(1000 + Math.random() * 9000)))}>
                <Ionicons name="link" size={15} color={theme.colors.primary} />
                <Text style={styles.bankBtnText}>Connect Bank Account</Text>
              </Pressable>
            )}
          </View>
        )}
      </Section>

      <Section title="Account" theme={theme}>
        <Pressable style={styles.dangerRow} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.dangerText}>Sign Out</Text>
        </Pressable>
      </Section>

      <View style={styles.bottomSpacer} />
    </ScreenContainer>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const styles = createStyles(theme);
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  label,
  children,
  theme,
}: {
  label: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const styles = createStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: 120 },
    header: { marginBottom: theme.spacing.md },
    title: { fontSize: theme.fontSize.xxl + 2, color: theme.colors.text, fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
    sectionWrap: { marginBottom: theme.spacing.lg },
    sectionTitle: {
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
      color: theme.colors.textMuted,
      fontSize: theme.fontSize.xs,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    sectionCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowLabel: { color: theme.colors.text, fontSize: theme.fontSize.base, flex: 1, fontWeight: '600' },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    profileRowActive: { backgroundColor: theme.colors.softHighlight },
    profileAvatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    profileAvatarText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '800' },
    profileName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    profileMeta: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    inlineInput: {
      minWidth: 68,
      height: 34,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      textAlign: 'center',
      color: theme.colors.text,
      fontSize: theme.fontSize.sm,
      paddingHorizontal: theme.spacing.sm,
    },
    inlineUnit: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
    },
    segBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
    segBtnActive: { backgroundColor: theme.colors.softHighlight },
    segText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '700' },
    segTextActive: { color: theme.colors.primary },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    themeCircle: { width: 20, height: 20, borderRadius: 10 },
    themeLabel: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '600' },
    premiumCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, margin: theme.spacing.md, padding: theme.spacing.md, gap: theme.spacing.sm },
    premiumCardActive: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' },
    premiumHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    premiumTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '800' },
    premiumSub: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    premiumBtn: {
      height: 44,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    premiumCancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.danger },
    premiumBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
    bankCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, padding: theme.spacing.md, gap: theme.spacing.sm },
    bankTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    bankRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    bankText: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.sm },
    bankUnlink: { color: theme.colors.danger, fontSize: theme.fontSize.sm, fontWeight: '700' },
    bankBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
    bankBtnText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '700' },
    dangerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md },
    dangerText: { color: theme.colors.danger, fontSize: theme.fontSize.base, fontWeight: '700' },
    flex1: { flex: 1 },
    bottomSpacer: { height: 40 },
  });
