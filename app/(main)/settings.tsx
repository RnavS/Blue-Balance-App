import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePremium } from '@/contexts/PremiumContext';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';
import { globalStyles } from '@/theme/styles';

const THEMES: { id: string; label: string; color: string }[] = [
  { id: 'midnight', label: 'Midnight Purple', color: '#7c3aed' },
  { id: 'ocean', label: 'Ocean Blue', color: '#0891b2' },
  { id: 'mint', label: 'Neon Mint', color: '#10b981' },
  { id: 'sunset', label: 'Sunset', color: '#f97316' },
  { id: 'graphite', label: 'Graphite', color: '#64748b' },
];

const UNITS: { id: 'oz' | 'ml'; label: string }[] = [
  { id: 'oz', label: 'oz (fluid ounces)' },
  { id: 'ml', label: 'ml (millilitres)' },
];

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { currentProfile, updateProfile, profiles, setCurrentProfile } = useProfile();
  const { isPremium, upgradeToPremium, cancelPremium, bankConnected, bankLast4, connectBank, disconnectBank } = usePremium();

  const [saving, setSaving] = useState(false);
  const [goalInput, setGoalInput] = useState(String(currentProfile?.daily_goal ?? ''));

  if (!currentProfile) return null;

  const save = async (updates: any) => {
    setSaving(true);
    await updateProfile(updates);
    setSaving(false);
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
      Toast.show({ type: 'success', text1: 'Premium Activated!' });
    }
  };

  return (
    <ScrollView style={globalStyles.screen} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Section title="Profile">
        {profiles.map(p => (
          <Pressable
            key={p.id}
            style={[styles.profileRow, currentProfile.id === p.id && styles.profileRowActive]}
            onPress={() => setCurrentProfile(p)}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{(p.first_name || p.username || '?').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.profileName}>{p.first_name || p.username}</Text>
              <Text style={styles.profileMeta}>{p.daily_goal} {p.unit_preference} · {p.theme}</Text>
            </View>
            {currentProfile.id === p.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
          </Pressable>
        ))}
      </Section>

      <Section title="Hydration Goal">
        <Row label="Daily Goal">
          <TextInput
            style={styles.inlineInput}
            value={goalInput}
            onChangeText={setGoalInput}
            keyboardType="numeric"
            onBlur={() => save({ daily_goal: parseFloat(goalInput) || currentProfile.daily_goal })}
          />
          <Text style={styles.inlineUnit}>{currentProfile.unit_preference}</Text>
        </Row>

        <Row label="Unit Preference">
          <View style={styles.segmented}>
            {UNITS.map(u => (
              <Pressable
                key={u.id}
                style={[styles.segBtn, currentProfile.unit_preference === u.id && styles.segBtnActive]}
                onPress={() => save({ unit_preference: u.id })}
              >
                <Text style={[styles.segText, currentProfile.unit_preference === u.id && styles.segTextActive]}>{u.id}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Section>

      <Section title="Schedule">
        <Row label="Wake Time">
          <TextInput
            style={styles.inlineInput}
            value={currentProfile.wake_time}
            onEndEditing={e => save({ wake_time: e.nativeEvent.text })}
          />
        </Row>
        <Row label="Sleep Time">
          <TextInput
            style={styles.inlineInput}
            value={currentProfile.sleep_time}
            onEndEditing={e => save({ sleep_time: e.nativeEvent.text })}
          />
        </Row>
        <Row label="Reminder Interval">
          <View style={styles.segmented}>
            {[30, 45, 60, 90].map(v => (
              <Pressable
                key={v}
                style={[styles.segBtn, currentProfile.interval_length === v && styles.segBtnActive]}
                onPress={() => save({ interval_length: v })}
              >
                <Text style={[styles.segText, currentProfile.interval_length === v && styles.segTextActive]}>{v}m</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row label="Reminders Enabled">
          <Switch
            value={currentProfile.reminders_enabled}
            onValueChange={v => save({ reminders_enabled: v })}
            trackColor={{ false: Colors.border, true: Colors.primary }}
          />
        </Row>
        <Row label="Vibration">
          <Switch
            value={currentProfile.vibration_enabled}
            onValueChange={v => save({ vibration_enabled: v })}
            trackColor={{ false: Colors.border, true: Colors.primary }}
          />
        </Row>
      </Section>

      <Section title="Theme">
        {THEMES.map(t => (
          <Pressable
            key={t.id}
            style={[styles.themeRow, currentProfile.theme === t.id && { borderColor: t.color, borderLeftWidth: 3 }]}
            onPress={() => save({ theme: t.id })}
          >
            <View style={[styles.themeCircle, { backgroundColor: t.color }]} />
            <Text style={styles.themeLabel}>{t.label}</Text>
            {currentProfile.theme === t.id && <Ionicons name="checkmark-circle" size={18} color={t.color} />}
          </Pressable>
        ))}
      </Section>

      <Section title="Premium">
        <View style={[styles.premiumCard, isPremium && styles.premiumCardActive]}>
          <View style={styles.premiumHeader}>
            <Ionicons name={isPremium ? 'star' : 'star-outline'} size={24} color={isPremium ? '#f59e0b' : Colors.muted} />
            <View style={styles.flex1}>
              <Text style={styles.premiumTitle}>{isPremium ? 'Premium Active' : 'Blue Balance Premium'}</Text>
              <Text style={styles.premiumSub}>{isPremium ? 'AI Coach, advanced analytics, and more' : 'Unlock AI coaching and advanced features'}</Text>
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
                <Ionicons name="card" size={20} color={Colors.success} />
                <Text style={styles.bankText}>Account ending in {bankLast4}</Text>
                <Pressable onPress={disconnectBank}>
                  <Text style={styles.bankUnlink}>Unlink</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.bankBtn} onPress={() => connectBank(String(Math.floor(1000 + Math.random() * 9000)))}>
                <Ionicons name="link" size={16} color={Colors.primary} />
                <Text style={styles.bankBtnText}>Connect Bank Account</Text>
              </Pressable>
            )}
          </View>
        )}
      </Section>

      <Section title="Account">
        <Pressable style={styles.dangerRow} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.destructive} />
          <Text style={styles.dangerText}>Sign Out</Text>
        </Pressable>
      </Section>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.sm, color: Colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
});

const rowStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.base, color: Colors.foreground, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground },
  flex1: { flex: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileRowActive: { backgroundColor: Colors.primaryLight },
  profileAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary },
  profileAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  profileName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground },
  profileMeta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  inlineInput: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.foreground, fontSize: FontSize.base, minWidth: 60, textAlign: 'center' },
  inlineUnit: { fontSize: FontSize.sm, color: Colors.muted },
  segmented: { flexDirection: 'row', backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  segBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  segBtnActive: { backgroundColor: Colors.primary },
  segText: { fontSize: FontSize.sm, color: Colors.muted, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '600' },
  themeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  themeCircle: { width: 24, height: 24, borderRadius: 12 },
  themeLabel: { flex: 1, fontSize: FontSize.base, color: Colors.foreground },
  premiumCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.lg, gap: Spacing.md },
  premiumCardActive: { borderColor: '#f59e0b' },
  premiumHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  premiumTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.foreground },
  premiumSub: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2, lineHeight: 18 },
  premiumBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 44, alignItems: 'center', justifyContent: 'center' },
  premiumCancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.destructive },
  premiumBtnText: { color: '#fff', fontWeight: '600', fontSize: FontSize.base },
  bankCard: { marginTop: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.lg, gap: Spacing.md },
  bankTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bankText: { flex: 1, fontSize: FontSize.sm, color: Colors.foreground },
  bankUnlink: { color: Colors.destructive, fontSize: FontSize.sm },
  bankBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  bankBtnText: { color: Colors.primary, fontSize: FontSize.base, fontWeight: '500' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  dangerText: { fontSize: FontSize.base, color: Colors.destructive, fontWeight: '500' },
});
