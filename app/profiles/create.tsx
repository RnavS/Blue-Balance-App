import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Colors, Spacing, Radius, FontSize } from '@/theme/colors';

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
  midnight: '#7c3aed',
  ocean: '#0891b2',
  mint: '#10b981',
  sunset: '#f97316',
  graphite: '#64748b',
};

export default function ProfileCreateScreen() {
  const router = useRouter();
  const { createProfile, setCurrentProfile, addBeverage } = useProfile();

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

  const update = (d: Partial<typeof form>) => setForm(p => ({ ...p, ...d }));

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

    const goal = form.goal_mode === 'auto' ? calcGoal() : (parseFloat(form.manual_goal) || calcGoal());

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
      const bev = DEFAULT_BEVERAGES.find(b => b.name === bevName);
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
    if (n < 1) { router.back(); return; }
    if (n > TOTAL_STEPS) { handleSubmit(); return; }
    setStep(n);
  };

  const progress = step / TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => goto(step - 1)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.muted} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSub}>Personalizes your experience</Text>
            <TextInput style={styles.input} placeholder="First Name" placeholderTextColor={Colors.muted} value={form.first_name} onChangeText={v => update({ first_name: v })} />
            <TextInput style={styles.input} placeholder="Last Name (optional)" placeholderTextColor={Colors.muted} value={form.last_name} onChangeText={v => update({ last_name: v })} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Your body metrics</Text>
            <Text style={styles.stepSub}>Used to calculate your hydration goal</Text>

            <View style={styles.unitToggle}>
              {(['oz', 'ml'] as const).map(u => (
                <Pressable
                  key={u}
                  style={[styles.unitBtn, form.unit_preference === u && styles.unitBtnActive]}
                  onPress={() => update({ unit_preference: u })}
                >
                  <Text style={[styles.unitBtnText, form.unit_preference === u && styles.unitBtnTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Age (optional)" placeholderTextColor={Colors.muted} value={form.age} onChangeText={v => update({ age: v })} keyboardType="numeric" />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flex1]} placeholder="Height ft" placeholderTextColor={Colors.muted} value={form.height_ft} onChangeText={v => update({ height_ft: v })} keyboardType="numeric" />
              <TextInput style={[styles.input, styles.flex1]} placeholder="Height in" placeholderTextColor={Colors.muted} value={form.height_in} onChangeText={v => update({ height_in: v })} keyboardType="numeric" />
            </View>
            <TextInput style={styles.input} placeholder="Weight (lbs, optional)" placeholderTextColor={Colors.muted} value={form.weight_lb} onChangeText={v => update({ weight_lb: v })} keyboardType="numeric" />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Activity level</Text>
            <Text style={styles.stepSub}>Affects your daily hydration target</Text>
            {activityLevels.map(a => (
              <Pressable
                key={a.id}
                style={[styles.optionCard, form.activity_level === a.id && styles.optionCardActive]}
                onPress={() => update({ activity_level: a.id })}
              >
                <Text style={[styles.optionLabel, form.activity_level === a.id && styles.optionLabelActive]}>{a.label}</Text>
                <Text style={styles.optionDesc}>{a.desc}</Text>
                {form.activity_level === a.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={styles.checkIcon} />}
              </Pressable>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Daily hydration goal</Text>
            <Text style={styles.stepSub}>We recommend {calcGoal()} {form.unit_preference} based on your metrics</Text>

            <View style={styles.goalModeRow}>
              {(['auto', 'manual'] as const).map(m => (
                <Pressable key={m} style={[styles.unitBtn, form.goal_mode === m && styles.unitBtnActive]} onPress={() => update({ goal_mode: m })}>
                  <Text style={[styles.unitBtnText, form.goal_mode === m && styles.unitBtnTextActive]}>{m === 'auto' ? 'Auto' : 'Custom'}</Text>
                </Pressable>
              ))}
            </View>

            {form.goal_mode === 'auto' ? (
              <View style={styles.goalDisplay}>
                <Text style={styles.goalNumber}>{calcGoal()}</Text>
                <Text style={styles.goalUnit}>{form.unit_preference} / day</Text>
              </View>
            ) : (
              <TextInput style={styles.input} placeholder={`Goal in ${form.unit_preference}`} placeholderTextColor={Colors.muted} value={form.manual_goal} onChangeText={v => update({ manual_goal: v })} keyboardType="numeric" />
            )}
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Your schedule</Text>
            <Text style={styles.stepSub}>When do you wake up and go to sleep?</Text>

            <View style={styles.timeRow}>
              <View style={styles.flex1}>
                <Text style={styles.timeLabel}>Wake Time</Text>
                <TextInput
                  style={styles.input}
                  value={form.wake_time}
                  onChangeText={v => update({ wake_time: v })}
                  placeholder="07:00"
                  placeholderTextColor={Colors.muted}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.timeLabel}>Sleep Time</Text>
                <TextInput
                  style={styles.input}
                  value={form.sleep_time}
                  onChangeText={v => update({ sleep_time: v })}
                  placeholder="22:00"
                  placeholderTextColor={Colors.muted}
                />
              </View>
            </View>

            <Text style={[styles.stepSub, { marginTop: Spacing.lg }]}>Reminder interval</Text>
            <View style={styles.chipRow}>
              {intervalOptions.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, form.interval_length === opt.value && styles.chipActive]}
                  onPress={() => update({ interval_length: opt.value })}
                >
                  <Text style={[styles.chipText, form.interval_length === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enable reminders</Text>
              <Switch value={form.reminders_enabled} onValueChange={v => update({ reminders_enabled: v })} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
          </View>
        )}

        {step === 6 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Beverage library</Text>
            <Text style={styles.stepSub}>Pick what you drink most</Text>
            <View style={styles.chipRow}>
              {DEFAULT_BEVERAGES.map(b => {
                const selected = form.selected_beverages.includes(b.name);
                return (
                  <Pressable
                    key={b.name}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => {
                      const next = selected
                        ? form.selected_beverages.filter(x => x !== b.name)
                        : [...form.selected_beverages, b.name];
                      update({ selected_beverages: next });
                    }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{b.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 7 && (
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Choose your theme</Text>
            <Text style={styles.stepSub}>Pick your preferred accent color</Text>
            {Object.entries(themeColors).map(([id, color]) => (
              <Pressable
                key={id}
                style={[styles.themeCard, form.theme === id && { borderColor: color, borderWidth: 2 }]}
                onPress={() => update({ theme: id })}
              >
                <View style={[styles.themeCircle, { backgroundColor: color }]} />
                <Text style={styles.themeName}>{id.charAt(0).toUpperCase() + id.slice(1)}</Text>
                {form.theme === id && <Ionicons name="checkmark-circle" size={20} color={color} style={styles.checkIcon} />}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, loading && { opacity: 0.6 }]}
          onPress={() => goto(step + 1)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextBtnText}>{step === TOTAL_STEPS ? 'Create Profile' : 'Continue'}</Text>
              {step < TOTAL_STEPS && <Ionicons name="arrow-forward" size={18} color="#fff" />}
              {step === TOTAL_STEPS && <Ionicons name="checkmark" size={18} color="#fff" />}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  progressTrack: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  stepLabel: { fontSize: FontSize.sm, color: Colors.muted, width: 32, textAlign: 'right' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  stepBody: { paddingTop: Spacing.lg, gap: Spacing.md },
  stepTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground },
  stepSub: { fontSize: FontSize.base, color: Colors.muted, lineHeight: 22 },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    color: Colors.foreground,
    fontSize: FontSize.base,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex1: { flex: 1 },
  unitToggle: { flexDirection: 'row', gap: Spacing.sm },
  unitBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  unitBtnText: { fontSize: FontSize.base, color: Colors.muted, fontWeight: '500' },
  unitBtnTextActive: { color: Colors.primary },
  optionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    position: 'relative',
  },
  optionCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optionLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground, marginBottom: 2 },
  optionLabelActive: { color: Colors.primary },
  optionDesc: { fontSize: FontSize.sm, color: Colors.muted },
  checkIcon: { position: 'absolute', top: Spacing.md, right: Spacing.md },
  goalModeRow: { flexDirection: 'row', gap: Spacing.sm },
  goalDisplay: { alignItems: 'center', paddingVertical: Spacing.xl },
  goalNumber: { fontSize: 56, fontWeight: '800', color: Colors.primary },
  goalUnit: { fontSize: FontSize.base, color: Colors.muted, marginTop: Spacing.xs },
  timeRow: { flexDirection: 'row', gap: Spacing.md },
  timeLabel: { fontSize: FontSize.sm, color: Colors.muted, marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.muted },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  switchLabel: { fontSize: FontSize.base, color: Colors.foreground },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  themeCircle: { width: 32, height: 32, borderRadius: 16 },
  themeName: { flex: 1, fontSize: FontSize.base, color: Colors.foreground, fontWeight: '500' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: 40,
    backgroundColor: Colors.background,
  },
  nextBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  nextBtnText: { color: '#ffffff', fontSize: FontSize.base, fontWeight: '700' },
});
