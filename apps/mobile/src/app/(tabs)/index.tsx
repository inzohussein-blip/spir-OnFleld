import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { HeaderBand } from '../../components/HeaderBand';
import { MatchRow } from '../../components/MatchRow';
import { Empty, ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFullDate, weekdayName } from '../../lib/format';
import { errMsg, useAsync, useNow, useSession } from '../../lib/session';
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
  const [dayIdx, setDayIdx] = useState(0);
  const [banner, setBanner] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const bannerW = Math.min(width, 560) - 32;
  const day = days[dayIdx];
  const dayMatches = (data ?? []).filter((m) => new Date(m.starts_at).toDateString() === day.toDateString());

  async function join(matchId: string) {
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <HeaderBand>
        <View style={st.header}>
          <Pressable onPress={() => router.push('/profile')} style={st.avatar} accessibilityLabel="حسابي">
            <Text style={st.avatarText}>{profile?.full_name.slice(0, 1) ?? '؟'}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.hello} numberOfLines={1}>مرحباً بك {profile?.full_name}</Text>
            <Text style={st.sub}>اكتشف المباريات المتاحة اليوم</Text>
          </View>
          <Pressable onPress={() => router.push('/chats')} accessibilityLabel="الإشعارات والمحادثات" hitSlop={8}>
            <Ionicons name="notifications-outline" size={28} color={c.primary} />
          </Pressable>
        </View>
      </HeaderBand>

      <ScrollView contentContainerStyle={st.content}>
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
                onPress={() => setDayIdx(i)}
                style={[st.day, active && st.dayActive]}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayName(d)} ${d.getDate()}`}
                accessibilityState={{ selected: active }}
                testID={`day-${i}`}
              >
                <Text style={[st.dayNum, active && { color: c.primary }]}>{d.getDate()}</Text>
                <Text style={[st.dayName, active && { color: c.primary }]}>{weekdayName(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={st.listHead}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>المباريات القادمة</Text>
          <Text variant="small">{formatFullDate(day)}</Text>
        </View>

        <ErrorText message={error ?? actionError} />
        {loading && !data ? <Loading /> : null}
        {data && dayMatches.length === 0 ? <Empty title="لا توجد مباريات بهذا اليوم" hint="جرّب يوماً آخر" icon="calendar-outline" /> : null}
        {dayMatches.map((m, i) => (
          <MatchRow key={m.id} match={m} index={i + 1} now={now} busy={busyId === m.id} onAction={() => join(m.id)} />
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
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}));
