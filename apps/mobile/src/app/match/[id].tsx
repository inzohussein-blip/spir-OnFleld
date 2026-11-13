import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionPill } from '../../components/MatchRow';
import { ErrorText, Loading, Row, Screen, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatFormat, formatIQD, formatTimeRange, POSITION_LABEL } from '../../lib/format';
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
      <View style={st.initial}><Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff' }}>{r.profile.full_name.slice(0, 1)}</Text></View>
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={2}>
        {r.profile.full_name}
        {me ? ' (أنت)' : ''}
      </Text>
      <Text variant="small" style={{ width: 52, textAlign: 'center' }}>{POSITION_LABEL[r.position ?? r.profile.preferred_position]}</Text>
      <Text variant="small" style={{ color: c.muted, width: 64, textAlign: 'left' }}>المستوى {Math.round(r.profile.skill_rating)}</Text>
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
  const startsDate = new Date(m.starts_at);
  const dateText = `${startsDate.getFullYear()}-${String(startsDate.getMonth() + 1).padStart(2, '0')}-${String(startsDate.getDate()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* صورة الملعب */}
        <View style={[st.hero, { paddingTop: insets.top }]}>
          <View style={st.heroHalf} />
          <View style={st.heroCircle} />
          <View style={st.heroBoxTop} />
          <View style={st.heroBoxBottom} />
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[st.back, { top: insets.top + 12 }]} accessibilityLabel="رجوع" hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color="#101828" />
          </Pressable>
        </View>

        <View style={st.body}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>تفاصيل المباراة</Text>
          <InfoPill icon="football-outline" text={`${m.venue_name ?? 'بدون ساحة'}${m.field_name ? ` · ${m.field_name}` : ''}`} />
          {m.venue_address ? <InfoPill icon="location-outline" text={m.venue_address} /> : null}
          <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
            <InfoPill icon="calendar-outline" text={dateText} flex />
            <InfoPill icon="time-outline" text={formatTimeRange(m.starts_at, m.ends_at)} flex />
          </Row>
          <View style={{ alignSelf: 'flex-start' }}>
            <InfoPill icon="people-outline" text={`${joined.length} من ${m.max_players}`} />
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

          <ErrorText message={actionError} />

          {joined.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
          {waitlist.length ? (
            <>
              <Text style={{ fontFamily: fonts.bold, marginTop: 6 }}>قائمة الانتظار</Text>
              {waitlist.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
            </>
          ) : null}

          {hasTeams ? (
            <Row style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
              <TeamColumn team="A" players={joined.filter((r) => r.team === 'A')} me={userId} m={m} />
              <TeamColumn team="B" players={joined.filter((r) => r.team === 'B')} me={userId} m={m} />
            </Row>
          ) : null}

          {/* روابط صغيرة فقط عند الحاجة */}
          <Row style={{ flexWrap: 'wrap' }}>
            {!finished && mine ? <SmallAction icon="exit-outline" label="انسحاب" danger onPress={() => act(() => api.leaveMatch(m.id))} /> : null}
            {!finished ? <SmallAction icon="share-social-outline" label="مشاركة" onPress={share} /> : null}
            {finished && mine?.status === 'joined' ? (
              <SmallAction icon="star-outline" label="قيّم اللاعبين" onPress={() => router.push({ pathname: '/match/rate', params: { id: m.id } })} />
            ) : null}
            {isOrganizer && !finished && joined.length >= 2 ? (
              <SmallAction icon="git-compare-outline" label={hasTeams ? 'أعد التقسيم' : 'قسّم الفريقين'} onPress={autoBalance} />
            ) : null}
            {isOrganizer && started && hasTeams ? (
              <SmallAction icon="create-outline" label={hasResult ? 'تعديل النتيجة' : 'سجّل النتيجة'} onPress={() => router.push({ pathname: '/match/result', params: { id: m.id } })} />
            ) : null}
          </Row>
        </View>
      </ScrollView>

      {/* الشريط السفلي الملوّن: الزر + السعر */}
      <View style={[st.bottomBar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={st.handle} />
        <View style={st.barRow}>
          <View style={{ flex: 1 }}>
            <ActionPill action={action} busy={busy} onPress={() => act(() => api.joinMatch(m.id))} big onBar />
          </View>
          {m.cost_per_player ? <Text style={st.price}>{formatIQD(m.cost_per_player)}</Text> : null}
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
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border },
  initial: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 2, backgroundColor: c.card },
  hero: { height: 260, backgroundColor: '#1C8B4A', overflow: 'hidden', borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  heroHalf: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  heroCircle: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)', top: 95, left: '50%', marginLeft: -54 },
  heroBoxTop: { position: 'absolute', left: -3, width: 70, top: 80, height: 120, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)' },
  heroBoxBottom: { position: 'absolute', right: -3, width: 70, top: 80, height: 120, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)' },
  back: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: c.border },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  scoreBoard: { backgroundColor: '#0E1730', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeam: { fontFamily: fonts.bold, fontSize: 15 },
  scoreBig: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 56, color: '#fff', minWidth: 36, textAlign: 'center' },
  scoreDash: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 56, color: 'rgba(255,255,255,0.6)', marginHorizontal: 6 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.primary, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 20 },
  handle: { alignSelf: 'center', width: 52, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  price: { fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
}));
