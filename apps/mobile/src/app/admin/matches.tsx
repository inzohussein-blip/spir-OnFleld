import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Badge, Button, Empty, ErrorText, Loading, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatClock, formatFormat, formatIQD, relativeDay } from '../../lib/format';
import { finalPrice } from '../../lib/pricing';
import { useAsync } from '../../lib/session';
import type { Match } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

type Filter = 'upcoming' | 'past' | 'cancelled';

/** حالة المباراة بعين الموظف */
function statusOf(m: Match, now: number): { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' } {
  if (m.status === 'cancelled') return { label: 'ملغية', tone: 'red' };
  if (new Date(m.ends_at).getTime() <= now) return { label: 'انتهت', tone: 'gray' };
  if (new Date(m.starts_at).getTime() <= now) return { label: 'هسه تلعب', tone: 'yellow' };
  if (m.joined_count >= m.max_players) return { label: 'مكتملة', tone: 'green' };
  if (m.registration_opens_at && new Date(m.registration_opens_at).getTime() > now) return { label: 'التسجيل بعده', tone: 'gray' };
  return { label: `باقي ${m.max_players - m.joined_count}`, tone: 'yellow' };
}

/**
 * لوحة الموظفين ← إدارة المباريات: كل المباريات من أمس وطالع مقسّمة بالأيام.
 * الضغط على المباراة يفتح صفحتها، وبيها أدوات الموظف: الإلغاء، تقسيم الفريقين، النتيجة، والتسكير.
 */
export default function StaffMatches() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const { data, loading, error, reload } = useAsync(() => api.staffListMatches(), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const list = (data ?? []).filter((m) => {
      const over = new Date(m.ends_at).getTime() <= now;
      if (filter === 'cancelled') return m.status === 'cancelled';
      if (m.status === 'cancelled') return false;
      return filter === 'past' ? over : !over;
    });
    if (filter === 'past') list.reverse();
    const out: { day: string; items: Match[] }[] = [];
    for (const m of list) {
      const day = relativeDay(new Date(m.starts_at));
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [data, filter, now]);

  const counts = useMemo(() => {
    const all = data ?? [];
    const live = all.filter((m) => m.status !== 'cancelled' && new Date(m.ends_at).getTime() > now);
    return {
      upcoming: live.length,
      players: live.reduce((n, m) => n + m.joined_count, 0),
      full: live.filter((m) => m.joined_count >= m.max_players).length,
    };
  }, [data, now]);

  if (loading && !data) return <Loading />;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.stats}>
        <Stat value={counts.upcoming} label="مباراة جاية" />
        <Stat value={counts.players} label="لاعب منضم" />
        <Stat value={counts.full} label="مكتملة" />
      </View>
      <Button title="مباراة جديدة" icon="add-circle-outline" onPress={() => router.push('/admin/new-match')} />
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'upcoming', label: 'الجاية' },
          { value: 'past', label: 'انتهت' },
          { value: 'cancelled', label: 'الملغية' },
        ]}
      />
      <ErrorText message={error} />
      {groups.length === 0 ? <Empty title={filter === 'cancelled' ? 'ماكو مباريات ملغية' : 'ماكو مباريات هنا'} icon="football-outline" /> : null}
      {groups.map((g) => (
        <View key={g.day} style={{ gap: 8 }}>
          <Text style={st.day}>{g.day}</Text>
          {g.items.map((m) => {
            const s = statusOf(m, now);
            const fill = Math.min(1, m.joined_count / Math.max(1, m.max_players));
            const price = m.cost_per_player ? formatIQD(finalPrice(m) ?? 0) : null;
            return (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
                style={({ pressed }) => [st.row, m.status === 'cancelled' && { opacity: 0.6 }, pressed && { backgroundColor: c.cardAlt }]}
                accessibilityRole="button"
              >
                <View style={st.time}>
                  <Text style={st.clock}>{formatClock(m.starts_at).split(' ')[0]}</Text>
                  <Text style={st.mer}>{formatClock(m.starts_at).split(' ')[1] === 'م' ? 'مساءً' : 'صباحاً'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={st.venue} numberOfLines={1}>{m.venue_name ?? m.title ?? 'مباراة'}</Text>
                    <Badge label={s.label} tone={s.tone} />
                  </View>
                  <Text variant="small" style={{ color: c.muted }} numberOfLines={1}>
                    {[m.field_name, formatFormat(m.players_per_side), price, m.discount_pct ? `خصم ${m.discount_pct}%` : null].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={st.track}>
                    <View style={[st.fill, { width: `${fill * 100}%` }]} />
                  </View>
                  <Text variant="small" style={{ color: c.muted }}>
                    {m.joined_count} من {m.max_players} لاعب
                  </Text>
                </View>
                <Ionicons name="chevron-back" size={20} color={c.muted} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View style={st.stat}>
      <Text style={st.statValue}>{value}</Text>
      <Text variant="small" style={{ color: c.muted }}>{label}</Text>
    </View>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 16, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 38, color: c.primary },
  day: { fontFamily: fonts.display, fontSize: 17, lineHeight: 28, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 10, overflow: 'hidden' },
  time: { width: 64, alignSelf: 'stretch', borderRadius: 10, backgroundColor: c.timeBg, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  clock: { fontFamily: fonts.display, fontSize: 19, lineHeight: 28, color: c.onTime },
  mer: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: c.onTimeSub },
  venue: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24, flexShrink: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },
}));
