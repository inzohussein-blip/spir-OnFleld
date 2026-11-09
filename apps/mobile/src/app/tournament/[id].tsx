import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LeaderList } from '../../components/LeaderList';
import { Badge, Button, Card, Empty, ErrorText, Input, Loading, Row, Screen, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatIQD, TOURNAMENT_STATUS as STATUS_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { computeStandings } from '../../lib/stats';
import type { Fixture, TournamentTeam } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

type Tab = 'standings' | 'fixtures' | 'scorers' | 'teams';
const STAGE: Record<string, string> = { group: 'دور المجموعات', round16: 'دور الـ 16', quarter: 'ربع النهائي', semi: 'نصف النهائي', final: 'النهائي' };

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const { userId } = useSession();
  const { data: t, loading, error, reload } = useAsync(() => api.getTournament(id), [id]);
  const [tab, setTab] = useState<Tab>('standings');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  if (loading && !t) return <Loading />;
  if (!t) return <Screen><ErrorText message={error ?? 'البطولة غير موجودة'} /></Screen>;

  const teamName_ = (tid: string | null) => t.teams.find((x) => x.id === tid)?.name ?? 'غير محدد';
  const groups = computeStandings(t.teams.filter((x) => x.group_name), t.fixtures);
  const myTeam = t.teams.find((x) => x.captain_id === userId);
  const status = STATUS_LABEL[t.status];

  async function register() {
    setBusy(true);
    setRegError(null);
    try {
      await api.registerTeam(t!.id, teamName);
      setTeamName('');
      await reload();
    } catch (e) {
      setRegError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const byStage = t.fixtures.reduce<Record<string, Fixture[]>>((acc, f) => ((acc[f.stage] ??= []).push(f), acc), {});

  return (
    <Screen>
      <Stack.Screen options={{ title: t.name }} />
      <View style={st.fees}>
        <Text style={st.feesTitle}>سعر الاشتراك</Text>
        <Row style={{ gap: 18 }}>
          <View><Text style={st.feesLabel}>الفريق</Text><Text style={st.feesValue}>{formatIQD(t.team_fee)}</Text></View>
          <View><Text style={st.feesLabel}>اللاعب</Text><Text style={st.feesValue}>{formatIQD(t.player_fee)}</Text></View>
        </Row>
      </View>
      <Row>
        <Badge label={status.label} tone={status.tone} />
        <Badge label={`📍 ${t.venue_name}`} tone="gray" />
        <Badge label={t.format} tone="gray" />
        {t.prize ? <Badge label={`🏆 ${t.prize}`} tone="yellow" /> : null}
      </Row>

      {t.status === 'registration' ? (
        <Card>
          <Text variant="h2">سجّل فريقك</Text>
          {myTeam ? (
            <Text style={{ color: c.primary }}>✓ فريقك «{myTeam.name}» مسجّل — بانتظار القرعة.</Text>
          ) : (
            <>
              <Text variant="muted">أنت الكابتن. باقي {t.team_count - t.registered_teams} أماكن.</Text>
              <Input placeholder="اسم الفريق" value={teamName} onChangeText={setTeamName} />
              <ErrorText message={regError} />
              <Button title="تسجيل الفريق" icon="shield-checkmark" loading={busy} onPress={register} />
            </>
          )}
        </Card>
      ) : null}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'standings', label: 'الترتيب', icon: 'grid' },
          { value: 'fixtures', label: 'المباريات', icon: 'calendar' },
          { value: 'scorers', label: 'الهدافون', icon: 'football' },
          { value: 'teams', label: 'الفرق', icon: 'people' },
        ]}
      />

      {tab === 'standings' ? (
        Object.keys(groups).length ? (
          Object.entries(groups).map(([g, rows]) => (
            <Card key={g} style={{ gap: 0 }}>
              <Text variant="h2">المجموعة {g}</Text>
              <View style={st.tr}>
                <Text style={[st.th, { flex: 1 }]}>الفريق</Text>
                {['لعب', 'ف', 'ت', 'خ', '+/-', 'نقاط'].map((h) => <Text key={h} style={st.th}>{h}</Text>)}
              </View>
              {rows.map((r, i) => (
                <View key={r.team.id} style={[st.tr, i < 2 && { backgroundColor: c.primarySoft }]}>
                  <Text style={[st.td, { flex: 1, textAlign: 'auto', fontFamily: fonts.semibold }]} numberOfLines={1}>{i + 1}. {r.team.name}</Text>
                  {[r.played, r.won, r.drawn, r.lost, r.gd > 0 ? `+${r.gd}` : r.gd, r.points].map((v, k) => (
                    <Text key={k} style={[st.td, k === 5 && { fontFamily: fonts.bold, color: c.primary }]}>{v}</Text>
                  ))}
                </View>
              ))}
              <Text variant="small" style={{ color: c.muted, marginTop: 6 }}>🟩 المتأهلان إلى الدور التالي</Text>
            </Card>
          ))
        ) : (
          <Empty title="لم تُجرَ القرعة بعد" hint="يظهر الترتيب بعد توزيع الفرق على المجموعات." icon="grid-outline" />
        )
      ) : null}

      {tab === 'fixtures' ? (
        t.fixtures.length ? (
          Object.entries(byStage).map(([stage, list]) => (
            <View key={stage} style={{ gap: 8 }}>
              <Text variant="h2">{STAGE[stage] ?? stage}</Text>
              {list.map((f) => (
                <Card key={f.id}>
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <Text style={st.teamCell} numberOfLines={1}>{teamName_(f.home_id)}</Text>
                    <View style={st.score}>
                      <Text style={st.scoreText}>{f.home_score ?? '-'} : {f.away_score ?? '-'}</Text>
                    </View>
                    <Text style={[st.teamCell, { textAlign: 'left' }]} numberOfLines={1}>{teamName_(f.away_id)}</Text>
                  </Row>
                  <Text variant="small" style={{ color: c.muted, textAlign: 'center' }}>
                    {f.group_name ? `المجموعة ${f.group_name} · ` : ''}
                    {f.home_score == null ? (f.starts_at ? formatDateTime(f.starts_at) : 'لم يحدد الموعد') : 'انتهت'}
                  </Text>
                </Card>
              ))}
            </View>
          ))
        ) : (
          <Empty title="لا توجد مباريات بعد" icon="calendar-outline" />
        )
      ) : null}

      {tab === 'scorers' ? (
        t.scorers.length ? (
          <Card><LeaderList rows={t.scorers} unit="هدف" onPress={(pid) => router.push({ pathname: '/player/[id]', params: { id: pid } })} /></Card>
        ) : (
          <Empty title="ماكو بيانات بعد" hint="تظهر قائمة الهدافين بعد أول مباراة." icon="football-outline" />
        )
      ) : null}

      {tab === 'teams' ? (
        <Card style={{ gap: 0 }}>
          {t.teams.map((team: TournamentTeam) => (
            <Row key={team.id} style={st.teamRow}>
              <View style={st.shield}><Text style={{ fontFamily: fonts.bold, color: c.primary }}>{team.name.slice(0, 1)}</Text></View>
              <Text style={{ flex: 1, fontFamily: fonts.semibold }}>{team.name}</Text>
              {team.group_name ? <Badge label={`المجموعة ${team.group_name}`} tone="gray" /> : null}
              {team.captain_id === userId ? <Badge label="فريقك" tone="yellow" /> : null}
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const useStyles = themed((c) => ({
  fees: { backgroundColor: c.primary, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feesTitle: { fontFamily: fonts.bold, color: c.onPrimary, fontSize: 16 },
  feesLabel: { color: c.onPrimary, opacity: 0.8, fontSize: 12 },
  feesValue: { color: c.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border, borderRadius: 6 },
  th: { width: 36, textAlign: 'center', color: c.muted, fontSize: 12 },
  td: { width: 36, textAlign: 'center', fontSize: 14 },
  teamCell: { flex: 1, fontFamily: fonts.semibold, fontSize: 15 },
  score: { backgroundColor: c.cardAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, marginHorizontal: 8 },
  scoreText: { fontFamily: fonts.bold, fontSize: 18, writingDirection: 'ltr' },
  teamRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, flexWrap: 'nowrap' },
  shield: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
}));
