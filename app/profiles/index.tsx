import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/theme/useAppTheme';

export default function ProfilePickerScreen() {
  const router = useRouter();
  const { profiles, setCurrentProfile } = useProfile();
  const { signOut } = useAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const handleSelect = (profile: any) => {
    setCurrentProfile(profile);
    router.replace('/(main)/dashboard');
  };

  const getInitials = (p: any) => {
    const name = p.first_name || p.username || '?';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose profile</Text>
          <Text style={styles.subtitle}>Pick who is tracking hydration right now.</Text>
        </View>

        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item)}>
              <SurfaceCard style={styles.profileCard} accent={false}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.profileName}>{item.first_name || item.username}</Text>
                  <Text style={styles.profileMeta}>{item.daily_goal} {item.unit_preference} daily goal</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </SurfaceCard>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable style={styles.addBtn} onPress={() => router.push('/profiles/create')}>
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.addBtnText}>Create New Profile</Text>
            </Pressable>
          }
        />

        <Pressable style={styles.signOutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: theme.spacing.lg },
    header: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
    title: { fontSize: theme.fontSize.xxl + 2, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
    subtitle: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.base, color: theme.colors.textMuted },
    list: { gap: theme.spacing.sm, paddingBottom: 140 },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: 84,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    avatarText: { color: theme.colors.primary, fontSize: theme.fontSize.base, fontWeight: '800' },
    cardBody: { flex: 1 },
    profileName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    profileMeta: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    addBtn: {
      marginTop: theme.spacing.sm,
      height: 52,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceAlt,
    },
    addBtnText: { color: theme.colors.primary, fontSize: theme.fontSize.base, fontWeight: '700' },
    signOutBtn: {
      position: 'absolute',
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      bottom: 24,
      height: 46,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
    },
    signOutText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  });
