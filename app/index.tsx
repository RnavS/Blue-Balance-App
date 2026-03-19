import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/theme/colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.glow1} />
      <View style={styles.glow2} />

      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Ionicons name="water" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Blue Balance</Text>

        <Text style={styles.subtitle}>
          Smart hydration tracking with AI-powered coaching
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
            <Text style={styles.featureText}>AI Tips</Text>
          </View>
          <View style={styles.dot} />
          <View style={styles.featureItem}>
            <Ionicons name="trending-up" size={16} color={Colors.primary} />
            <Text style={styles.featureText}>Progress Tracking</Text>
          </View>
        </View>

        <Pressable style={styles.button} onPress={() => router.push('/auth')}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow1: {
    position: 'absolute',
    top: '25%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primaryGlow,
    alignSelf: 'center',
    opacity: 0.4,
  },
  glow2: {
    position: 'absolute',
    bottom: '20%',
    left: '10%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(6,182,212,0.1)',
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 10,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 280,
    lineHeight: 24,
  },
  features: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  featureText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted,
    opacity: 0.5,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.xl,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
