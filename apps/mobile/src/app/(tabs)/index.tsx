import { Ionicons } from '@expo/vector-icons';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdSingle } from '../../components/AdSingle';
import { FilterBar } from '../../components/FilterBar';
import { useFavoriteVenues } from '../../lib/favorites';
import { applyFilters, EMPTY_FILTERS, filterOptions, type MatchFilters } from '../../lib/filters';
import { Avatar } from '../../components/Avatar';
import { MatchRow } from '../../components/MatchRow';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { Button, Empty, ErrorText, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatMatchCount, greetingFor, readyHeadline, shortWeekday, weekdayName } from '../../lib/format';
import { dayCounts, firstDayWithMatches } from '../../lib/schedule';
import { useAsync, useNow, useSession } from '../../lib/session';
import { nextDays } from '../../lib/slots';
import { useMatchActions } from '../../lib/useMatchActions';
import { fonts, themed, useColors, useTheme } from '../../theme';

/**
 * الرئيسية «الملعب بالليل»: رأس كحلي بإضاءة ملعب وسؤال «جاهز تلعب الليلة؟» ويّا أيقونتي البحث والإشعارات،
 * الإعلان طايف على طرف الرأس (واحد بالمرة ويّا ✕)، الأيام (رقم وتحته اليوم)، ومباريات اليوم المختار.
 */
export default function Home() {
  const router = useRouter();
  const c = useColors();
  const { scheme } = useTheme();
  const st = useStyles();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const now = useNow(30_000);
  const days = useMemo(() => nextDays(7), []);
  // null = لم يختر المستخدم يوماً بعد → نفتح على أول يوم بيه مباريات
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const { data, error, offline, loading, refreshing, reload } = useAsync(() => api.listOpenMatches(), [], { cacheKey: 'open-matches' });
  const { data: notes, reload: reloadNotes } = useAsync(() => api.listNotifications(), []);
  const { data: ads, reload: reloadAds } = useAsync(() => api.listAds(), [], { cacheKey: 'ads' });
  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadNotes();
      void reloadAds();
      // الرأس غامق: أرقام الساعة والبطارية بيضاء، وترجع مثل ما جانت لما نطلع
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [reload, reloadNotes, reloadAds, scheme]),
  );
  const { join, busyId, error: actionError } = useMatchActions(reload);

  const [filters, setFilters] = useState<MatchFilters>(EMPTY_FILTERS);
  const favVenues = useFavoriteVenues();
  const options = useMemo(() => filterOptions(data ?? []), [data]);
  const filtered = useMemo(() => applyFilters(data ?? [], filters, favVenues), [data, filters, favVenues]);
  const counts = useMemo(() => dayCounts(filtered, days), [filtered, days]);
  const dayIdx = chosenDay ?? firstDayWithMatches(counts);
  const day = days[dayIdx];
  const dayMatches = filtered.filter((m) => new Date(m.starts_at).toDateString() === day.toDateString());
  const hasUnread = (notes ?? []).some((n) => !n.read);
  const weekTotal = dayCounts(data ?? [], days).reduce((a, b) => a + b, 0);
  const venueTotal = new Set((data ?? []).map((m) => m.venue_id ?? m.venue_name)).size;
  const hasAd = !!ads?.length;
  const hour = new Date(now).getHours();
  const firstName = (profile?.full_name ?? '').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} progressViewOffset={insets.top} />}
      >
        {/* الرأس */}
        <View style={[st.hero, hasAd && st.heroWithAd, { paddingTop: insets.top + 12 }]}>
          <View style={st.lightA} />
          <View style={st.lightB} />
          <View style={st.centerCircle} />
          <View style={st.heroRow}>
            <Pressable onPress={() => router.push('/profile')} accessibilityLabel="حسابي">
              <Avatar name={profile?.full_name ?? ''} url={profile?.avatar_url} size={44} ring="rgba(255,255,255,0.75)" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.greet}>{greetingFor(hour)}</Text>
              <Text style={st.name}>
                {firstName || 'لاعبنا'} 👋
              </Text>
            </View>
            <Pressable onPress={() => router.push('/venues')} style={st.bell} accessibilityRole="button" accessibilityLabel="ابحث عن ملعب أو منطقة" hitSlop={6}>
              <Ionicons name="search" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/notifications')}
              style={st.bell}
              accessibilityRole="button"
              accessibilityLabel={hasUnread ? 'الإشعارات — يوجد جديد' : 'الإشعارات'}
              hitSlop={6}
            >
              <Ionicons name="notifications-outline" size={21} color="#fff" />
              {hasUnread ? <View style={st.unreadDot} /> : null}
            </Pressable>
          </View>
          <Text style={st.headline}>{readyHeadline(hour)}</Text>
          {data ? (
            <Text style={st.heroSub}>
              {weekTotal ? `${formatMatchCount(weekTotal)} هذا الأسبوع` : 'ماكو مباريات هذا الأسبوع بعد'}
              {venueTotal ? ` · ${venueTotal === 1 ? 'ملعب واحد' : venueTotal === 2 ? 'ملعبين' : `${venueTotal} ملاعب`}` : ''}
            </Text>
          ) : null}
        </View>

        {/* الإعلان: واحد بالمرة، طايف على طرف الرأس */}
        {hasAd ? (
          <View style={st.adWrap}>
            <AdSingle ads={ads ?? []} now={now} />
          </View>
        ) : null}

        <View style={st.body}>
          {/* الأيام: الرقم وتحته اليوم */}
          <View style={st.days}>
            {days.map((d, i) => {
              const active = i === dayIdx;
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => setChosenDay(i)}
                  style={[st.day, active && st.dayActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekdayName(d)} ${d.getDate()} — ${formatMatchCount(counts[i]) || 'ماكو مباريات'}`}
                  accessibilityState={{ selected: active }}
                  testID={`day-${i}`}
                >
                  <Text style={[st.dayNum, active && st.onActive]}>{d.getDate()}</Text>
                  <Text style={[st.dayName, active && st.onActive]}>{shortWeekday(d)}</Text>
                </Pressable>
              );
            })}
          </View>

          <FilterBar value={filters} onChange={setFilters} formats={options.formats} areas={options.areas} />

          <View style={st.listHead}>
            <Text style={st.listTitle}>مباريات {weekdayName(day)}</Text>
            {dayMatches.length ? <Text style={{ color: c.muted, fontSize: 12 }}>{formatMatchCount(dayMatches.length)}</Text> : null}
          </View>

          <OfflineBanner show={offline} />
          <ErrorText message={error ?? actionError} />
          {loading && !data ? <SkeletonList count={3} /> : null}
          {data && dayMatches.length === 0 ? (
            <View style={{ alignItems: 'center' }}>
              <Empty
                title={filtered.length !== (data ?? []).length ? 'ماكو مباريات تطابق الفلترة' : 'ماكو مباريات بهذا اليوم'}
                hint={filtered.length !== (data ?? []).length ? 'غيّر الفلترة أو امسحها' : 'شوف يوم ثاني، أو اقترح مباراة على الإدارة'}
                icon="calendar-outline"
              />
              <Button title="اقترح مباراة" icon="bulb-outline" variant="outline" onPress={() => router.push('/suggest')} style={{ paddingHorizontal: 28 }} />
            </View>
          ) : null}
          {dayMatches.map((m) => (
            <MatchRow key={m.id} match={m} now={now} busy={busyId === m.id} onAction={() => void join(m)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  hero: {
    backgroundColor: '#0F2E86',
    backgroundImage: 'linear-gradient(165deg, #081A4F 0%, #0F2E86 55%, #1E4FD8 100%)',
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  // الإعلان يطلع فوق طرف الرأس شوية
  heroWithAd: { paddingBottom: 58 },
  adWrap: { marginTop: -44, marginHorizontal: 16 },
  // إضاءة الملعب: دوائر فاتحة بالزوايا العلوية
  lightA: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -170, right: -90, backgroundColor: 'rgba(158,193,255,0.22)' },
  lightB: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -140, left: -70, backgroundColor: 'rgba(158,193,255,0.16)' },
  centerCircle: { position: 'absolute', width: 150, height: 150, borderRadius: 75, bottom: -75, alignSelf: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greet: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },
  name: { color: '#fff', fontFamily: fonts.bold, fontSize: 15, lineHeight: 24 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  headline: { color: '#fff', fontFamily: fonts.bold, fontSize: 23, lineHeight: 35, marginTop: 12 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 20 },
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  // الأيام: 7 مربعات بنفس العرض — الرقم كبير وتحته اليوم
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, paddingTop: 5, paddingBottom: 4, borderRadius: 14, alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  dayActive: { backgroundColor: c.primary, borderColor: c.primary, boxShadow: '0 5px 12px rgba(30,79,216,0.3)' },
  dayNum: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  dayName: { fontSize: 10, lineHeight: 15, color: c.muted },
  onActive: { color: '#fff' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  listTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
}));
