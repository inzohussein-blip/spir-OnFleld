import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { Loading } from '../components/ui';
import { SessionProvider, useSession } from '../lib/session';
import { colors, fonts } from '../theme';

// العربية: اتجاه من اليمين لليسار
if (Platform.OS !== 'web' && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
  document.title = 'بالملعب';
}

function Gate() {
  const { ready, userId, profile } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    if (!userId && first !== 'login') router.replace('/login');
    else if (userId && !profile && first !== 'onboarding') router.replace('/onboarding');
    else if (userId && profile && first === 'login') router.replace('/');
  }, [ready, userId, profile, segments, router]);

  if (!ready) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: fonts.bold },
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: 'رجوع',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: 'ملفك كلاعب' }} />
      <Stack.Screen name="venue/[id]" options={{ title: 'الساحة' }} />
      <Stack.Screen name="match/[id]" options={{ title: 'المباراة' }} />
      <Stack.Screen name="match/rate" options={{ title: 'تقييم اللاعبين' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold });
  if (!loaded) return <Loading />;
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Gate />
    </SessionProvider>
  );
}
