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
  const {
    isPremium,
    productId,
    priceId,
    platform,
    expiresAt,
    willRenew,
    scansUsedThisMonth,
    scansLimitThisMonth,
    purchasePremium,
    openManageSubscription,
    refreshPremium,
    loading: premiumLoading,
  } = usePremium();
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

  const handlePurchase = async (packageType: 'monthly' | 'annual') => {
    try {
      await purchasePremium(packageType);
      Toast.show({
        type: 'success',
        text1: packageType === 'monthly' ? 'Monthly checkout opened' : 'Annual checkout opened',
      });
    } catch (error) {
      Alert.alert('Premium checkout', error instanceof Error ? error.message : 'Unable to start checkout.');
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openManageSubscription();
    } catch (error) {
      Alert.alert('Manage subscription', error instanceof Error ? error.message : 'Unable to open billing portal.');
    }
  };

  const handleRefreshPremium = async () => {
    try {
      await refreshPremium();
      Toast.show({ type: 'success', text1: 'Premium status refreshed' });
    } catch (error) {
      Alert.alert('Refresh Premium', error instanceof Error ? error.message : 'Unable to refresh premium status.');
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
              <Text style={styles.premiumSub}>
                {isPremium
                  ? 'Unlimited barcode scans and AI coaching are unlocked.'
                  : 'Premium unlocks AI coaching and unlimited barcode scans.'}
              </Text>
            </View>
          </View>

          {isPremium ? (
            <>
              <View style={styles.premiumMetaList}>
                <View style={styles.premiumMetaRow}>
                  <Text style={styles.premiumMetaLabel}>Source</Text>
                  <Text style={styles.premiumMetaValue}>{platform === 'stripe' ? 'Stripe Checkout' : 'Not connected'}</Text>
                </View>
                <View style={styles.premiumMetaRow}>
                  <Text style={styles.premiumMetaLabel}>Product</Text>
                  <Text style={styles.premiumMetaValue}>{productId ?? 'Premium subscription'}</Text>
                </View>
                {priceId ? (
                  <View style={styles.premiumMetaRow}>
                    <Text style={styles.premiumMetaLabel}>Price ID</Text>
                    <Text style={styles.premiumMetaValue}>{priceId}</Text>
                  </View>
                ) : null}
                <View style={styles.premiumMetaRow}>
                  <Text style={styles.premiumMetaLabel}>Billing</Text>
                  <Text style={styles.premiumMetaValue}>
                    {willRenew === true ? 'Renews automatically' : willRenew === false ? 'Ends at expiration' : 'Awaiting sync'}
                  </Text>
                </View>
                {expiresAt ? (
                  <View style={styles.premiumMetaRow}>
                    <Text style={styles.premiumMetaLabel}>Expires</Text>
                    <Text style={styles.premiumMetaValue}>{new Date(expiresAt).toLocaleDateString()}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.premiumActionRow}>
                <Pressable
                  style={[styles.premiumBtn, premiumLoading && styles.disabledBtn]}
                  onPress={handleManageSubscription}
                  disabled={premiumLoading}
                >
                  <Text style={styles.premiumBtnText}>Manage</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryBtn, premiumLoading && styles.disabledBtn]}
                  onPress={handleRefreshPremium}
                  disabled={premiumLoading}
                >
                  <Text style={styles.secondaryBtnText}>Refresh</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.freeTierCard}>
                <Text style={styles.freeTierTitle}>Free tier</Text>
                <Text style={styles.freeTierText}>Manual beverage logging and hydration tracking stay free.</Text>
                <Text style={styles.freeTierText}>AI coach is Premium only.</Text>
                <Text style={styles.freeTierText}>
                  Barcode lookup: {scansUsedThisMonth}/{scansLimitThisMonth ?? 5} used this month.
                </Text>
              </View>

              <View style={styles.premiumActionRow}>
                <Pressable
                  style={[styles.premiumBtn, premiumLoading && styles.disabledBtn]}
                  onPress={() => handlePurchase('monthly')}
                  disabled={premiumLoading}
                >
                  <Text style={styles.premiumBtnText}>$4.99/mo</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryBtn, premiumLoading && styles.disabledBtn]}
                  onPress={() => handlePurchase('annual')}
                  disabled={premiumLoading}
                >
                  <Text style={styles.secondaryBtnText}>$39.99/yr</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
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
    premiumMetaList: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
    premiumMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    premiumMetaLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
    premiumMetaValue: { flex: 1, textAlign: 'right', color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
    premiumActionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    premiumBtn: {
      flex: 1,
      height: 44,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    premiumBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      height: 44,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surfaceAlt,
    },
    secondaryBtnText: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    disabledBtn: { opacity: 0.6 },
    freeTierCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      padding: theme.spacing.sm,
      gap: 6,
      marginTop: theme.spacing.xs,
    },
    freeTierTitle: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '800' },
    freeTierText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, lineHeight: 19 },
    dangerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md },
    dangerText: { color: theme.colors.danger, fontSize: theme.fontSize.base, fontWeight: '700' },
    flex1: { flex: 1 },
    bottomSpacer: { height: 40 },
  });
