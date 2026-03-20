import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

interface SurfaceCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  accentId?: string;
}

export default function SurfaceCard({ children, style, accent = false, accentId }: SurfaceCardProps) {
  const theme = useAppTheme(accentId);

  return (
    <View
      style={[
        {
          backgroundColor: accent ? theme.colors.softHighlight : theme.colors.surface,
          borderWidth: 1,
          borderColor: accent ? theme.colors.primarySoft : theme.colors.border,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.md,
        },
        theme.shadows.card,
        accent && theme.shadows.glow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
