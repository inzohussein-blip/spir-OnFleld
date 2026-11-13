import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MatchRow } from '../../components/MatchRow';
import { Empty, ErrorText, Loading, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFullDate, weekdayName } from '../../lib/format';
import { errMsg, useAsync, useNow, useSession } from '../../lib/session';
import { nextDays } from '../../lib/slots';
import { fonts, themed, useColors } from '../../theme';

const BANNERS: { title: string; body: string; icon: IconName; bg: string; href: Href }[] = [
  { title: 'شتحتاج بالمباراة؟ موجود', body: 'حكم، كرات، مياه، وتصوير — كل شي جاهز بالساحة', icon: 'shield-checkmark', bg: '#1E4FD8', href: '/venues' },
  { title: 'دوري بالملعب', body: 'التسجيل مفتوح لبطولة الملعب الكامل — سجّل فريقك', icon: 'trophy', bg: '#163CA8', href: '/tournaments' },
  { title: 'ادعُ شلتك', body: 'أنشئ مباراة وشارك الرابط على واتساب', icon: 'people', bg: '#B07A00', href: '/venues' },
];

const DISCOVER: { label: string; icon: IconName; href: Href }[] = [
  { label: 'البطولات', icon: 'trophy-outline', href: '/tournaments' },
  { label: 'الاختبارات', icon: 'ribbon-outline', href: '/trials' },
  { label: 'المنشورات', icon: 'newspaper-outline', href: '/posts' },
  { label: 'مبارياتي', icon: 'calendar-outline', href: '/my-matches' },
  { label: 'أنشئ مباراة', icon: 'add-circle-outline', href: '/venues' },
];

export default function Home() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { width } = useWindowDimensions();
  const { profile } = useSession();
  const now = useNow(30_000);
  const days = useMemo(() => nextDays(7), []);
  const [dayIdx, setDayIdx] = useState(0);
  const [banner, setBanner] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const bannerW = Math.min(width, 560) - 32;
  const day = days[dayIdx];
  const dayMatches = (data ?? []).filter((m) => new Date(m.starts_at).toDateString() === day.toDateString());

  async function act(matchId: string) {
    setBusyId(matchId);
    setActionError(null);
    try {
      await api.joinMatch(matchId);
      await reload();
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={st.content}>
        {/* الترحيب */}
        <View style={st.header}>
          <Pressable onPress={() => router.push('/profile')} style={st.avatar} accessibilityLabel="حسابي">
            <Text style={st.avatarText}>{profile?.full_name.slice(0, 1) ?? '؟'}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.hello} numberOfLines={1}>مرحباً {profile?.full_name.split(' ')[0]} 👋</Text>
            <Text style={st.sub}>اكتشف المباريات المتاحة اليوم</Text>
          </View>
          <Pressable onPress={() => router.push('/chats')} style={st.bell} accessibilityLabel="المحادثات والتبليغات">
            <Ionicons name="notifications-outline" size={22} color={c.primary} />
            <View style={st.dot} />
          </Pressable>
        </View>

        {/* اللافتات */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={bannerW + 10}
          decelerationRate="fast"
          contentContainerStyle={{ gap: 10 }}
          onMomentumScrollEnd={(e) => setBanner(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / (bannerW + 10)))}
          scrollEventThrottle={32}
        >
          {BANNERS.map((b) => (
            <Pressable key={b.title} onPress={() => router.push(b.href)} style={[st.banner, { width: bannerW, backgroundColor: b.bg }]}>
              <View style={st.bannerCircle} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={st.bannerTitle}>{b.title}</Text>
                <Text style={st.bannerBody}>{b.body}</Text>
              </View>
              <Ionicons name={b.icon} size={52} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ))}
        </ScrollView>
        <View style={st.dots}>
          {BANNERS.map((b, i) => (
            <View key={b.title} style={[st.dotBar, i === banner && st.dotBarActive]} />
          ))}
        </View>

        {/* اكتشف */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DISCOVER.map((d) => (
            <Pressable key={d.label} onPress={() => router.push(d.href)} style={st.discover}>
              <Ionicons name={d.icon} size={18} color={c.primary} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* شريط الأيام */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {days.map((d, i) => {
            const active = i === dayIdx;
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setDayIdx(i)}
                style={[st.day, active && st.dayActive]}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayName(d)} ${d.getDate()}`}
                accessibilityState={{ selected: active }}
                testID={`day-${i}`}
              >
                <Text style={[st.dayNum, active && { color: c.primary }]}>{d.getDate()}</Text>
                <Text style={[st.dayName, active && { color: c.primary }]}>{i === 0 ? 'اليوم' : weekdayName(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={st.listHead}>
          <Text variant="h2">المباريات القادمة</Text>
          <Text variant="small" style={{ color: c.muted }}>{formatFullDate(day)}</Text>
        </View>

        <ErrorText message={error ?? actionError} />
        {loading && !data ? <Loading /> : null}
        {data && dayMatches.length === 0 ? (
          <Empty title="لا توجد مباريات بهذا اليوم" hint="جرّب يوماً آخر، أو أنشئ مباراة واحجز ساحة." icon="calendar-outline" />
        ) : null}
        {dayMatches.map((m) => (
          <MatchRow key={m.id} match={m} now={now} busy={busyId === m.id} onAction={() => act(m.id)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.primarySoft },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: c.onPrimary },
  hello: { fontFamily: fonts.bold, fontSize: 17, color: c.primary },
  sub: { color: c.muted, fontSize: 13 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  banner: { height: 150, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  bannerCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, left: -50 },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: '#fff' },
  bannerBody: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -4 },
  dotBar: { width: 22, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotBarActive: { width: 34, backgroundColor: c.primary },
  discover: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: c.border },
  day: { width: 64, paddingVertical: 12, borderRadius: 22, alignItems: 'center', gap: 2 },
  dayActive: { backgroundColor: c.primarySoft },
  dayNum: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  dayName: { fontSize: 12, color: c.text },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
}));
