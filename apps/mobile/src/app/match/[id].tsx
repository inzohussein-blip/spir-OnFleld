import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionPill } from '../../components/MatchRow';
import { Badge, Card, ErrorText, Loading, Progress, Row, Screen, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatClock, formatDateTime, formatFormat, formatIQD, POSITION_LABEL, SKILL_LABEL } from '../../lib/format';
import { matchAction } from '../../lib/matchAction';
import { errMsg, useAsync, useNow, useSession } from '../../lib/session';
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
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
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
  const started = new Date(m.starts_at).getTime() < now;
  const finished = new Date(m.ends_at).getTime() < now;
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

  const action = matchAction(m, now);
  const primaryPress = () => act(() => api.joinMatch(m.id));
  const startsDate = new Date(m.starts_at);
  const dateText = `${startsDate.getFullYear()}-${String(startsDate.getMonth() + 1).padStart(2, '0')}-${String(startsDate.getDate()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen style={{ paddingBottom: 140 }}>
        {/* رأس المباراة */}
        <View style={st.hero}>
          <View style={st.heroHalf} />
          <View style={st.heroCircle} />
          <View style={st.heroBadges}>
            <Badge label={formatFormat(m.players_per_side)} tone="yellow" />
            {isOrganizer ? <Badge label="أنت المنظّم" tone="gray" /> : null}
          </View>
          <Text style={st.heroTitle}>{m.title || m.venue_name || 'مباراة'}</Text>
        </View>

        {hasResult ? (
          <View style={st.scoreBoard}>
            {/* عناصر منفصلة: في الاتجاه من اليمين لليسار يظهر الأزرق ونتيجته يميناً */}
            <View style={st.scoreSide}><Text style={[st.scoreTeam, { color: '#9CC8FF' }]}>الأزرق</Text></View>
            <Text style={st.scoreBig}>{m.score_a}</Text>
            <Text style={st.scoreDash}>-</Text>
            <Text style={st.scoreBig}>{m.score_b}</Text>
            <View style={st.scoreSide}><Text style={[st.scoreTeam, { color: '#FFC08A' }]}>البرتقالي</Text></View>
          </View>
        ) : null}

        <Text variant="h2">تفاصيل المباراة</Text>
        <InfoPill icon="football-outline" text={`${m.venue_name ?? 'بدون ساحة'}${m.field_name ? ` · ${m.field_name}` : ''}`} />
        {m.venue_address ? <InfoPill icon="location-outline" text={m.venue_address} /> : null}
        <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
          <InfoPill icon="calendar-outline" text={dateText} flex />
          <InfoPill icon="time-outline" text={`${formatClock(m.starts_at)} إلى ${formatClock(m.ends_at)}`} flex />
        </Row>
        <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
          <InfoPill icon="people-outline" text={`${joined.length} من ${m.max_players}${waitlist.length ? ` · انتظار ${waitlist.length}` : ''}`} flex />
          <InfoPill icon="speedometer-outline" text={SKILL_LABEL[m.skill_level]} flex />
        </Row>
        {!finished && left > 0 ? <Progress value={joined.length} max={m.max_players} /> : null}

        <ErrorText message={actionError} />

        {mine?.status === 'waitlist' ? (
          <Card style={{ backgroundColor: c.warnSoft, borderColor: c.warnSoft }}>
            <Text style={{ color: c.warnText }}>أنت في قائمة الانتظار — ستنضم تلقائياً عند انسحاب أحد اللاعبين.</Text>
          </Card>
        ) : null}

        {/* إجراءات ثانوية */}
        <Row style={{ flexWrap: 'wrap' }}>
          {!finished ? <SmallAction icon="share-social-outline" label="مشاركة" onPress={share} /> : null}
          {isOrganizer && !finished && joined.length >= 2 ? (
            <SmallAction icon="git-compare-outline" label={hasTeams ? 'أعد التقسيم' : 'قسّم الفريقين'} onPress={autoBalance} />
          ) : null}
          {isOrganizer && started && hasTeams ? (
            <SmallAction icon="create-outline" label={hasResult ? 'تعديل النتيجة' : 'سجّل النتيجة'} onPress={() => router.push({ pathname: '/match/result', params: { id: m.id } })} />
          ) : null}
          {finished && mine?.status === 'joined' ? (
            <SmallAction icon="star-outline" label="قيّم اللاعبين" onPress={() => router.push({ pathname: '/match/rate', params: { id: m.id } })} />
          ) : null}
          {!finished && mine ? (
            <SmallAction icon="exit-outline" label="انسحاب" danger onPress={() => act(() => api.leaveMatch(m.id))} />
          ) : null}
        </Row>

        {hasTeams ? (
          <>
            <Text variant="h2">الفريقان</Text>
            <Row style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
              <TeamColumn team="A" players={joined.filter((r) => r.team === 'A')} me={userId} m={m} />
              <TeamColumn team="B" players={joined.filter((r) => r.team === 'B')} me={userId} m={m} />
            </Row>
          </>
        ) : null}

        <Text variant="h2">اللاعبون</Text>
        {joined.length ? (
          joined.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)
        ) : (
          <Text variant="muted">لم ينضم أحد بعد — كن الأول!</Text>
        )}
        {waitlist.length ? (
          <>
            <Text variant="h2">قائمة الانتظار</Text>
            {waitlist.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
          </>
        ) : null}
      </Screen>

      {/* الشريط السفلي الثابت: السعر + الإجراء الرئيسي */}
      <View style={[st.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={st.handle} />
        <View style={st.barRow}>
          <View style={{ flex: 1 }}>
            <ActionPill action={action} busy={busy} onPress={primaryPress} big />
          </View>
          {m.cost_per_player ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={st.priceLabel}>للاعب</Text>
              <Text style={st.price}>{formatIQD(m.cost_per_player)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function InfoPill({ icon, text, flex }: { icon: IconName; text: string; flex?: boolean }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View style={[st.info, flex && { flex: 1 }]}>
      <Ionicons name={icon} size={20} color={c.primary} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold }} numberOfLines={2}>{text}</Text>
    </View>
  );
}

function SmallAction({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const color = danger ? c.danger : c.primary;
  return (
    <Pressable onPress={onPress} style={[st.small, danger && { backgroundColor: c.dangerSoft }]} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="small" style={{ color, fontFamily: fonts.semibold }}>{label}</Text>
    </Pressable>
  );
}

const useStyles = themed((c) => ({
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border },
  hero: { minHeight: 170, borderRadius: 24, gap: 24, backgroundColor: '#1C8B4A', overflow: 'hidden', padding: 16, justifyContent: 'space-between' },
  heroHalf: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroCircle: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', top: 40, left: '50%', marginLeft: -44 },
  heroBadges: { flexDirection: 'row', gap: 6 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 34, color: '#fff' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: c.border },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  priceLabel: { fontSize: 11, color: c.muted },
  price: { fontFamily: fonts.bold, fontSize: 18, color: c.primary },
  initial: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 2, backgroundColor: c.card },
  scoreBoard: { backgroundColor: '#0E1730', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeam: { fontFamily: fonts.bold, fontSize: 15 },
  scoreBig: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 56, color: '#fff', minWidth: 36, textAlign: 'center' },
  scoreDash: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 56, color: 'rgba(255,255,255,0.6)', marginHorizontal: 6 },
}));
