import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, usePathname, useRouter, useSegments, type ErrorBoundaryProps, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, I18nManager, Platform, Pressable, View } from 'react-native';
import { ToastProvider, useToast } from '../components/feedback';
import { Loading, Text } from '../components/ui';
import { installCrashReporter, reportCrash, setCrashScreen } from '../lib/crash';
import { captureRefFromUrl } from '../lib/referral';
import { api } from '../lib/api';
import { registerForPush, setupNotifications } from '../lib/notifications';
import { registerBackgroundSync, syncNotifications } from '../lib/notificationSync';
import * as Notifications from 'expo-notifications';
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

installCrashReporter();
captureRefFromUrl();

/** إذا شاشة طاحت: نبلّغ لوحة التحكم ونعرض زر «جرّب مرة ثانية» بدل شاشة بيضاء */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportCrash(error);
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#F3F6FC' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#0B1226' }}>صار خطأ بهاي الصفحة 😕</Text>
      <Text style={{ textAlign: 'center', color: '#5B6577' }}>وصل تقرير للإدارة حتى نصلّحه. جرّب مرة ثانية.</Text>
      <Pressable onPress={() => void retry()} style={{ backgroundColor: '#1E4FD8', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 10 }} accessibilityRole="button">
        <Text style={{ color: '#fff', fontFamily: fonts.bold }}>جرّب مرة ثانية</Text>
      </Pressable>
    </View>
  );
}

function Gate() {
  const { ready, userId, profile } = useSession();
  const { colors: c, scheme } = useTheme();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    setCrashScreen(pathname);
  }, [pathname]);

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
  // الإشعارات الجديدة من الخادم تطلع على الشاشة: كل دقيقة والتطبيق مفتوح، وبالخلفية كل ~15 دقيقة
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    void registerBackgroundSync();
    const tick = () => void syncNotifications().catch(() => {});
    tick();
    const t = setInterval(() => AppState.currentState === 'active' && tick(), 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [userId]);
  // الضغط على الإشعار يفتح المباراة
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const matchId = (r.notification.request.content.data as { match_id?: string | null } | undefined)?.match_id;
      if (matchId) router.push({ pathname: '/match/[id]', params: { id: matchId } });
    });
    return () => sub.remove();
  }, [router]);

  // دخل لحسابه وعنده طلب حذف معلّق → ينلغي الطلب تلقائياً
  const toast = useToast();
  useEffect(() => {
    if (!userId) return;
    void api
      .cancelMyDeletionRequest()
      .then((cancelled) => {
        if (cancelled) toast('هلا بيك مرة ثانية 👋 انلغى طلب حذف حسابك');
      })
      .catch(() => {});
  }, [userId, toast]);

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
        <Stack.Screen name="info" options={{ title: 'حول' }} />
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
        <Stack.Screen name="teams" options={{ title: 'فريقي' }} />
        <Stack.Screen name="team/[id]" options={{ title: 'الفريق' }} />
        <Stack.Screen name="team/suggest" options={{ title: 'مباراة للفريق' }} />
        <Stack.Screen name="team/join" options={{ title: 'انضم ويّا الفريق' }} />
        <Stack.Screen name="invite" options={{ title: 'ادعُ أصدقاءك' }} />
        <Stack.Screen name="match/close" options={{ title: 'سكّر المباراة' }} />
        <Stack.Screen name="match/chat" options={{ title: 'محادثة المباراة' }} />
        <Stack.Screen name="owner" options={{ title: 'ملاعبي' }} />
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
