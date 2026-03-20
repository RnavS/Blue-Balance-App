import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

const TOTAL_STEPS = 7;

const activityLevels = [
  { id: 'light' as const, label: 'Light', desc: 'Mostly sitting, minimal exercise' },
  { id: 'moderate' as const, label: 'Moderate', desc: 'Regular activity, some exercise' },
  { id: 'high' as const, label: 'High', desc: 'Very active, frequent exercise' },
];

const intervalOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hrs' },
  { value: 120, label: '2 hrs' },
];

const themeColors: Record<string, string> = {
  midnight: '#4f46e5',
  ocean: '#0891b2',
  mint: '#10b981',
  sunset: '#f97316',
  graphite: '#64748b',
};

export default function ProfileCreateScreen() {
  const router = useRouter();
  const { createProfile, setCurrentProfile, addBeverage } = useProfile();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    height_ft: '',
    height_in: '',
    weight_lb: '',
    unit_preference: 'oz' as 'oz' | 'ml',
    use_metric: false,
    wake_time: '07:00',
    sleep_time: '22:00',
    activity_level: 'moderate' as 'light' | 'moderate' | 'high',
    daily_goal: 0,
    goal_mode: 'auto' as 'auto' | 'manual',
    manual_goal: '',
    interval_length: 60,
    reminders_enabled: true,
    theme: 'midnight',
    selected_beverages: ['Water', 'Tea', 'Coffee'] as string[],
  });

  const update = (d: Partial<typeof form>) => setForm((p) => ({ ...p, ...d }));

  const convertHeight = () => {
    const ft = parseFloat(form.height_ft) || 0;
    const inch = parseFloat(form.height_in) || 0;
    return Math.round((ft * 12 + inch) * 2.54);
  };

  const convertWeight = () => {
    const lb = parseFloat(form.weight_lb);
    return lb ? Math.round(lb * 0.453592) : null;
  };

  const calcGoal = () => {
    const weightKg = convertWeight() || 70;
    const actMult = form.activity_level === 'high' ? 35 : form.activity_level === 'moderate' ? 30 : 25;
    const ml = weightKg * actMult;
    return form.unit_preference === 'oz' ? Math.round(ml / 29.5735) : Math.round(ml);
  };

  const handleSubmit = async () => {
    if (!form.first_name.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter your first name.' });
      return;
    }
    setLoading(true);

    const goal = form.goal_mode === 'auto' ? calcGoal() : parseFloat(form.manual_goal) || calcGoal();

    const profile = await createProfile({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      age: form.age ? parseInt(form.age) : null,
      height: convertHeight() || null,
      weight: convertWeight(),
      unit_preference: form.unit_preference,
      wake_time: form.wake_time,
      sleep_time: form.sleep_time,
      activity_level: form.activity_level,
      daily_goal: goal,
      interval_length: form.interval_length,
      theme: form.theme,
      reminders_enabled: form.reminders_enabled,
      reminder_interval: 30,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    } as any);

    if (!profile) {
      Toast.show({ type: 'error', text1: 'Failed to create profile', text2: 'Please try again.' });
      setLoading(false);
      return;
    }

    for (const bevName of form.selected_beverages) {
      const bev = DEFAULT_BEVERAGES.find((b) => b.name === bevName);
      if (bev) {
        await addBeverage({
          name: bev.name,
          serving_size: form.unit_preference === 'oz' ? bev.serving_size_oz : bev.serving_size_ml,
          hydration_factor: bev.hydration_factor,
          icon: bev.icon,
        });
      }
    }

    setCurrentProfile(profile);
    setLoading(false);
    router.replace('/(main)/dashboard');
  };

  const goto = (n: number) => {
    if (n < 1) {
      router.back();
      return;
    }
    if (n > TOTAL_STEPS) {
      handleSubmit();
      return;
    }
    setStep(n);
  };

  const progress = step / TOTAL_STEPS;

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => goto(step - 1)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>

          <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 1 && (
            <SurfaceCard style={styles.stepBody} accent>
              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepSub}>This personalizes your hydration coach and dashboard.</Text>
              <TextInput style={styles.input} placeholder="First Name" placeholderTextColor={theme.colors.textMuted} value={form.first_name} onChangeText={(v) => update({ first_name: v })} />
              <TextInput style={styles.input} placeholder="Last Name (optional)" placeholderTextColor={theme.colors.textMuted} value={form.last_name} onChangeText={(v) => update({ last_name: v })} />
            </SurfaceCard>
          )}

          {step === 2 && (
            <SurfaceCard style={styles.stepBody}>
              <Text style={styles.stepTitle}>Body metrics</Text>
              <Text style={styles.stepSub}>Used to estimate your ideal hydration target.</Text>

              <View style={styles.unitToggle}>
                {(['oz', 'ml'] as const).map((u) => (
                  <Pressable key={u} style={[styles.unitBtn, form.unit_preference === u && styles.unitBtnActive]} onPress={() => update({ unit_preference: u })}>
                    <Text style={[styles.unitBtnText, form.unit_preference === u && styles.unitBtnTextActive]}>{u.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Age (optional)" placeholderTextColor={theme.colors.textMuted} value={form.age} onChangeText={(v) => update({ age: v })} keyboardType="numeric" />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flex1]} placeholder="Height ft" placeholderTextColor={theme.colors.textMuted} value={form.height_ft} onChangeText={(v) => update({ height_ft: v })} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.flex1]} placeholder="Height in" placeholderTextColor={theme.colors.textMuted} value={form.height_in} onChangeText={(v) => update({ height_in: v })} keyboardType="numeric" />
              </View>
              <TextInput style={styles.input} placeholder="Weight (lbs, optional)" placeholderTextColor={theme.colors.textMuted} value={form.weight_lb} onChangeText={(v) => update({ weight_lb: v })} keyboardType="numeric" />
            </SurfaceCard>
          )}

          {step === 3 && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Activity level</Text>
              <Text style={styles.stepSub}>How active are your typical days?</Text>
              {activityLevels.map((a) => (
                <Pressable key={a.id} style={[styles.optionCard, form.activity_level === a.id && styles.optionCardActive]} onPress={() => update({ activity_level: a.id })}>
                  <Text style={[styles.optionLabel, form.activity_level === a.id && styles.optionLabelActive]}>{a.label}</Text>
                  <Text style={styles.optionDesc}>{a.desc}</Text>
                  {form.activity_level === a.id && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={styles.checkIcon} />}
                </Pressable>
              ))}
            </View>
          )}

          {step === 4 && (
            <SurfaceCard style={styles.stepBody} accent>
              <Text style={styles.stepTitle}>Daily goal</Text>
              <Text style={styles.stepSub}>Recommended: {calcGoal()} {form.unit_preference} based on your inputs.</Text>

              <View style={styles.goalModeRow}>
                {(['auto', 'manual'] as const).map((m) => (
                  <Pressable key={m} style={[styles.unitBtn, form.goal_mode === m && styles.unitBtnActive]} onPress={() => update({ goal_mode: m })}>
                    <Text style={[styles.unitBtnText, form.goal_mode === m && styles.unitBtnTextActive]}>{m === 'auto' ? 'Auto' : 'Custom'}</Text>
                  </Pressable>
                ))}
              </View>

              {form.goal_mode === 'auto' ? (
                <View style={styles.goalDisplay}>
                  <Text style={styles.goalNumber}>{calcGoal()}</Text>
                  <Text style={styles.goalUnit}>{form.unit_preference} per day</Text>
                </View>
              ) : (
                <TextInput style={styles.input} placeholder={`Goal in ${form.unit_preference}`} placeholderTextColor={theme.colors.textMuted} value={form.manual_goal} onChangeText={(v) => update({ manual_goal: v })} keyboardType="numeric" />
              )}
            </SurfaceCard>
          )}

          {step === 5 && (
            <SurfaceCard style={styles.stepBody}>
              <Text style={styles.stepTitle}>Daily schedule</Text>
              <Text style={styles.stepSub}>We'll pace hydration through your day.</Text>

              <View style={styles.timeRow}>
                <View style={styles.flex1}>
                  <Text style={styles.timeLabel}>Wake</Text>
                  <TextInput style={styles.input} value={form.wake_time} onChangeText={(v) => update({ wake_time: v })} placeholder="07:00" placeholderTextColor={theme.colors.textMuted} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.timeLabel}>Sleep</Text>
                  <TextInput style={styles.input} value={form.sleep_time} onChangeText={(v) => update({ sleep_time: v })} placeholder="22:00" placeholderTextColor={theme.colors.textMuted} />
                </View>
              </View>

              <Text style={[styles.stepSub, { marginTop: theme.spacing.md }]}>Reminder interval</Text>
              <View style={styles.chipRow}>
                {intervalOptions.map((opt) => (
                  <Pressable key={opt.value} style={[styles.chip, form.interval_length === opt.value && styles.chipActive]} onPress={() => update({ interval_length: opt.value })}>
                    <Text style={[styles.chipText, form.interval_length === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable reminders</Text>
                <Switch value={form.reminders_enabled} onValueChange={(v) => update({ reminders_enabled: v })} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} />
              </View>
            </SurfaceCard>
          )}

          {step === 6 && (
            <SurfaceCard style={styles.stepBody}>
              <Text style={styles.stepTitle}>Beverage library</Text>
              <Text style={styles.stepSub}>Select common drinks for one-tap logging.</Text>
              <View style={styles.chipRow}>
                {DEFAULT_BEVERAGES.map((b) => {
                  const selected = form.selected_beverages.includes(b.name);
                  return (
                    <Pressable
                      key={b.name}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => {
                        const next = selected ? form.selected_beverages.filter((x) => x !== b.name) : [...form.selected_beverages, b.name];
                        update({ selected_beverages: next });
                      }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{b.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>
          )}

          {step === 7 && (
            <SurfaceCard style={styles.stepBody} accent>
              <Text style={styles.stepTitle}>Theme accent</Text>
              <Text style={styles.stepSub}>Choose the accent hue for your profile.</Text>
              {Object.entries(themeColors).map(([id, color]) => (
                <Pressable key={id} style={[styles.themeCard, form.theme === id && { borderColor: color }]} onPress={() => update({ theme: id })}>
                  <View style={[styles.themeCircle, { backgroundColor: color }]} />
                  <Text style={styles.themeName}>{id.charAt(0).toUpperCase() + id.slice(1)}</Text>
                  {form.theme === id && <Ionicons name="checkmark-circle" size={20} color={color} />}
                </Pressable>
              ))}
            </SurfaceCard>
          )}

          <View style={styles.footerSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.nextBtn, loading && { opacity: 0.65 }]} onPress={() => goto(step + 1)} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step === TOTAL_STEPS ? 'Create Profile' : 'Continue'}</Text>
                <Ionicons name={step === TOTAL_STEPS ? 'checkmark' : 'arrow-forward'} size={18} color={theme.colors.onPrimary} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1 },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.colors.border,
    },
    progressFill: { height: '100%', borderRadius: 999, backgroundColor: theme.colors.primary },
    stepLabel: { width: 40, textAlign: 'right', color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: 120 },
    stepBody: { marginBottom: theme.spacing.md, gap: theme.spacing.md },
    stepTitle: { fontSize: theme.fontSize.xxl, color: theme.colors.text, fontWeight: '800', letterSpacing: -0.4 },
    stepSub: { fontSize: theme.fontSize.base, color: theme.colors.textMuted, lineHeight: 21 },
    input: {
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      height: 50,
      color: theme.colors.text,
      fontSize: theme.fontSize.base,
    },
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    flex1: { flex: 1 },
    unitToggle: { flexDirection: 'row', gap: theme.spacing.sm },
    unitBtn: {
      flex: 1,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    unitBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softHighlight },
    unitBtnText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '700' },
    unitBtnTextActive: { color: theme.colors.primary },
    optionCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      position: 'relative',
      ...theme.shadows.card,
    },
    optionCardActive: { borderColor: theme.colors.primary },
    optionLabel: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.base },
    optionLabelActive: { color: theme.colors.primary },
    optionDesc: { marginTop: 4, color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    checkIcon: { position: 'absolute', top: theme.spacing.md, right: theme.spacing.md },
    goalModeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    goalDisplay: { alignItems: 'center', paddingVertical: theme.spacing.md },
    goalNumber: { color: theme.colors.primary, fontSize: 52, fontWeight: '900', letterSpacing: -1 },
    goalUnit: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.base },
    timeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    timeLabel: { marginBottom: theme.spacing.xs, color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softHighlight },
    chipText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    chipTextActive: { color: theme.colors.primary },
    switchRow: {
      marginTop: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
    },
    switchLabel: { fontSize: theme.fontSize.base, color: theme.colors.text, fontWeight: '600' },
    themeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    themeCircle: { width: 28, height: 28, borderRadius: 14 },
    themeName: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '600' },
    footerSpacer: { height: 90 },
    footer: {
      position: 'absolute',
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      bottom: 20,
    },
    nextBtn: {
      height: 56,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      ...theme.shadows.floating,
    },
    nextBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '800' },
  });
