import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { Loading } from '../components/ui';
import { SessionProvider, useSession } from '../lib/session';
import { fonts, headerText, ThemeProvider, useTheme } from '../theme';

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
  const { colors: c, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    if (!userId && first !== 'login') router.replace('/login');
    else if (userId && !profile && first !== 'onboarding') router.replace('/onboarding');
    else if (userId && profile && first === 'login') router.replace('/');
  }, [ready, userId, profile, segments, router]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.body.style.backgroundColor = c.bg;
  }, [c.bg]);

  if (!ready) return <Loading />;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.header },
          headerTintColor: headerText(c),
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.bold },
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: 'رجوع',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'ملفك كلاعب' }} />
        <Stack.Screen name="venue/[id]" options={{ title: 'الساحة' }} />
        <Stack.Screen name="matches" options={{ title: 'المباريات' }} />
        <Stack.Screen name="my-matches" options={{ title: 'مبارياتي' }} />
        <Stack.Screen name="match/[id]" options={{ title: 'المباراة' }} />
        <Stack.Screen name="match/rate" options={{ title: 'تقييم اللاعبين' }} />
        <Stack.Screen name="match/result" options={{ title: 'تسجيل النتيجة' }} />
        <Stack.Screen name="player/[id]" options={{ title: 'بطاقة اللاعب' }} />
        <Stack.Screen name="tournament/[id]" options={{ title: 'البطولة' }} />
        <Stack.Screen name="tournaments" options={{ title: 'البطولات' }} />
        <Stack.Screen name="trials" options={{ title: 'اختبارات الأندية' }} />
        <Stack.Screen name="posts" options={{ title: 'المنشورات' }} />
        <Stack.Screen name="info" options={{ title: 'معلومات' }} />
        <Stack.Screen name="stats" options={{ title: 'الإحصائيات' }} />
        <Stack.Screen name="chats" options={{ title: 'المحادثات' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'المحادثة' }} />
        <Stack.Screen name="trial/[id]" options={{ title: 'الاختبار' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'المنشور' }} />
        <Stack.Screen name="wallet" options={{ title: 'المحفظة' }} />
        <Stack.Screen name="players" options={{ title: 'اللاعبين' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold });
  return (
    <ThemeProvider>
      {loaded ? (
        <SessionProvider>
          <Gate />
        </SessionProvider>
      ) : (
        <Loading />
      )}
    </ThemeProvider>
  );
}
