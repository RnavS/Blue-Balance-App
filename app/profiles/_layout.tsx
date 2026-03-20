import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

export default function ProfilesLayout() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
  });
