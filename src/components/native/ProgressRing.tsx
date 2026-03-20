import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '@/theme/useAppTheme';

interface Props {
  percentage: number;
  intake: number;
  goal: number;
  unit: string;
  accentId?: string;
}

export default function ProgressRing({ percentage, intake, goal, unit, accentId }: Props) {
  const theme = useAppTheme(accentId);
  const size = 198;
  const strokeBg = 10;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const dash = circumference * (clampedPct / 100);
  const gap = circumference - dash;
  const styles = createStyles(theme);

  return (
    <View style={styles.wrapper}>
      <View style={styles.halo} />
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.colors.primaryStrong} />
            <Stop offset="100%" stopColor={theme.colors.primary} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border}
          strokeWidth={strokeBg}
          fill="none"
          opacity={0.8}
        />

        {clampedPct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />
        )}
      </Svg>

      <View style={styles.center}>
        <Text style={styles.intakeValue}>{intake.toFixed(0)}</Text>
        <Text style={styles.intakeUnit}>{unit}</Text>
        <View style={styles.divider} />
        <Text style={styles.goalText}>of {goal} {unit}</Text>
        <Text style={styles.pctText}>{Math.round(clampedPct)}%</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrapper: {
      width: 198,
      height: 198,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    halo: {
      position: 'absolute',
      width: 168,
      height: 168,
      borderRadius: 84,
      backgroundColor: theme.colors.primarySoft,
      opacity: theme.isDark ? 0.75 : 1,
    },
    center: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    intakeValue: {
      fontSize: 42,
      fontWeight: '900',
      color: theme.colors.text,
      letterSpacing: -1,
      lineHeight: 46,
    },
    intakeUnit: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      marginTop: -2,
    },
    divider: {
      width: 34,
      height: 1,
      backgroundColor: theme.colors.borderStrong,
      marginVertical: 6,
    },
    goalText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
    },
    pctText: {
      fontSize: theme.fontSize.base,
      fontWeight: '700',
      color: theme.colors.primary,
      marginTop: 2,
    },
  });
