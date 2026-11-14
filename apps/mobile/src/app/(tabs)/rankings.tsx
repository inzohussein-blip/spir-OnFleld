import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { OfflineBanner } from '../../components/feedback';
import { HeaderBand } from '../../components/HeaderBand';
import { Empty, Loading, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { MONTHS } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { monthRange } from '../../lib/stats';
import { fonts, themed, useColors } from '../../theme';

const MEDAL = ['#F5B700', '#A7B1B8', '#C98B5A'];

/** تصنيف الشهر: منصة لأول ثلاثة + قائمة بالنقاط */
export default function Rankings() {
  const router = useRouter();
  const c = useColors();
  const st = useRankStyles();
  const [offset, setOffset] = useState(0);
  const { data, loading, refreshing, reload, offline } = useAsync(() => api.getRankings(offset), [offset], { cacheKey: 'rankings' });
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const { from } = monthRange(offset);
  const rows = data ?? [];
  // ترتيب المنصة: الثاني، الأول، الثالث (الأول في الوسط)
  const podium = [{ rank: 2, r: rows[1] }, { rank: 1, r: rows[0] }, { rank: 3, r: rows[2] }];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <HeaderBand title="التصنيفات" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
      >
      <OfflineBanner show={offline} />
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
      {data && rows.length === 0 ? <Empty title="ماكو نتائج بهذا الشهر" hint="التصنيف يطلع بعد ما تنسجل نتائج المباريات" icon="podium-outline" /> : null}

      {rows.length ? (
        <View style={st.podium}>
          {podium.map(({ rank, r }) => {
            if (!r) return <View key={`rank-${rank}`} style={{ flex: 1 }} />;
            const size = rank === 1 ? 104 : 84;
            return (
              <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={[st.podiumItem, rank === 1 && { marginTop: -8 }]}>
                {rank === 1 ? <Ionicons name="trophy" size={34} color={MEDAL[0]} /> : <View style={{ height: 34 }} />}
                <View>
                  <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={size} ring={MEDAL[rank - 1]} />
                  <View style={[st.rankBadge, { backgroundColor: MEDAL[rank - 1] }]}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#101828' }}>{rank}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.bold, textAlign: 'center' }} numberOfLines={2}>{r.profile.full_name}</Text>
                <Text variant="small" style={{ color: c.muted }}>مستوى {Math.round(r.profile.skill_rating)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {rows.map((r, i) => (
        <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={[st.row, i < 3 && { backgroundColor: MEDAL[i], borderColor: MEDAL[i] }]}>
          <Text style={[st.pos, i < 3 && { color: '#101828' }]}>{i + 1}</Text>
          <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={42} />
          <Text style={[{ flex: 1, fontFamily: fonts.semibold }, i < 3 && { color: '#101828' }]} numberOfLines={1}>{r.profile.full_name}</Text>
          <Text style={[st.points, i < 3 && { color: '#101828' }]}>{r.points}</Text>
          <Text variant="small" style={i < 3 ? { color: '#101828' } : { color: c.muted }}>نقطة</Text>
        </Pressable>
      ))}
      {rows.length ? <Text variant="small" style={{ color: c.muted, textAlign: 'center' }}>النقاط: فوز 3 · تعادل 1 · هدف 2 · صناعة 1 · رجل المباراة 3</Text> : null}
      </ScrollView>
    </View>
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

