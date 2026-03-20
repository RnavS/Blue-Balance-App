import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/theme/useAppTheme';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'choice' | 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [mode, setMode] = useState<AuthMode>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const validate = () => {
    try {
      emailSchema.parse(normalizedEmail);
      if (mode !== 'reset') passwordSchema.parse(password);
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        Toast.show({ type: 'error', text1: 'Validation Error', text2: err.errors[0].message });
      }
      return false;
    }
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signInWithEmail(normalizedEmail, password);
    if (error) {
      const msg = error.message.includes('Invalid login credentials') ? 'Invalid email or password.' : error.message;
      Toast.show({ type: 'error', text1: 'Sign in failed', text2: msg });
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signUpWithEmail(normalizedEmail, password);
    if (error) {
      Toast.show({ type: 'error', text1: 'Sign up failed', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Account created', text2: 'Welcome to Blue Balance.' });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await resetPassword(normalizedEmail);
    if (error) {
      Toast.show({ type: 'error', text1: 'Reset failed', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Email sent', text2: 'Check your inbox for reset instructions.' });
    }
    setLoading(false);
  };

  const title =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create account'
        : mode === 'reset'
          ? 'Reset password'
          : 'Welcome';

  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => (mode === 'choice' ? router.back() : setMode('choice'))} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="water" size={18} color={theme.colors.onPrimary} />
            </View>
            <Text style={styles.brandText}>Blue Balance</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>Simple hydration tracking built for everyday momentum.</Text>
        </View>

        {mode === 'choice' && (
          <View style={styles.choiceWrap}>
            <SurfaceCard style={styles.choiceCard} accent>
              <Text style={styles.choiceTitle}>I already have an account</Text>
              <Text style={styles.choiceBody}>Continue where you left off with your water history and goals.</Text>
              <Pressable style={styles.primaryBtn} onPress={() => setMode('signin')}>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.onPrimary} />
              </Pressable>
            </SurfaceCard>

            <SurfaceCard style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>I’m new here</Text>
              <Text style={styles.choiceBody}>Set your profile once and Blue Balance handles the rest.</Text>
              <Pressable style={styles.secondaryBtn} onPress={() => setMode('signup')}>
                <Text style={styles.secondaryBtnText}>Create Account</Text>
              </Pressable>
            </SurfaceCard>

            <Pressable style={styles.resetLinkWrap} onPress={() => setMode('reset')}>
              <Text style={styles.resetLink}>Forgot password?</Text>
            </Pressable>
          </View>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
          <SurfaceCard style={styles.formCard} accent>
            <View style={styles.modeSwitch}>
              <Pressable style={[styles.modeChip, mode === 'signin' && styles.modeChipActive]} onPress={() => setMode('signin')}>
                <Text style={[styles.modeChipText, mode === 'signin' && styles.modeChipTextActive]}>Sign In</Text>
              </Pressable>
              <Pressable style={[styles.modeChip, mode === 'signup' && styles.modeChipActive]} onPress={() => setMode('signup')}>
                <Text style={[styles.modeChipText, mode === 'signup' && styles.modeChipTextActive]}>Create</Text>
              </Pressable>
              <Pressable style={[styles.modeChip, mode === 'reset' && styles.modeChipActive]} onPress={() => setMode('reset')}>
                <Text style={[styles.modeChipText, mode === 'reset' && styles.modeChipTextActive]}>Reset</Text>
              </Pressable>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {mode !== 'reset' && (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry
                  />
                </View>
              </View>
            )}

            <Pressable
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {mode === 'signin' ? 'Continue' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.onPrimary} />
                </>
              )}
            </Pressable>
          </SurfaceCard>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    brandIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: { fontSize: theme.fontSize.base, fontWeight: '700', color: theme.colors.text },
    hero: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.lg },
    heroTitle: { fontSize: theme.fontSize.xxxl, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.6 },
    heroSubtitle: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.base, color: theme.colors.textMuted, lineHeight: 22 },
    choiceWrap: { gap: theme.spacing.md },
    choiceCard: { gap: theme.spacing.sm },
    choiceTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text },
    choiceBody: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, lineHeight: 20 },
    formCard: { gap: theme.spacing.md },
    modeSwitch: {
      flexDirection: 'row',
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      padding: 4,
      gap: 6,
    },
    modeChip: {
      flex: 1,
      borderRadius: theme.radius.full,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipActive: { backgroundColor: theme.colors.surface },
    modeChipText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    modeChipTextActive: { color: theme.colors.text },
    fieldWrap: { gap: theme.spacing.xs },
    fieldLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      height: 52,
      paddingHorizontal: theme.spacing.md,
    },
    inputIcon: { marginRight: theme.spacing.sm },
    input: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.base },
    primaryBtn: {
      height: 52,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    primaryBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
    secondaryBtn: {
      height: 48,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    secondaryBtnText: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '600' },
    resetLinkWrap: { alignItems: 'center', marginTop: theme.spacing.sm },
    resetLink: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: '600' },
  });
