import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { AdCarousel } from '../../components/AdCarousel';
import { FilterBar } from '../../components/FilterBar';
import { MatchRow } from '../../components/MatchRow';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { Button, Empty, ErrorText, IconButton, PageHeader, SectionTitle, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { useFavoriteVenues } from '../../lib/favorites';
import { applyFilters, EMPTY_FILTERS, filterOptions, type MatchFilters } from '../../lib/filters';
import { formatMatchCount, greetingFor, readyHeadline, shortWeekday, weekdayName } from '../../lib/format';
import { dayCounts, firstDayWithMatches } from '../../lib/schedule';
import { useAsync, useNow, useSession } from '../../lib/session';
import { nextDays } from '../../lib/slots';
import { useMatchActions } from '../../lib/useMatchActions';
import { ctaShadow, fonts, radius, space, themed, type, useColors } from '../../theme';

/**
 * الرئيسية: تحية وسؤال «جاهز تلعب؟» مع البحث والإشعارات، الإعلانات (تتبدّل)،
 * أيام الأسبوع، الفلاتر، ومباريات اليوم المختار.
 */
export default function Home() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
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
    }, [reload, reloadNotes, reloadAds]),
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
  const isFiltered = filtered.length !== (data ?? []).length;
  const hasUnread = (notes ?? []).some((n) => !n.read);
  const weekTotal = dayCounts(data ?? [], days).reduce((a, b) => a + b, 0);
  const venueTotal = new Set((data ?? []).map((m) => m.venue_id ?? m.venue_name)).size;
  const hour = new Date(now).getHours();
  const firstName = (profile?.full_name ?? '').split(' ')[0];
  const summary = data
    ? weekTotal
      ? `${formatMatchCount(weekTotal)} هذا الأسبوع${venueTotal ? ` · ${venueTotal === 1 ? 'ملعب واحد' : venueTotal === 2 ? 'ملعبين' : `${venueTotal} ملاعب`}` : ''}`
      : 'ماكو مباريات هذا الأسبوع بعد'
    : undefined;

  return (
    <View style={st.screen}>
      <ScrollView
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([reload(), reloadAds(), reloadNotes()])} tintColor={c.primary} colors={[c.primary]} />}
      >
        <PageHeader
            eyebrow={`${greetingFor(hour)}${firstName ? `، ${firstName}` : ''}`}
            title={readyHeadline(hour)}
            subtitle={summary}
            actions={
              <>
                  <IconButton onBand icon="search-outline" label="ابحث عن ملعب أو منطقة" onPress={() => router.push('/venues')} />
                  <IconButton onBand icon="notifications-outline" label={hasUnread ? 'الإشعارات — يوجد جديد' : 'الإشعارات'} dot={hasUnread} onPress={() => router.push('/notifications')} />
              </>
            }
          />
        <View style={st.body}>
        {ads?.length ? <AdCarousel ads={ads} now={now} /> : null}

        {/* أيام الأسبوع: سبعة مربعات متساوية — الرقم وتحته اليوم */}
        <View style={st.days}>
          {days.map((d, i) => {
            const active = i === dayIdx;
            const has = counts[i] > 0;
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
                <Text style={[st.dayName, active && st.onActive]}>{shortWeekday(d)}</Text>
                <Text style={[st.dayNum, active && st.onActive]}>{d.getDate()}</Text>
                <View style={[st.dayDot, has && { backgroundColor: active ? c.onCta : c.primary }]} />
              </Pressable>
            );
          })}
        </View>

        <FilterBar value={filters} onChange={setFilters} formats={options.formats} areas={options.areas} />

        <SectionTitle title={`مباريات ${weekdayName(day)}`} action={dayMatches.length ? <Text style={st.count}>{formatMatchCount(dayMatches.length)}</Text> : undefined} />

        <OfflineBanner show={offline} />
        <ErrorText message={error ?? actionError} />
        {loading && !data ? <SkeletonList count={3} /> : null}
        {data && dayMatches.length === 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Empty
              title={isFiltered ? 'ماكو مباريات تطابق الفلترة' : 'ماكو مباريات بهذا اليوم'}
              hint={isFiltered ? 'غيّر الفلترة أو امسحها' : 'شوف يوم ثاني، أو اقترح مباراة على الإدارة'}
              icon="calendar-outline"
            />
            <Button title="اقترح مباراة" icon="bulb-outline" variant="outline" onPress={() => router.push('/suggest')} style={{ paddingHorizontal: space.xl }} />
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
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  days: { flexDirection: 'row', gap: space.xs + 2 },
  day: { flex: 1, minHeight: 64, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 2, borderColor: c.border },
  dayActive: { backgroundColor: c.cta, borderColor: c.cta, boxShadow: ctaShadow(c) },
  dayName: { ...type.micro, color: c.muted },
  dayNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, color: c.text },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
  onActive: { color: c.onCta },
  count: { ...type.caption, color: c.muted },
}));
