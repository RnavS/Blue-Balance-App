import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

export default function ProfilesLayout() {
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});
