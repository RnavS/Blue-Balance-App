import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

function TabIcon({
  name,
  focused,
  color,
  bg,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  bg: string;
}) {
  const styles = createStyles();
  return (
    <View style={[focused ? styles.activeIcon : styles.icon, focused && { backgroundColor: bg }]}>
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

export default function MainLayout() {
  const { currentProfile } = useProfile();
  const theme = useAppTheme(currentProfile?.theme);
  const styles = createStyles();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.colors.tabBar,
            borderTopColor: theme.colors.border,
          },
          theme.shadows.floating,
        ],
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home-outline" focused={focused} color={color} bg={theme.colors.primarySoft} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="stats-chart-outline" focused={focused} color={color} bg={theme.colors.primarySoft} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="scan-outline" focused={focused} color={color} bg={theme.colors.primarySoft} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="chatbubble-ellipses-outline" focused={focused} color={color} bg={theme.colors.primarySoft} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="settings-outline" focused={focused} color={color} bg={theme.colors.primarySoft} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = () =>
  StyleSheet.create({
    tabBar: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 12,
      borderTopWidth: 1,
      borderRadius: 24,
      height: 70,
      paddingBottom: 8,
      paddingTop: 8,
      paddingHorizontal: 8,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },
    icon: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    activeIcon: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
  });
