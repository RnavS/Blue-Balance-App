import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, FontSize, Spacing } from '@/theme/colors';

interface Props {
  percentage: number;
  intake: number;
  goal: number;
  unit: string;
}

export default function ProgressRing({ percentage, intake, goal, unit }: Props) {
  const size = 210;
  const strokeBg = 12;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const dash = circumference * (clampedPct / 100);
  const gap = circumference - dash;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#a855f7" />
            <Stop offset="100%" stopColor="#7c3aed" />
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeBg}
          fill="none"
          opacity={0.5}
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

const styles = StyleSheet.create({
  wrapper: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intakeValue: {
    fontSize: 44,
    fontWeight: '900',
    color: Colors.foreground,
    letterSpacing: -1,
    lineHeight: 48,
  },
  intakeUnit: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: -2,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  goalText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  pctText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
});
