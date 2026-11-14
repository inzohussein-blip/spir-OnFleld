import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LeaderList } from '../../components/LeaderList';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Empty, ErrorText, Input, Loading, Row, Screen, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatIQD, TOURNAMENT_STATUS as STATUS_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { computeStandings } from '../../lib/stats';
import type { Fixture, TournamentDetail, TournamentTeam } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

type Tab = 'standings' | 'fixtures' | 'board' | 'teams';
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
  if (!t) return <Screen><ErrorText message={error ?? 'البطولة مو موجودة'} /></Screen>;

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
          { value: 'standings', label: 'القرعة', icon: 'grid' },
          { value: 'fixtures', label: 'المباريات', icon: 'calendar' },
          { value: 'board', label: 'اللوحة', icon: 'stats-chart' },
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
                  {([['played', r.played], ['won', r.won], ['drawn', r.drawn], ['lost', r.lost], ['gd', r.gd > 0 ? `+${r.gd}` : r.gd], ['points', r.points]] as const).map(([col, v]) => (
                    <Text key={col} style={[st.td, col === 'points' && { fontFamily: fonts.bold, color: c.primary }]}>{v}</Text>
                  ))}
                </View>
              ))}
              <Text variant="small" style={{ color: c.muted, marginTop: 6 }}>🟩 المتأهلان إلى الدور التالي</Text>
            </Card>
          ))
        ) : (
          <Empty title="القرعة بعدها ما صارت" hint="يظهر الترتيب بعد توزيع الفرق على المجموعات." icon="grid-outline" />
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
                    <View style={[st.teamBox, { alignItems: 'flex-start' }]}>
                      <Text style={st.teamCell} numberOfLines={1}>{teamName_(f.home_id)}</Text>
                    </View>
                    {/* المضيف ونتيجته على جهة البداية (اليمين) */}
                    <View style={st.score}>
                      <Text style={st.scoreText}>{f.home_score ?? '-'}</Text>
                      <Text style={st.scoreSep}>:</Text>
                      <Text style={st.scoreText}>{f.away_score ?? '-'}</Text>
                    </View>
                    <View style={[st.teamBox, { alignItems: 'flex-end' }]}>
                      <Text style={st.teamCell} numberOfLines={1}>{teamName_(f.away_id)}</Text>
                    </View>
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
          <Empty title="بعد ماكو مباريات" icon="calendar-outline" />
        )
      ) : null}

      {tab === 'board' ? <TournamentBoard t={t} onOpen={(pid) => router.push({ pathname: '/player/[id]', params: { id: pid } })} /> : null}

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

type BoardTab = 'stats' | 'potm';

/** لوحة البطولة: الهدافون، صنّاع اللعب، الكروت، لاعب البطولة */
function TournamentBoard({ t, onOpen }: { t: TournamentDetail; onOpen: (playerId: string) => void }) {
  const c = useColors();
  const [sub, setSub] = useState<BoardTab>('stats');
  const ps = t.player_stats;
  const rows = (pick: (r: (typeof ps)[number]) => number) =>
    ps.map((r) => ({ profile: r.profile, value: pick(r) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const best = [...ps].sort((a, b) => b.goals * 3 + b.assists * 2 - b.red * 3 - b.yellow - (a.goals * 3 + a.assists * 2 - a.red * 3 - a.yellow))[0];

  const section = (title: string, hint: string, icon: 'football' | 'git-merge' | 'card', color: string, list: { profile: (typeof ps)[number]['profile']; value: number }[], unit: string) => (
    <Card key={title}>
      <Row style={{ flexWrap: 'nowrap' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{title}</Text>
          <Text variant="small" style={{ color: c.muted }}>{hint}</Text>
        </View>
      </Row>
      {list.length ? <LeaderList rows={list} unit={unit} onPress={onOpen} /> : <Text variant="muted" style={{ textAlign: 'center', paddingVertical: 10 }}>ماكو بيانات بعد</Text>}
    </Card>
  );

  return (
    <>
      <Segmented<BoardTab>
        value={sub}
        onChange={setSub}
        options={[
          { value: 'stats', label: 'الإحصائيات', icon: 'stats-chart' },
          { value: 'potm', label: 'لاعب البطولة', icon: 'ribbon' },
        ]}
      />
      {sub === 'stats' ? (
        <>
          {section('الهدافون', 'أكثر اللاعبين تسجيلاً بالبطولة', 'football', '#1C8B4A', rows((r) => r.goals), 'هدف')}
          {section('صنّاع اللعب', 'أكثر اللاعبين صناعة بالبطولة', 'git-merge', c.primary, rows((r) => r.assists), 'صناعة')}
          {section('الكروت', 'أكثر اللاعبين حصولاً على الإنذارات (الأحمر = 2)', 'card', c.danger, rows((r) => r.yellow + r.red * 2), 'إنذار')}
        </>
      ) : best ? (
        <Card style={{ alignItems: 'center' }}>
          <Ionicons name="ribbon" size={40} color={c.accent} />
          <Text variant="title">{best.profile.full_name}</Text>
          <Text variant="muted">لاعب البطولة حتى الآن</Text>
          <Row style={{ justifyContent: 'center' }}>
            <Badge label={`⚽ ${best.goals} هدف`} />
            <Badge label={`🅰️ ${best.assists} صناعة`} tone="gray" />
            <Badge label={`🟨 ${best.yellow}  🟥 ${best.red}`} tone="gray" />
          </Row>
          <Button title="عرض البطاقة" variant="ghost" onPress={() => onOpen(best.profile.id)} />
        </Card>
      ) : (
        <Empty title="لاعب البطولة بعده ما تحدد" icon="ribbon-outline" />
      )}
    </>
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
  teamBox: { flex: 1 },
  teamCell: { fontFamily: fonts.semibold, fontSize: 15 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.cardAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, marginHorizontal: 8 },
  scoreText: { fontFamily: fonts.bold, fontSize: 18 },
  scoreSep: { fontFamily: fonts.bold, fontSize: 16, color: c.muted },
  teamRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, flexWrap: 'nowrap' },
  shield: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
}));
