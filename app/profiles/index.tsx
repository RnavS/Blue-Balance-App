import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize } from '@/theme/colors';

export default function ProfilePickerScreen() {
  const router = useRouter();
  const { profiles, setCurrentProfile } = useProfile();
  const { signOut } = useAuth();

  const handleSelect = (profile: any) => {
    setCurrentProfile(profile);
    router.replace('/(main)/dashboard');
  };

  const getInitials = (p: any) => {
    const name = p.first_name || p.username || '?';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Who's tracking?</Text>
        <Text style={styles.subtitle}>Select a profile to continue</Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <Pressable style={styles.profileCard} onPress={() => handleSelect(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item)}</Text>
            </View>
            <Text style={styles.profileName}>{item.first_name || item.username}</Text>
            <Text style={styles.profileMeta}>{item.daily_goal} {item.unit_preference} goal</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.addCard} onPress={() => router.push('/profiles/create')}>
            <Ionicons name="add-circle" size={36} color={Colors.primary} />
            <Text style={styles.addText}>Add Profile</Text>
          </Pressable>
        }
      />

      <Pressable style={styles.signOutBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={16} color={Colors.muted} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.muted },
  grid: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  row: { justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md },
  profileCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  profileName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.foreground, textAlign: 'center' },
  profileMeta: { fontSize: FontSize.xs, color: Colors.muted, textAlign: 'center' },
  addCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.sm,
  },
  addText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: '500' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  signOutText: { fontSize: FontSize.sm, color: Colors.muted },
});
