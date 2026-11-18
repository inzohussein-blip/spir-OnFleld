import { useRouter } from 'expo-router';
import { PullRefreshScroll } from '../../components/PullRefreshScroll';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { OfflineBanner } from '../../components/feedback';
import { Empty, IconButton, ListGroup, Loading, PageHeader, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { MONTHS } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { monthRange } from '../../lib/stats';
import { cardRadius, fonts, space, themed, type, useColors } from '../../theme';

/** ذهبي، فضي، برونزي — بس لحلقة الصورة ورقم المركز */
const MEDAL = ['#E0A500', '#9AA5AE', '#C0814F'];

/** تصنيف الشهر: منصة لأول ثلاثة + قائمة بالنقاط */
export default function Rankings() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const [offset, setOffset] = useState(0);
  const { data, loading, reload, offline } = useAsync(() => api.getRankings(offset), [offset], { cacheKey: 'rankings' });
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const { from } = monthRange(offset);
  const rows = data ?? [];
  // ترتيب المنصة: الثاني، الأول، الثالث (الأول في الوسط)
  const podium = [{ rank: 2, r: rows[1] }, { rank: 1, r: rows[0] }, { rank: 3, r: rows[2] }];

  return (
    <View style={st.screen}>
      <PullRefreshScroll
        contentContainerStyle={st.content}
        onRefresh={reload}
      >
        <PageHeader title="التصنيفات" subtitle="النقاط من نتائج مباريات الشهر" />
        <View style={st.body}>
        <OfflineBanner show={offline} />

        {/* الشهر */}
        <View style={st.month}>
          <IconButton icon="chevron-forward" label="الشهر السابق" onPress={() => setOffset(offset + 1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.monthTitle}>{MONTHS[from.getMonth()]} {from.getFullYear()}</Text>
            <Text style={st.monthHint}>{offset === 0 ? 'الشهر الحالي' : 'شهر سابق'}</Text>
          </View>
          <IconButton icon="chevron-back" label="الشهر التالي" disabled={offset === 0} onPress={() => offset > 0 && setOffset(offset - 1)} />
        </View>

        {loading && !data ? <Loading /> : null}
        {data && rows.length === 0 ? <Empty title="ماكو نتائج بهذا الشهر" hint="التصنيف يطلع بعد ما تنسجل نتائج المباريات" icon="podium-outline" /> : null}

        {rows.length ? (
          <View style={st.podium}>
            {podium.map(({ rank, r }) => {
              if (!r) return <View key={`rank-${rank}`} style={{ flex: 1 }} />;
              const size = rank === 1 ? 84 : 68;
              return (
                <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={[st.podiumItem, rank !== 1 && { paddingTop: space.lg }]} accessibilityRole="button" accessibilityLabel={`المركز ${rank}: ${r.profile.full_name}، ${r.points} نقطة`}>
                  <View>
                    <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={size} ring={MEDAL[rank - 1]} />
                    <View style={[st.rankBadge, { backgroundColor: MEDAL[rank - 1] }]}>
                      <Text style={st.rankBadgeText}>{rank}</Text>
                    </View>
                  </View>
                  <Text style={st.podiumName} numberOfLines={1}>{r.profile.full_name}</Text>
                  <Text style={st.podiumPoints}>{r.points} نقطة</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {rows.length ? (
          <ListGroup title="الترتيب الكامل">
            {rows.map((r, i) => (
              <Pressable key={r.profile.id} onPress={() => open(r.profile.id)} style={({ pressed }) => [st.row, pressed && { backgroundColor: c.cardAlt }]} accessibilityRole="button">
                <Text style={[st.pos, i < 3 && { color: MEDAL[i] }]}>{i + 1}</Text>
                <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.rowName} numberOfLines={1}>{r.profile.full_name}</Text>
                  <Text style={st.rowHint}>مستوى {Math.round(r.profile.skill_rating)}</Text>
                </View>
                <Text style={st.points}>{r.points}</Text>
                <Text style={st.rowHint}>نقطة</Text>
              </Pressable>
            ))}
          </ListGroup>
        ) : null}
        {rows.length ? <Text style={st.legend}>النقاط: فوز 3 · تعادل 1 · هدف 2 · صناعة 1 · رجل المباراة 3</Text> : null}
        </View>
      </PullRefreshScroll>
    </View>
  );
}

const useStyles = themed((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg },
  month: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, padding: space.sm },
  monthTitle: { ...type.headline },
  monthHint: { ...type.caption, color: c.muted },
  podium: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, paddingVertical: space.lg, paddingHorizontal: space.sm },
  podiumItem: { flex: 1, alignItems: 'center', gap: space.xs },
  rankBadge: { position: 'absolute', bottom: -6, alignSelf: 'center', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.card },
  rankBadgeText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: '#FFFFFF' },
  podiumName: { ...type.label, marginTop: space.sm, textAlign: 'center' },
  podiumPoints: { ...type.caption, color: c.muted },
  row: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  pos: { fontFamily: fonts.bold, fontSize: 15, width: 22, textAlign: 'center', color: c.muted },
  rowName: { ...type.label },
  rowHint: { ...type.caption, color: c.muted },
  points: { ...type.headline, fontSize: 17 },
  legend: { ...type.caption, color: c.muted, textAlign: 'center' },
}));
