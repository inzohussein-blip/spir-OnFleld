import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { I18nManager, Platform } from 'react-native';
import { ToastProvider } from '../components/feedback';
import { Loading } from '../components/ui';
import { registerForPush, setupNotifications } from '../lib/notifications';
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
  const pathname = usePathname();
  const router = useRouter();

  // رابط الدعوة: إذا فتح الرابط وهو مو مسجّل، نرجّعه لنفس الصفحة بعد الدخول
  const pendingRef = useRef<string | null>(null);
  const onboardingRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    if (!userId) {
      if (first !== 'login') {
        if (pathname && pathname !== '/') pendingRef.current = pathname;
        router.replace('/login');
      }
      return;
    }
    if (!profile) {
      if (first !== 'onboarding') {
        onboardingRef.current = true;
        router.replace('/onboarding');
      }
      return;
    }
    if (first === 'login' || (first === 'onboarding' && onboardingRef.current)) {
      const to = pendingRef.current ?? '/';
      pendingRef.current = null;
      onboardingRef.current = false;
      router.replace(to as Href);
    }
  }, [ready, userId, profile, segments, pathname, router]);

  // الإشعارات: إعداد القناة، وتسجيل الجهاز للإشعارات من الخادم بعد الدخول
  useEffect(() => {
    void setupNotifications();
  }, []);
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);

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
        <Stack.Screen name="notifications" options={{ title: 'الإشعارات' }} />
        <Stack.Screen name="suggest" options={{ title: 'اقترح مباراة' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
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
          <ToastProvider>
            <Gate />
          </ToastProvider>
        </SessionProvider>
      ) : (
        <Loading />
      )}
    </ThemeProvider>
  );
}
