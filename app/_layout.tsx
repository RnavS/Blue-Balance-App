import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PremiumProvider } from '@/contexts/PremiumContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { ThemeModeProvider } from '@/theme/ThemeModeContext';

const queryClient = new QueryClient();

function RouteGuard() {
  const { user, loading: authLoading } = useAuth();
  const { profiles, loading: profileLoading } = useProfile();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || profileLoading) return;

    const inMain = segments[0] === '(main)';
    const inProfiles = segments[0] === 'profiles';

    if (!user) {
      if (inMain || inProfiles) router.replace('/');
      return;
    }

    if (profiles.length === 0) {
      // Logged-in users without profiles should always be guided to profile setup.
      if (!inProfiles) router.replace('/profiles');
      return;
    }

    if (!inMain) {
      router.replace('/(main)/dashboard');
    }
  }, [user, authLoading, profiles, profileLoading, segments]);

  return <Slot />;
}

function Providers() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <ProfileProvider>
          <RouteGuard />
        </ProfileProvider>
      </PremiumProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeModeProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <Providers />
            <Toast />
          </QueryClientProvider>
        </ThemeModeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
