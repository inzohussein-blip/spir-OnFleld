import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { errMsg, useAsync, useSession } from '../../lib/session';
import type { RatingInput } from '../../lib/types';
import { fonts, useColors } from '../../theme';

type Axis = 'skill' | 'teamwork' | 'sportsmanship';
const AXES: [Axis, string][] = [
  ['skill', 'المهارة'],
  ['teamwork', 'اللعب الجماعي'],
  ['sportsmanship', 'الروح الرياضية'],
];

function StarsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colors = useColors();
  return (
    <Row style={{ gap: 2, flexWrap: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={{ fontSize: 24, color: n <= value ? colors.accent : colors.border }}>★</Text>
        </Pressable>
      ))}
    </Row>
  );
}

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const colors = useColors();
  const { data: m, loading } = useAsync(() => api.getMatch(id), [id]);
  const [scores, setScores] = useState<Record<string, Record<Axis, number>>>({});
  const [mvp, setMvp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (loading || !m) return <Loading />;
  const others = m.roster.filter((r) => r.status === 'joined' && r.player_id !== userId);
  const get = (pid: string, a: Axis) => scores[pid]?.[a] ?? 0;
  const set = (pid: string, a: Axis, n: number) =>
    setScores((s) => ({ ...s, [pid]: { ...{ skill: 0, teamwork: 0, sportsmanship: 0 }, ...s[pid], [a]: n } }));

  async function submit() {
    const ratings: RatingInput[] = others
      .filter((r) => AXES.every(([a]) => get(r.player_id, a) > 0))
      .map((r) => ({ ratee_id: r.player_id, skill: get(r.player_id, 'skill'), teamwork: get(r.player_id, 'teamwork'), sportsmanship: get(r.player_id, 'sportsmanship') }));
    if (!ratings.length) return setError('قيّم لاعباً واحداً على الأقل في المحاور الثلاثة');
    setBusy(true);
    setError(null);
    try {
      await api.submitRatings(m!.id, ratings, mvp);
      setDone(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Text variant="title">شكراً لتقييمك 🙏</Text>
        <Text variant="muted">تقييمك مجهول الهوية ويساعد في تقسيم فرق عادلة بالمباريات القادمة.</Text>
        <Button title="رجوع للمباراة" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="muted">التقييم مجهول — لن يعرف اللاعب من قيّمه. يمكنك تخطّي أي لاعب.</Text>
      {others.map((r) => (
        <Card key={r.player_id}>
          <Text variant="h2">{r.profile.full_name}</Text>
          {AXES.map(([a, label]) => (
            <Row key={a} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Text>{label}</Text>
              <StarsInput value={get(r.player_id, a)} onChange={(n) => set(r.player_id, a, n)} />
            </Row>
          ))}
        </Card>
      ))}
      <Text variant="h2">🏆 أفضل لاعب في المباراة</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {others.map((r) => (
          <Chip key={r.player_id} label={r.profile.full_name} active={mvp === r.player_id} onPress={() => setMvp(mvp === r.player_id ? null : r.player_id)} />
        ))}
      </View>
      <ErrorText message={error} />
      <Button title="إرسال التقييم" loading={busy} onPress={submit} />
      <Text variant="small" style={{ color: colors.muted, fontFamily: fonts.regular }}>يمكن التقييم خلال 48 ساعة من نهاية المباراة.</Text>
    </Screen>
  );
}
