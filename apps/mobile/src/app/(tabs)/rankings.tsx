import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { LeaderList } from '../../components/LeaderList';
import { Pitch } from '../../components/Pitch';
import { PlayerCardView } from '../../components/PlayerCardView';
import { Card, Empty, Loading, Row, Screen, Segmented, SectionTitle, StatTile, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/session';
import { MONTHS } from '../../lib/format';
import { monthRange } from '../../lib/stats';
import { fonts, themed, useColors } from '../../theme';

type Tab = 'ranking' | 'leaders' | 'xi' | 'potm';

export default function Rankings() {
  const [tab, setTab] = useState<Tab>('ranking');
  return (
    <Screen>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ranking', label: 'الترتيب' },
          { value: 'leaders', label: 'المتصدرون' },
          { value: 'xi', label: 'التشكيلة' },
          { value: 'potm', label: 'لاعب الشهر' },
        ]}
      />
      {tab === 'ranking' ? <MonthRanking /> : tab === 'leaders' ? <Leaders /> : tab === 'xi' ? <TeamOfWeek /> : <PlayerOfMonth />}
    </Screen>
  );
}

const MEDAL = ['#F5B700', '#A7B1B8', '#C98B5A'];

/** تصنيف الشهر: منصة لأول ثلاثة + قائمة بالنقاط */
function MonthRanking() {
  const router = useRouter();
  const c = useColors();
  const st = useRankStyles();
  const [offset, setOffset] = useState(0);
  const { data, loading } = useAsync(() => api.getRankings(offset), [offset]);
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const { from } = monthRange(offset);
  const rows = data ?? [];
  // ترتيب المنصة: الثاني، الأول، الثالث (الأول في الوسط)
  const podium = [{ rank: 2, r: rows[1] }, { rank: 1, r: rows[0] }, { rank: 3, r: rows[2] }];

  return (
    <>
      <Row style={{ justifyContent: 'center', flexWrap: 'nowrap' }}>
        <Pressable onPress={() => setOffset(offset + 1)} style={st.arrow} accessibilityLabel="الشهر السابق" hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={c.primary} />
        </Pressable>
        <View style={st.month}>
          <Ionicons name="calendar-outline" size={18} color={c.primary} />
          <Text style={{ fontFamily: fonts.bold }}>تصنيف شهر {MONTHS[from.getMonth()]}</Text>
        </View>
        <Pressable onPress={() => offset > 0 && setOffset(offset - 1)} disabled={offset === 0} style={[st.arrow, offset === 0 && { opacity: 0.3 }]} accessibilityLabel="الشهر التالي" hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.primary} />
        </Pressable>
      </Row>

      {loading && !data ? <Loading /> : null}
      {data && rows.length === 0 ? <Empty title="لا توجد نتائج لهذا الشهر" hint="يظهر التصنيف بعد تسجيل نتائج المباريات." icon="podium-outline" /> : null}

      {rows.length ? (
        <View style={st.podium}>
          {podium.map(({ rank, r }) => {
            if (!r) return <View key={`rank-${rank}`} style={{ flex: 1 }} />;
            const size = rank === 1 ? 104 : 84;
            return (
              <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={[st.podiumItem, rank === 1 && { marginTop: -8 }]}>
                {rank === 1 ? <Ionicons name="trophy" size={34} color={MEDAL[0]} /> : <View style={{ height: 34 }} />}
                <View style={[st.ring, { width: size, height: size, borderRadius: size / 2, borderColor: MEDAL[rank - 1] }]}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: size / 2.6, lineHeight: size / 1.8, color: c.primary }}>{r.profile.full_name.slice(0, 1)}</Text>
                  <View style={[st.rankBadge, { backgroundColor: MEDAL[rank - 1] }]}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#101828' }}>{rank}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.bold, textAlign: 'center' }} numberOfLines={2}>{r.profile.full_name}</Text>
                <Text variant="small" style={{ color: c.muted }}>التقييم {r.overall}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {rows.map((r, i) => (
        <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={[st.row, i < 3 && { backgroundColor: MEDAL[i], borderColor: MEDAL[i] }]}>
          <Text style={[st.pos, i < 3 && { color: '#101828' }]}>{i + 1}</Text>
          <View style={st.avatar}>
            <Text style={{ fontFamily: fonts.bold, color: c.primary }}>{r.profile.full_name.slice(0, 1)}</Text>
          </View>
          <Text style={[{ flex: 1, fontFamily: fonts.semibold }, i < 3 && { color: '#101828' }]} numberOfLines={1}>{r.profile.full_name}</Text>
          <Text style={[st.points, i < 3 && { color: '#101828' }]}>{r.points}</Text>
          <Text variant="small" style={i < 3 ? { color: '#101828' } : { color: c.muted }}>نقطة</Text>
        </Pressable>
      ))}
      {rows.length ? <Text variant="small" style={{ color: c.muted, textAlign: 'center' }}>النقاط: فوز 3 · تعادل 1 · هدف 2 · صناعة 1 · رجل المباراة 3</Text> : null}
    </>
  );
}

const useRankStyles = themed((c) => ({
  month: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: c.border },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 8 },
  podiumItem: { flex: 1, alignItems: 'center', gap: 4 },
  ring: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  rankBadge: { position: 'absolute', bottom: -10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: c.border },
  pos: { fontFamily: fonts.bold, width: 22, textAlign: 'center', color: c.muted },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.primarySoft },
  points: { fontFamily: fonts.bold, fontSize: 18 },
}));

function Leaders() {
  const router = useRouter();
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const { data, loading, reload } = useAsync(
    async () => {
      const [goals, assists, mvps, rating] = await Promise.all([
        api.getLeaderboard('goals', 5),
        api.getLeaderboard('assists', 5),
        api.getLeaderboard('mvps', 5),
        api.getLeaderboard('rating', 5),
      ]);
      return { goals, assists, mvps, rating };
    },
    [],
  );
  useFocusEffect(useCallback(() => void reload(), [reload]));
  if (loading && !data) return <Loading />;
  if (!data) return null;

  const block = (title: string, hint: string, rows: typeof data.goals, unit: string, decimals = 0) => (
    <View style={{ gap: 8 }}>
      <SectionTitle title={title} hint={hint} />
      <Card>{rows.length ? <LeaderList rows={rows} unit={unit} decimals={decimals} onPress={open} /> : <Text variant="muted">ماكو بيانات بعد</Text>}</Card>
    </View>
  );

  return (
    <>
      {block('الهدافون', 'أكثر اللاعبين تسجيلاً للأهداف', data.goals, 'هدف')}
      {block('صنّاع اللعب', 'أكثر اللاعبين صناعة للأهداف', data.assists, 'صناعة')}
      {block('رجل المباراة', 'أكثر اللاعبين فوزاً بتصويت أفضل لاعب', data.mvps, 'مرة')}
      {block('الأعلى تقييماً', 'حسب تقييمات زملائهم', data.rating, 'تقييم', 1)}
    </>
  );
}

function TeamOfWeek() {
  const { data, loading } = useAsync(() => api.getTeamOfWeek(), []);
  if (loading && !data) return <Loading />;
  if (!data || data.length < 5) return <Empty title="لم تكتمل تشكيلة الشهر" hint="تُختار تلقائياً من أفضل اللاعبين أداءً في مباريات الشهر." icon="people-outline" />;
  return (
    <>
      <SectionTitle title="تشكيلة الشهر" hint="4-3-3 + احتياطيان · حسب التقييم والأهداف والصناعة وجوائز رجل المباراة" />
      <Pitch lineup={data} />
    </>
  );
}

function PlayerOfMonth() {
  const c = useColors();
  const router = useRouter();
  const { data: card, loading } = useAsync(() => api.getPlayerOfMonth(), []);
  if (loading && !card) return <Loading />;
  if (!card) return <Empty title="لا يوجد لاعب للشهر بعد" icon="star-outline" />;
  return (
    <>
      <View style={{ backgroundColor: c.primary, borderRadius: 20, paddingVertical: 20, gap: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 38, color: c.accent }}>⭐ لاعب الشهر</Text>
        <PlayerCardView card={card} width={240} onPress={() => router.push({ pathname: '/player/[id]', params: { id: card.profile.id } })} />
      </View>
      <Row style={{ flexWrap: 'nowrap' }}>
        <StatTile label="أهداف" value={card.stats.goals} icon="football" />
        <StatTile label="صناعة" value={card.stats.assists} icon="git-merge" tone="blue" />
        <StatTile label="رجل المباراة" value={card.stats.mvps} icon="ribbon" tone="yellow" />
      </Row>
    </>
  );
}
