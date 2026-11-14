import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { HeaderBand } from '../../components/HeaderBand';
import { MatchRow } from '../../components/MatchRow';
import { Avatar } from '../../components/Avatar';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { Button, Empty, ErrorText, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFullDate, weekdayName } from '../../lib/format';
import { dayCounts, firstDayWithMatches } from '../../lib/schedule';
import { useAsync, useNow, useSession } from '../../lib/session';
import { useMatchActions } from '../../lib/useMatchActions';
import { nextDays } from '../../lib/slots';
import { fonts, themed, useColors } from '../../theme';

const BANNERS = [
  { title: 'شتحتاج بالمباراة؟', body: 'حكم، كرات، مياه، إسعافات أولية وتصوير — كله موجود', bg: '#1E4FD8' },
  { title: 'دوري بالملعب', body: 'التسجيل مفتوح لبطولة الملعب الكامل', bg: '#163CA8' },
  { title: 'جائزة رجل المباراة', body: 'مكافأة بالمحفظة لأفضل لاعب بكل مباراة', bg: '#0F2E7A' },
];

export default function Home() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { width } = useWindowDimensions();
  const { profile } = useSession();
  const now = useNow(30_000);
  const days = useMemo(() => nextDays(7), []);
  // null = لم يختر المستخدم يوماً بعد → نفتح على أول يوم بيه مباريات
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const [banner, setBanner] = useState(0);
  const { data, error, offline, loading, refreshing, reload } = useAsync(() => api.listOpenMatches(), [], { cacheKey: 'open-matches' });
  const { data: notes, reload: reloadNotes } = useAsync(() => api.listNotifications(), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadNotes();
    }, [reload, reloadNotes]),
  );
  const { join, busyId, error: actionError } = useMatchActions(reload);

  const bannerW = Math.min(width, 560) - 32;
  const counts = useMemo(() => dayCounts(data ?? [], days), [data, days]);
  const dayIdx = chosenDay ?? firstDayWithMatches(counts);
  const day = days[dayIdx];
  const dayMatches = (data ?? []).filter((m) => new Date(m.starts_at).toDateString() === day.toDateString());
  const hasUnread = (notes ?? []).some((n) => !n.read);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <HeaderBand>
        <View style={st.header}>
          <Pressable onPress={() => router.push('/profile')} accessibilityLabel="حسابي">
            <Avatar name={profile?.full_name ?? ''} url={profile?.avatar_url} size={56} ring="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.hello} numberOfLines={1}>مرحباً بك {profile?.full_name}</Text>
            <Text style={st.sub}>اكتشف المباريات المتاحة اليوم</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} accessibilityLabel={hasUnread ? 'الإشعارات — يوجد جديد' : 'الإشعارات'} hitSlop={8}>
            <Ionicons name="notifications-outline" size={28} color={c.primary} />
            {hasUnread ? <View style={st.unreadDot} /> : null}
          </Pressable>
        </View>
      </HeaderBand>

      <ScrollView contentContainerStyle={st.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}>
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
            <View key={b.title} style={[st.banner, { width: bannerW, backgroundColor: b.bg }]}>
              <View style={st.bannerCircle} />
              <Text style={st.bannerTitle}>{b.title}</Text>
              <Text style={st.bannerBody}>{b.body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={st.dots}>
          {BANNERS.map((b, i) => (
            <View key={b.title} style={[st.dotBar, i === banner && st.dotBarActive]} />
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {days.map((d, i) => {
            const active = i === dayIdx;
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setChosenDay(i)}
                style={[st.day, active && st.dayActive]}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayName(d)} ${d.getDate()} — ${counts[i]} مباريات`}
                accessibilityState={{ selected: active }}
                testID={`day-${i}`}
              >
                <Text style={[st.dayNum, active && { color: c.primary }]}>{d.getDate()}</Text>
                <Text style={[st.dayName, active && { color: c.primary }]}>{weekdayName(d)}</Text>
                <View style={[st.dayCount, counts[i] === 0 && { opacity: 0 }, active && { backgroundColor: c.primary }]}>
                  <Text style={[st.dayCountText, active && { color: c.onPrimary }]}>{counts[i]}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={st.listHead}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>المباريات القادمة</Text>
          <Text variant="small">{formatFullDate(day)}</Text>
        </View>

        <OfflineBanner show={offline} />
        <ErrorText message={error ?? actionError} />
        {loading && !data ? <SkeletonList count={3} /> : null}
        {data && dayMatches.length === 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Empty title="ماكو مباريات بهذا اليوم" hint="شوف يوم ثاني، أو اقترح مباراة على الإدارة" icon="calendar-outline" />
            <Button title="اقترح مباراة" icon="bulb-outline" variant="outline" onPress={() => router.push('/suggest')} style={{ paddingHorizontal: 28 }} />
          </View>
        ) : null}
        {dayMatches.map((m, i) => (
          <MatchRow key={m.id} match={m} index={i + 1} now={now} busy={busyId === m.id} onAction={() => void join(m)} />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: '#fff' },
  hello: { fontFamily: fonts.bold, fontSize: 15, color: c.primary },
  sub: { fontSize: 14, color: c.text },
  banner: { height: 160, borderRadius: 22, padding: 20, justifyContent: 'center', gap: 6, overflow: 'hidden' },
  bannerCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -80, left: -60 },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36, color: '#fff' },
  bannerBody: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -6 },
  dotBar: { width: 26, height: 7, borderRadius: 4, backgroundColor: c.border },
  dotBarActive: { width: 40, backgroundColor: c.primary },
  day: { width: 62, paddingVertical: 14, borderRadius: 24, alignItems: 'center', gap: 4 },
  dayActive: { backgroundColor: c.primarySoft },
  dayNum: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  dayName: { fontSize: 12, color: c.text },
  dayCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayCountText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: c.primary },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, borderWidth: 2, borderColor: c.bandBg },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}));
