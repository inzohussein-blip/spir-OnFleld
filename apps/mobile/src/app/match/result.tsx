import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { errMsg, useAsync } from '../../lib/session';
import type { MatchDetail, MatchEvent, RosterEntry, Team } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

type Counts = Record<string, { goal: number; assist: number }>;

function Stepper({ value, onChange, big }: { value: number; onChange: (n: number) => void; big?: boolean }) {
  const st = useStyles();
  return (
    <View style={st.stepper}>
      <Pressable onPress={() => onChange(value + 1)} style={st.stepBtn} hitSlop={6}><Text style={st.stepSign}>+</Text></Pressable>
      <Text style={[st.stepValue, big && { fontSize: 30, lineHeight: 42, minWidth: 44 }]}>{value}</Text>
      <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={st.stepBtn} hitSlop={6}><Text style={st.stepSign}>−</Text></Pressable>
    </View>
  );
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: m, loading } = useAsync(() => api.getMatch(id), [id]);
  if (loading || !m) return <Loading />;
  return <ResultEditor m={m} />;
}

function initialCounts(m: MatchDetail): Counts {
  const init: Counts = {};
  for (const e of m.events) {
    init[e.player_id] ??= { goal: 0, assist: 0 };
    init[e.player_id][e.kind]++;
  }
  return init;
}

function ResultEditor({ m }: { m: MatchDetail }) {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const [score, setScore] = useState<Record<Team, number>>({ A: m.score_a ?? 0, B: m.score_b ?? 0 });
  const [counts, setCounts] = useState<Counts>(() => initialCounts(m));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joined = m.roster.filter((r) => r.status === 'joined' && r.team);
  const get = (pid: string, k: 'goal' | 'assist') => counts[pid]?.[k] ?? 0;
  const set = (pid: string, k: 'goal' | 'assist', n: number) => setCounts((s) => ({ ...s, [pid]: { ...{ goal: 0, assist: 0 }, ...s[pid], [k]: n } }));
  const teamGoals = (t: Team) => joined.filter((r) => r.team === t).reduce((s, r) => s + get(r.player_id, 'goal'), 0);

  async function submit() {
    setError(null);
    for (const t of ['A', 'B'] as Team[]) {
      if (teamGoals(t) > score[t]) return setError(`عدد أهداف لاعبي ${t === 'A' ? 'الأزرق' : 'البرتقالي'} أكبر من نتيجة الفريق`);
    }
    const events: MatchEvent[] = [];
    for (const [player_id, cnt] of Object.entries(counts)) {
      for (let i = 0; i < cnt.goal; i++) events.push({ player_id, kind: 'goal' });
      for (let i = 0; i < cnt.assist; i++) events.push({ player_id, kind: 'assist' });
    }
    setBusy(true);
    try {
      await api.submitResult(m.id, { score_a: score.A, score_b: score.B, events });
      router.back();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const teamBlock = (t: Team, players: RosterEntry[]) => (
    <Card key={t}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h2" style={{ color: t === 'A' ? c.teamA : c.teamB }}>{t === 'A' ? 'الفريق الأزرق' : 'الفريق البرتقالي'}</Text>
        <Text variant="small" style={{ color: c.muted }}>أهداف مسجّلة {teamGoals(t)} من {score[t]}</Text>
      </Row>
      <Row style={{ justifyContent: 'flex-end', gap: 28 }}>
        <Text variant="small" style={{ color: c.muted }}>⚽ أهداف</Text>
        <Text variant="small" style={{ color: c.muted }}>🅰️ صناعة</Text>
      </Row>
      {players.map((r) => (
        <Row key={r.player_id} style={st.playerRow}>
          <Text style={{ flex: 1, fontFamily: fonts.semibold }} numberOfLines={2}>{r.profile.full_name}</Text>
          <Stepper value={get(r.player_id, 'goal')} onChange={(n) => set(r.player_id, 'goal', n)} />
          <Stepper value={get(r.player_id, 'assist')} onChange={(n) => set(r.player_id, 'assist', n)} />
        </Row>
      ))}
    </Card>
  );

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Text variant="h2">النتيجة النهائية</Text>
        <Row style={{ justifyContent: 'center', gap: 24, flexWrap: 'nowrap' }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: c.teamA, fontFamily: fonts.bold }}>الأزرق</Text>
            <Stepper big value={score.A} onChange={(n) => setScore((s) => ({ ...s, A: n }))} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: c.teamB, fontFamily: fonts.bold }}>البرتقالي</Text>
            <Stepper big value={score.B} onChange={(n) => setScore((s) => ({ ...s, B: n }))} />
          </View>
        </Row>
      </Card>
      {teamBlock('A', joined.filter((r) => r.team === 'A'))}
      {teamBlock('B', joined.filter((r) => r.team === 'B'))}
      <ErrorText message={error} />
      <Button title="حفظ النتيجة" icon="checkmark-circle" loading={busy} onPress={submit} />
      <Text variant="small" style={{ color: c.muted }}>تُحتسب الأهداف والصناعة في إحصائيات اللاعبين وقوائم المتصدرين.</Text>
    </Screen>
  );
}

const useStyles = themed((c) => ({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: c.primary },
  stepValue: { fontFamily: fonts.bold, fontSize: 16, minWidth: 22, textAlign: 'center' },
  playerRow: { flexWrap: 'nowrap', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border, gap: 12 },
}));
