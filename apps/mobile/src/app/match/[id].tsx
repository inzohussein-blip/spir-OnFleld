import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Badge, Button, Card, ErrorText, Loading, Progress, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatFormat, formatIQD, POSITION_LABEL, SKILL_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { balanceTeams } from '../../lib/teamBalance';
import type { MatchDetail, RosterEntry, Team } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

function PlayerRow({ r, me, onPress }: { r: RosterEntry; me: boolean; onPress: () => void }) {
  const st = useStyles();
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={st.player}>
      <View style={st.initial}><Text style={{ fontFamily: fonts.bold, color: c.primary }}>{r.profile.full_name.slice(0, 1)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>
          {r.profile.full_name}
          {me ? ' (أنت)' : ''}
        </Text>
        <Text variant="small" style={{ color: c.muted }}>
          {POSITION_LABEL[r.position ?? r.profile.preferred_position]} · ★ {r.profile.skill_rating.toFixed(1)} · التزام {Math.round(r.profile.reliability_score)}%
        </Text>
      </View>
    </Pressable>
  );
}

function TeamColumn({ team, players, me, m }: { team: Team; players: RosterEntry[]; me: string | null; m: MatchDetail }) {
  const st = useStyles();
  const c = useColors();
  const total = players.reduce((s, r) => s + r.profile.skill_rating, 0);
  const color = team === 'A' ? c.teamA : c.teamB;
  const count = (pid: string, kind: 'goal' | 'assist') => m.events.filter((e) => e.player_id === pid && e.kind === kind).length;
  return (
    <View style={[st.teamCol, { borderColor: color }]}>
      <Text style={{ fontFamily: fonts.bold, color }}>{team === 'A' ? 'الفريق الأزرق' : 'الفريق البرتقالي'}</Text>
      <Text variant="small" style={{ color: c.muted }}>مجموع المستوى {total.toFixed(1)}</Text>
      {players.map((r) => {
        const g = count(r.player_id, 'goal');
        const a = count(r.player_id, 'assist');
        return (
          <Text key={r.player_id} variant="small" numberOfLines={2}>
            {r.position === 'goalkeeper' || r.profile.preferred_position === 'goalkeeper' ? '🧤 ' : '• '}
            {r.profile.full_name}
            {r.player_id === me ? ' (أنت)' : ''}
            {g ? ` ⚽${g > 1 ? `×${g}` : ''}` : ''}
            {a ? ` 🅰️${a > 1 ? `×${a}` : ''}` : ''}
          </Text>
        );
      })}
    </View>
  );
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { userId } = useSession();
  const { data: m, error, loading, reload } = useAsync(() => api.getMatch(id), [id]);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !m) return <Loading />;
  if (!m) return <Screen><ErrorText message={error ?? 'المباراة غير موجودة'} /></Screen>;

  const joined = m.roster.filter((r) => r.status === 'joined');
  const waitlist = m.roster.filter((r) => r.status === 'waitlist');
  const mine = m.roster.find((r) => r.player_id === userId);
  const isOrganizer = m.organizer_id === userId;
  const started = new Date(m.starts_at) < new Date();
  const finished = new Date(m.ends_at) < new Date();
  const left = m.max_players - joined.length;
  const hasTeams = joined.some((r) => r.team);
  const hasResult = m.score_a != null && m.score_b != null;
  const openPlayer = (pid: string) => router.push({ pathname: '/player/[id]', params: { id: pid } });

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const autoBalance = () =>
    act(() => {
      const res = balanceTeams(joined.map((r) => ({ id: r.player_id, rating: r.profile.skill_rating, position: r.position ?? r.profile.preferred_position })));
      return api.saveTeams(m.id, res.assignments);
    });

  const share = () =>
    Share.share({
      message:
        `⚽ ${m.title || 'مباراة ' + formatFormat(m.players_per_side)}\n` +
        `📍 ${m.venue_name ?? ''} ${m.field_name ? '· ' + m.field_name : ''}\n` +
        `🕒 ${formatDateTime(m.starts_at)}\n` +
        (left > 0 ? `باقي ${left} لاعبين — انضم عبر تطبيق بالملعب!` : 'العدد مكتمل — سجّل بقائمة الانتظار على تطبيق بالملعب') +
        `\nbalmalaab://match/${m.id}`,
    });

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="title">{m.title || `مباراة ${formatFormat(m.players_per_side)}`}</Text>
          {isOrganizer ? <Badge label="أنت المنظّم" tone="yellow" /> : null}
        </Row>
        <Text variant="muted">📍 {m.venue_name ?? 'بدون ساحة'}{m.field_name ? ` · ${m.field_name}` : ''}</Text>
        <Text variant="muted">🕒 {formatDateTime(m.starts_at)}</Text>
        <Row>
          <Badge label={formatFormat(m.players_per_side)} tone="gray" />
          <Badge label={SKILL_LABEL[m.skill_level]} tone="gray" />
          <Badge label={m.visibility === 'public' ? 'عامة' : 'خاصة'} tone="gray" />
          {m.cost_per_player ? <Badge label={`${formatIQD(m.cost_per_player)} للاعب`} /> : null}
        </Row>
      </Card>

      {hasResult ? (
        <View style={st.scoreBoard}>
          {/* عناصر منفصلة: في الاتجاه من اليمين لليسار يظهر الأزرق ونتيجته يميناً */}
          <View style={st.scoreSide}><Text style={[st.scoreTeam, { color: '#9CC8FF' }]}>الأزرق</Text></View>
          <Text style={st.scoreBig}>{m.score_a}</Text>
          <Text style={st.scoreDash}>-</Text>
          <Text style={st.scoreBig}>{m.score_b}</Text>
          <View style={st.scoreSide}><Text style={[st.scoreTeam, { color: '#FFC08A' }]}>البرتقالي</Text></View>
        </View>
      ) : (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="h2">{joined.length} من {m.max_players} لاعب</Text>
            <Text style={{ fontFamily: fonts.bold, color: left > 0 ? c.primary : c.accent }}>
              {finished ? 'انتهت' : left > 0 ? `باقي ${left}` : 'مكتملة'}
            </Text>
          </Row>
          <Progress value={joined.length} max={m.max_players} />
          {waitlist.length ? <Text variant="small" style={{ color: c.muted }}>قائمة الانتظار: {waitlist.length}</Text> : null}
        </Card>
      )}

      <ErrorText message={actionError} />

      {!finished ? (
        mine ? (
          <>
            {mine.status === 'waitlist' ? (
              <Card style={{ backgroundColor: c.warnSoft, borderColor: c.warnSoft }}>
                <Text style={{ color: c.warnText }}>أنت في قائمة الانتظار — ستنضم تلقائياً عند انسحاب أحد اللاعبين.</Text>
              </Card>
            ) : null}
            <Button title="انسحاب من المباراة" variant="danger" icon="exit" loading={busy} onPress={() => act(() => api.leaveMatch(m.id))} />
          </>
        ) : (
          <Button title={left > 0 ? 'انضم للمباراة' : 'سجّل في قائمة الانتظار'} icon="add-circle" loading={busy} onPress={() => act(() => api.joinMatch(m.id))} />
        )
      ) : null}

      {isOrganizer && started && hasTeams ? (
        <Button
          title={hasResult ? 'تعديل النتيجة والهدّافين' : 'سجّل النتيجة والهدّافين'}
          icon="create"
          variant={hasResult ? 'outline' : 'primary'}
          onPress={() => router.push({ pathname: '/match/result', params: { id: m.id } })}
        />
      ) : null}
      {finished && mine?.status === 'joined' ? (
        <Button title="قيّم اللاعبين واختر رجل المباراة" icon="star" variant="outline" onPress={() => router.push({ pathname: '/match/rate', params: { id: m.id } })} />
      ) : null}
      {!finished ? <Button title="مشاركة الدعوة (واتساب)" icon="share-social" variant="outline" onPress={share} /> : null}

      <Text variant="h2">الفريقان</Text>
      {hasTeams ? (
        <Row style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
          <TeamColumn team="A" players={joined.filter((r) => r.team === 'A')} me={userId} m={m} />
          <TeamColumn team="B" players={joined.filter((r) => r.team === 'B')} me={userId} m={m} />
        </Row>
      ) : (
        <Text variant="muted">لم يُقسَّم الفريقان بعد.</Text>
      )}
      {isOrganizer && !finished && joined.length >= 2 ? (
        <Button title={hasTeams ? 'أعد التقسيم تلقائياً' : 'قسّم الفريقين حسب المستوى'} icon="git-compare" variant="outline" loading={busy} onPress={autoBalance} />
      ) : null}

      <Text variant="h2">اللاعبون</Text>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {joined.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
      </Card>
      {waitlist.length ? (
        <>
          <Text variant="h2">قائمة الانتظار</Text>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {waitlist.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = themed((c) => ({
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  initial: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 2, backgroundColor: c.card },
  scoreBoard: { backgroundColor: '#0E1730', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeam: { fontFamily: fonts.bold, fontSize: 15 },
  scoreBig: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 56, color: '#fff', minWidth: 36, textAlign: 'center' },
  scoreDash: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 56, color: 'rgba(255,255,255,0.6)', marginHorizontal: 6 },
}));
