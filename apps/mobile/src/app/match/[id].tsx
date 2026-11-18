import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionPill, SPOTS } from '../../components/MatchRow';
import { Avatar } from '../../components/Avatar';
import { OfflineBanner, useToast } from '../../components/feedback';
import { hasRegistrationAlert, notificationsSupported, scheduleRegistrationAlert } from '../../lib/notifications';
import { shareMatch } from '../../lib/share';
import { useMatchActions } from '../../lib/useMatchActions';
import { ErrorText, Loading, Row, Screen, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatIQD, formatTimeRange, MONTHS, POSITION_LABEL, SKILL_LABEL, weekdayName } from '../../lib/format';
import { finalPrice } from '../../lib/pricing';
import { spotsInfo } from '../../lib/schedule';
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
      <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={48} />
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
  const { data: m, error, loading, reload, offline } = useAsync(() => api.getMatch(id), [id], { cacheKey: 'match' });
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const actions = useMatchActions(reload);
  const toast = useToast();
  const [alertSet, setAlertSet] = useState(false);
  useEffect(() => {
    let alive = true;
    void hasRegistrationAlert(id).then((v) => alive && setAlertSet(v));
    return () => {
      alive = false;
    };
  }, [id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const admin = useAsync(() => api.isAdmin(), []);
  const watching = useAsync(() => api.isWatching(id), [id]);

  if (loading && !m) return <Loading />;
  if (!m) return <Screen><ErrorText message={error ?? 'المباراة مو موجودة'} /></Screen>;

  const joined = m.roster.filter((r) => r.status === 'joined');
  const waitlist = m.roster.filter((r) => r.status === 'waitlist');
  const mine = m.roster.find((r) => r.player_id === userId);
  const isOrganizer = m.organizer_id === userId;
  const isAdmin = admin.data === true;
  const canManage = isOrganizer || isAdmin;
  const started = new Date(m.starts_at).getTime() < now;
  const finished = new Date(m.ends_at).getTime() < now;
  const hasTeams = joined.some((r) => r.team);
  const hasResult = m.score_a != null && m.score_b != null;
  const openPlayer = (pid: string) => router.push({ pathname: '/player/[id]', params: { id: pid } });

  async function act(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  const autoBalance = () =>
    act(() => {
      const res = balanceTeams(joined.map((r) => ({ id: r.player_id, rating: r.profile.skill_rating, position: r.position ?? r.profile.preferred_position })));
      return api.saveTeams(m.id, res.assignments);
    });

  const share = () => shareMatch(m);
  const remindRegistration = async () => {
    const ok = await scheduleRegistrationAlert(m);
    if (ok) {
      setAlertSet(true);
      toast('راح نبلّغك أول ما يفتح التسجيل 🔔');
    } else toast(notificationsSupported ? 'فعّل الإشعارات من إعدادات الهاتف حتى نكدر نبلّغك' : 'التنبيهات تشتغل بتطبيق الهاتف');
  };

  const action = matchAction(m, now);
  const startsDate = new Date(m.starts_at);
  // نفس طريقة كتابة التاريخ بباقي التطبيق: «الأحد 15»
  const dayText = `${weekdayName(startsDate)} ${startsDate.getDate()}`;
  const spots = spotsInfo(m);
  const fill = Math.min(1, joined.length / Math.max(1, m.max_players));
  const emptySlots = Math.max(0, m.max_players - joined.length);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* صورة الملعب: الساحة الخضراء أو صورة الملعب، وعليها المعلومات الأساسية */}
        <View style={[st.hero, { paddingTop: insets.top }]}>
          {m.venue_photo ? <Image source={{ uri: m.venue_photo }} style={StyleSheet.absoluteFill} accessibilityLabel={m.venue_name ?? 'الملعب'} /> : null}
          {!m.venue_photo ? (
            <>
              <View style={st.heroHalf} />
              <View style={st.heroCircle} />
              <View style={st.heroBoxTop} />
              <View style={st.heroBoxBottom} />
            </>
          ) : null}
          {/* تظليل متدرّج تحت حتى الكتابة البيضاء تنقرى فوق الساحة أو الصورة */}
          {[0.06, 0.12, 0.2, 0.3, 0.4].map((o, i) => (
            <View key={o} style={[st.heroShade, { bottom: 0, height: 150 - i * 28, backgroundColor: `rgba(0,0,0,${o - (i ? [0.06, 0.12, 0.2, 0.3, 0.4][i - 1] : 0)})` }]} />
          ))}
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[st.back, { top: insets.top + 12 }]} accessibilityLabel="رجوع" hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color="#101828" />
          </Pressable>
          <Pressable onPress={share} style={[st.shareBtn, { top: insets.top + 12 }]} accessibilityRole="button" accessibilityLabel="شارك المباراة">
            <Ionicons name="share-social" size={17} color={c.primary} />
            <Text style={st.shareText}>شارك</Text>
          </Pressable>
          <View style={st.heroInfo}>
            <Text style={st.heroSub}>مباراة {formatFormat(m.players_per_side)} · {SKILL_LABEL[m.skill_level]}</Text>
            <Text style={st.heroTitle}>{m.venue_name ?? 'مباراة'}</Text>
            <Text style={st.heroTime}>{dayText} · {formatTimeRange(m.starts_at, m.ends_at)}</Text>
          </View>
        </View>

        <View style={st.body}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>تفاصيل المباراة</Text>
          <View style={st.grid}>
            <Tile icon="location-outline" label="المنطقة" value={m.venue_address ?? '—'} />
            <Tile icon="football-outline" label="الساحة" value={m.field_name ?? m.venue_name ?? '—'} />
            <Tile icon="calendar-outline" label="اليوم" value={`${startsDate.getDate()} ${MONTHS[startsDate.getMonth()]}`} />
            <Tile icon="stats-chart-outline" label="المستوى" value={SKILL_LABEL[m.skill_level]} />
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

          {m.motm_name ? (
            <Pressable onPress={() => m.motm_player_id && openPlayer(m.motm_player_id)} style={st.motm} accessibilityRole="button">
              <View style={st.motmIcon}>
                <Ionicons name="medal" size={22} color="#7A5B00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#7A5B00' }}>رجل المباراة</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#3D2E00' }}>{m.motm_name} 🏅</Text>
              </View>
            </Pressable>
          ) : null}
          {m.closed_at ? (
            <Text variant="small" style={{ color: c.muted }}>
              سُكّرت المباراة: حضر {m.attended_count ?? 0}{m.no_show_count ? ` · غاب ${m.no_show_count}` : ''}
            </Text>
          ) : null}

          <OfflineBanner show={offline} />
          <ErrorText message={actionError ?? actions.error} />

          <View style={st.playersCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>اللاعبين: {joined.length} من {m.max_players}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: finished ? c.muted : SPOTS[spots.tone].fg }}>
                {finished ? 'انتهت' : spots.left === 0 ? 'مكتملة' : spots.left === 1 ? 'باقي مكان واحد' : spots.left === 2 ? 'باقي مكانين' : `باقي ${spots.left} أماكن`}
              </Text>
            </View>
            <View style={st.fillTrack} accessibilityLabel={`ممتلئة ${Math.round(fill * 100)}%`}>
              <View style={[st.fillBar, { width: `${fill * 100}%`, backgroundColor: finished ? c.muted : spots.tone === 'ok' ? '#22A559' : spots.tone === 'few' ? '#F59E0B' : c.danger }]} />
            </View>
            {joined.map((r) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} onPress={() => openPlayer(r.player_id)} />)}
            {!finished && emptySlots ? (
              <View style={st.slots} accessibilityLabel={`${emptySlots} مكان فارغ`}>
                {Array.from({ length: Math.min(emptySlots, 11) }, (_, i) => (
                  <View key={i} style={st.slot} />
                ))}
                {emptySlots > 11 ? <Text variant="small" style={{ color: c.muted }}>+{emptySlots - 11}</Text> : null}
              </View>
            ) : null}
          </View>
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
            {!finished && mine ? <SmallAction icon="exit-outline" label="انسحاب" danger onPress={() => void actions.leave(m)} /> : null}
            {mine?.status === 'joined' || canManage ? (
              <SmallAction icon="chatbubbles-outline" label="محادثة المباراة" onPress={() => router.push({ pathname: '/match/chat', params: { id: m.id } })} />
            ) : null}
            {!finished && !mine && spots.left === 0 ? (
              <SmallAction
                icon={watching.data ? 'notifications' : 'notifications-outline'}
                label={watching.data ? 'راح ننبّهك إذا انفتح مكان' : 'نبّهني إذا انفتح مكان'}
                onPress={() =>
                  void act(async () => {
                    await api.watchMatch(m.id, !watching.data);
                    await watching.reload();
                    toast(watching.data ? 'لغيت التنبيه' : 'أول ما ينفتح مكان نبلّغك ⚡');
                  })
                }
              />
            ) : null}
            {canManage && started && !m.closed_at ? (
              <SmallAction icon="checkmark-done-outline" label="سكّر المباراة: الحضور ورجل المباراة" onPress={() => router.push({ pathname: '/match/close', params: { id: m.id } })} />
            ) : null}
            {action.kind === 'opens_later' ? (
              <SmallAction icon={alertSet ? 'notifications' : 'notifications-outline'} label={alertSet ? 'راح نبلّغك' : 'ذكّرني عند فتح التسجيل'} onPress={() => void remindRegistration()} />
            ) : null}
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
            <ActionPill action={action} busy={actions.busyId === m.id} onPress={() => void actions.join(m)} big onBar />
          </View>
          {m.cost_per_player ? (
            <View>
              {m.discount_pct ? <Text style={st.oldPrice}>{formatIQD(m.cost_per_player)} · خصم {m.discount_pct}%</Text> : null}
              <Text style={st.price}>{formatIQD(finalPrice(m) ?? 0)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View style={st.tile}>
      <View style={st.tileIcon}>
        <Ionicons name={icon} size={19} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="small" style={{ color: c.muted }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14 }} numberOfLines={2}>{value}</Text>
      </View>
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
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  initial: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 2, backgroundColor: c.card },
  hero: { minHeight: 220, backgroundColor: '#1C8B4A', overflow: 'hidden', borderBottomLeftRadius: 26, borderBottomRightRadius: 26, justifyContent: 'flex-end' },
  heroHalf: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroCircle: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', top: '50%', marginTop: -48, left: '50%', marginLeft: -47 },
  heroBoxTop: { position: 'absolute', left: -3, width: 58, top: '50%', marginTop: -50, height: 100, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  heroBoxBottom: { position: 'absolute', right: -3, width: 58, top: '50%', marginTop: -50, height: 100, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  heroShade: { position: 'absolute', left: 0, right: 0 },
  heroInfo: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 70 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: fonts.semibold },
  heroTitle: { color: '#fff', fontSize: 25, lineHeight: 38, fontFamily: fonts.bold },
  heroTime: { color: '#fff', fontSize: 15, fontFamily: fonts.bold },
  shareBtn: { position: 'absolute', left: 16, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareText: { color: c.primary, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 11 },
  tileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  playersCard: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 14, gap: 6 },
  fillTrack: { height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden', marginBottom: 6 },
  fillBar: { height: '100%', borderRadius: 4 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 },
  slot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border },
  back: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 12 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  scoreBoard: { backgroundColor: '#0E1730', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeam: { fontFamily: fonts.bold, fontSize: 15 },
  scoreBig: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 56, color: '#fff', minWidth: 36, textAlign: 'center' },
  scoreDash: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 56, color: 'rgba(255,255,255,0.6)', marginHorizontal: 6 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.primary, backgroundImage: c.primaryGradient, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 20 },
  handle: { alignSelf: 'center', width: 52, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  price: { fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
  motm: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12, backgroundColor: '#F5C431', backgroundImage: 'linear-gradient(135deg, #FFE58A 0%, #F5C431 60%, #E0A91F 100%)' },
  motmIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  oldPrice: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 15, textDecorationLine: 'line-through' },
}));
