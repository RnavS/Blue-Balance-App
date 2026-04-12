import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '@/components/ui/ScreenContainer';
import { useAppTheme } from '@/theme/useAppTheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.heroBackdrop} />
        <View style={styles.heroBlob} />

        <View style={styles.content}>
          <View style={styles.brandPill}>
            <Ionicons name="sparkles-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.brandPillText}>Hydration, reimagined</Text>
          </View>

          <View style={styles.logoBox}>
            <Ionicons name="water" size={42} color={theme.colors.onPrimary} />
          </View>

          <Text style={styles.title}>Blue Balance</Text>
          <Text style={styles.subtitle}>
            Build better hydration habits with free tracking and barcode logging, then unlock Premium AI coaching when you are ready.
          </Text>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="analytics-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.featureText}>Clear daily progress and streaks</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="scan-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.featureText}>Fast barcode + manual beverage logging</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.featureText}>Premium AI coach and unlimited barcode scans</Text>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.primaryBtnText}>Start Tracking</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.onPrimary} />
          </Pressable>

          <Text style={styles.footnote}>No setup friction. Create an account and start in under a minute.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: -80,
      right: -80,
      height: 320,
      borderBottomLeftRadius: 140,
      borderBottomRightRadius: 180,
      backgroundColor: theme.colors.backgroundElevated,
    },
    heroBlob: {
      position: 'absolute',
      top: 90,
      right: -45,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: theme.colors.primarySoft,
      opacity: theme.isDark ? 0.9 : 0.8,
    },
    content: {
      gap: theme.spacing.md,
    },
    brandPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm + 2,
      paddingVertical: theme.spacing.xs + 2,
    },
    brandPillText: {
      color: theme.colors.textMuted,
      fontSize: theme.fontSize.xs,
      fontWeight: '600',
    },
    logoBox: {
      width: 78,
      height: 78,
      borderRadius: 26,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.sm,
      ...theme.shadows.floating,
    },
    title: {
      fontSize: theme.fontSize.xxxl + 2,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.8,
      marginTop: theme.spacing.sm,
    },
    subtitle: {
      fontSize: theme.fontSize.base,
      color: theme.colors.textMuted,
      lineHeight: 23,
      maxWidth: 340,
    },
    features: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    featureIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      fontWeight: '500',
    },
    primaryBtn: {
      height: 54,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      ...theme.shadows.floating,
    },
    primaryBtnText: {
      color: theme.colors.onPrimary,
      fontSize: theme.fontSize.base,
      fontWeight: '700',
    },
    footnote: {
      textAlign: 'center',
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm,
    },
  });
