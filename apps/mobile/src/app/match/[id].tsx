import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, ErrorText, Loading, Progress, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatFormat, formatIQD, POSITION_LABEL, SKILL_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { balanceTeams } from '../../lib/teamBalance';
import type { RosterEntry, Team } from '../../lib/types';
import { colors, fonts } from '../../theme';

function PlayerRow({ r, me }: { r: RosterEntry; me: boolean }) {
  return (
    <Row style={styles.player}>
      <Text style={styles.initial}>{r.profile.full_name.slice(0, 1)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>
          {r.profile.full_name}
          {me ? ' (أنت)' : ''}
        </Text>
        <Text variant="small" style={{ color: colors.muted }}>
          {POSITION_LABEL[r.position ?? r.profile.preferred_position]} · ★ {r.profile.skill_rating.toFixed(1)} · التزام {Math.round(r.profile.reliability_score)}%
        </Text>
      </View>
    </Row>
  );
}

function TeamColumn({ team, players, me }: { team: Team; players: RosterEntry[]; me: string | null }) {
  const total = players.reduce((s, r) => s + r.profile.skill_rating, 0);
  const color = team === 'A' ? colors.teamA : colors.teamB;
  return (
    <View style={[styles.teamCol, { borderColor: color }]}>
      <Text style={{ fontFamily: fonts.bold, color }}>{team === 'A' ? 'الفريق الأزرق' : 'الفريق البرتقالي'}</Text>
      <Text variant="small" style={{ color: colors.muted }}>مجموع المستوى {total.toFixed(1)}</Text>
      {players.map((r) => (
        <Text key={r.player_id} variant="small" numberOfLines={1}>
          {r.position === 'goalkeeper' || r.profile.preferred_position === 'goalkeeper' ? '🧤 ' : '• '}
          {r.profile.full_name}
          {r.player_id === me ? ' (أنت)' : ''}
        </Text>
      ))}
    </View>
  );
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
  const finished = new Date(m.ends_at) < new Date();
  const left = m.max_players - joined.length;
  const hasTeams = joined.some((r) => r.team);

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

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h2">{joined.length} / {m.max_players} لاعب</Text>
          <Text style={{ fontFamily: fonts.bold, color: left > 0 ? colors.primary : colors.accent }}>
            {finished ? 'انتهت' : left > 0 ? `باقي ${left}` : 'مكتملة'}
          </Text>
        </Row>
        <Progress value={joined.length} max={m.max_players} />
        {waitlist.length ? <Text variant="small" style={{ color: colors.muted }}>قائمة الانتظار: {waitlist.length}</Text> : null}
      </Card>

      <ErrorText message={actionError} />

      {!finished ? (
        mine ? (
          <>
            {mine.status === 'waitlist' ? (
              <Card style={{ backgroundColor: '#FFF4CC', borderColor: '#FFF4CC' }}>
                <Text>أنت في قائمة الانتظار — ستنضم تلقائياً عند انسحاب أحد اللاعبين.</Text>
              </Card>
            ) : null}
            <Button title="انسحاب من المباراة" variant="danger" loading={busy} onPress={() => act(() => api.leaveMatch(m.id))} />
          </>
        ) : (
          <Button title={left > 0 ? 'انضم للمباراة' : 'سجّل في قائمة الانتظار'} loading={busy} onPress={() => act(() => api.joinMatch(m.id))} />
        )
      ) : mine?.status === 'joined' ? (
        <Button title="⭐ قيّم اللاعبين" onPress={() => router.push({ pathname: '/match/rate', params: { id: m.id } })} />
      ) : null}

      <Button title="📤 مشاركة الدعوة (واتساب)" variant="outline" onPress={share} />

      <Text variant="h2">الفريقان</Text>
      {hasTeams ? (
        <Row style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
          <TeamColumn team="A" players={joined.filter((r) => r.team === 'A')} me={userId} />
          <TeamColumn team="B" players={joined.filter((r) => r.team === 'B')} me={userId} />
        </Row>
      ) : (
        <Text variant="muted">لم يُقسَّم الفريقان بعد.</Text>
      )}
      {isOrganizer && !finished && joined.length >= 2 ? (
        <Button title={hasTeams ? '🔀 أعد التقسيم تلقائياً' : '⚖️ قسّم الفريقين حسب المستوى'} variant="outline" loading={busy} onPress={autoBalance} />
      ) : null}

      <Text variant="h2">اللاعبون</Text>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {joined.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} />)}
      </Card>
      {waitlist.length ? (
        <>
          <Text variant="h2">قائمة الانتظار</Text>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {waitlist.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} />)}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexWrap: 'nowrap' },
  initial: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, color: colors.primaryDark, textAlign: 'center',
    lineHeight: 38, fontFamily: fonts.bold, overflow: 'hidden',
  },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 2, backgroundColor: '#fff' },
});
