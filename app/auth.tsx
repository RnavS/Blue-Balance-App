import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize } from '@/theme/colors';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'choice' | 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    try {
      emailSchema.parse(email);
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
    const { error } = await signInWithEmail(email, password);
    if (error) {
      const msg = error.message.includes('Invalid login credentials') ? 'Invalid email or password.' : error.message;
      Toast.show({ type: 'error', text1: 'Sign in failed', text2: msg });
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      Toast.show({ type: 'error', text1: 'Sign up failed', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Check your email', text2: 'We sent a confirmation link.' });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      Toast.show({ type: 'error', text1: 'Reset failed', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Email sent', text2: 'Check your inbox for reset instructions.' });
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => mode === 'choice' ? router.back() : setMode('choice')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.muted} />
          </Pressable>
          <View style={styles.logoRow}>
            <Ionicons name="water" size={32} color={Colors.primary} />
            <Text style={styles.logoText}>Blue Balance</Text>
          </View>
        </View>

        {mode === 'choice' && (
          <View style={styles.body}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your hydration journey</Text>

            <Pressable style={styles.primaryBtn} onPress={() => setMode('signin')}>
              <Ionicons name="mail" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Sign in with Email</Text>
            </Pressable>

            <Pressable style={styles.ghostBtn} onPress={() => setMode('signup')}>
              <Text style={styles.ghostBtnText}>Create account</Text>
            </Pressable>

            <Pressable onPress={() => setMode('reset')}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
          </View>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
          <View style={styles.body}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={Colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {mode !== 'reset' && (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={Colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    placeholderTextColor={Colors.muted}
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
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xxl, marginTop: Spacing.xl },
  backBtn: { marginRight: Spacing.md, padding: Spacing.xs },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.foreground },
  body: { flex: 1, gap: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.muted, lineHeight: 22, marginBottom: Spacing.md },
  field: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, color: Colors.muted, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, color: Colors.foreground, fontSize: FontSize.base },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: '#ffffff', fontSize: FontSize.base, fontWeight: '600' },
  ghostBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: Colors.foreground, fontSize: FontSize.base, fontWeight: '500' },
  linkText: { color: Colors.primary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
});
