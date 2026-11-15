import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CaptainPledge } from '../../components/CaptainPledge';
import { useToast } from '../../components/feedback';
import { Button, Empty, ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFullDate, formatIQD, formatTimeRange } from '../../lib/format';
import { finalPrice } from '../../lib/pricing';
import { spotsInfo } from '../../lib/schedule';
import { errMsg, useAsync, useNow } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

/** القائد يدخّل كل الفريق لمباراة نازلة — تبين بس المباريات اللي بيها مكان يكفي */
export default function TeamJoin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const team = useAsync(() => api.getTeam(id), [id]);
  const matches = useAsync(() => api.listOpenMatches(), []);
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

  if ((team.loading && !team.data) || (matches.loading && !matches.data)) return <Loading />;
  const t = team.data;
  if (!t) return <Empty title="الفريق مو موجود" icon="people-outline" />;
  const size = t.members.length;
  const list = (matches.data ?? []).filter(
    (m) => new Date(m.starts_at).getTime() > now && (!m.registration_opens_at || new Date(m.registration_opens_at).getTime() <= now),
  );
  const fits = list.filter((m) => spotsInfo(m).left >= size);

  async function join(matchId: string) {
    setBusy(matchId);
    setError(null);
    try {
      const n = await api.joinMatchWithTeam(matchId, id);
      toast(`انضاف ${n} لاعب من الفريق ✓`);
      router.replace({ pathname: '/match/[id]', params: { id: matchId } });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.content}>
      <Text variant="muted">
        تختار مباراة وكل لاعبين «{t.name}» ({size} لاعب) ينضافون لها سوا. تبين هنا بس المباريات اللي بيها مكان يكفي الفريق كله.
      </Text>
      <CaptainPledge value={pledge} onChange={setPledge} />
      <ErrorText message={error} />
      {fits.length === 0 ? <Empty title="ماكو مباراة بيها مكان لكل الفريق هسه" hint="اطلب مباراة للفريق من صفحة الفريق" icon="calendar-outline" /> : null}
      {fits.map((m) => {
        const spots = spotsInfo(m);
        return (
          <View key={m.id} style={st.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={st.name} numberOfLines={2}>{m.venue_name}</Text>
              <Text style={[st.left, { color: c.primary }]}>{spots.label}</Text>
            </View>
            <Text variant="small" style={{ color: c.muted }}>
              {formatFullDate(new Date(m.starts_at))} · {formatTimeRange(m.starts_at, m.ends_at)}
            </Text>
            {m.cost_per_player ? (
              <Text variant="small" style={{ color: c.muted }}>
                {formatIQD(finalPrice(m) ?? 0)} للاعب · المجموع على الفريق {formatIQD((finalPrice(m) ?? 0) * size)}
              </Text>
            ) : null}
            <Button title={`انضم بالفريق (${size})`} icon="people" disabled={!pledge} loading={busy === m.id} onPress={() => void join(m.id)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26, flex: 1 },
  left: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 24 },
}));
