import { ReactNode } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/useAppTheme';

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  accentId?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function ScreenContainer({
  children,
  scroll = false,
  accentId,
  style,
  contentContainerStyle,
  testID,
}: ScreenContainerProps) {
  const theme = useAppTheme(accentId);

  if (scroll) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} edges={['top', 'left', 'right']} testID={testID}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} edges={['top', 'left', 'right']} testID={testID}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}
