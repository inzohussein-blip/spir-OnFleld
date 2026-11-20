import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { actionLabel, useSpotsColor } from '../../components/MatchRow';
import { Avatar } from '../../components/Avatar';
import { OfflineBanner, useToast } from '../../components/feedback';
import { hasRegistrationAlert, notificationsSupported, scheduleRegistrationAlert } from '../../lib/notifications';
import { shareMatch } from '../../lib/share';
import { useMatchActions } from '../../lib/useMatchActions';
import { ErrorText, Halftone, Loading, Row, Screen, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatIQD, formatTimeRange, MONTHS, POSITION_LABEL, SKILL_LABEL, weekdayName } from '../../lib/format';
import { finalPrice } from '../../lib/pricing';
import { spotsInfo } from '../../lib/schedule';
import { matchAction } from '../../lib/matchAction';
import { errMsg, useAsync, useNow, useSession } from '../../lib/session';
import { balanceTeams } from '../../lib/teamBalance';
import type { MatchDetail, RosterEntry, Team } from '../../lib/types';
import { ctaShadow, fonts, fromLeft, themed, useColors, wideSpaces } from '../../theme';

function PlayerRow({ r, me, onPress, first = true }: { r: RosterEntry; me: boolean; onPress: () => void; first?: boolean }) {
  const st = useStyles();
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[st.player, !first && st.playerLine]}>
      <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={40} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>
        {r.profile.full_name}
        {me ? ' (أنت)' : ''}
      </Text>
      <Text variant="small" style={{ color: c.muted }}>
        {POSITION_LABEL[r.position ?? r.profile.preferred_position]}
        <Text variant="small" style={{ color: c.border }}>{'  |  '}</Text>
        المستوى {Math.round(r.profile.skill_rating)}
      </Text>
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
  const spotsColor = useSpotsColor();
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
  const role = useAsync(() => api.myRole(), []);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const watching = useAsync(() => api.isWatching(id), [id]);

  if (loading && !m) return <Loading />;
  if (!m) return <Screen><ErrorText message={error ?? 'المباراة مو موجودة'} /></Screen>;

  const joined = m.roster.filter((r) => r.status === 'joined');
  const waitlist = m.roster.filter((r) => r.status === 'waitlist');
  const mine = m.roster.find((r) => r.player_id === userId);
  const isOrganizer = m.organizer_id === userId;
  // الموظف والمدير يديرون أي مباراة
  const isStaff = role.data === 'staff' || role.data === 'admin';
  const canManage = isOrganizer || isStaff;
  const cancelled = m.status === 'cancelled';
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
    // نفس التنبيه من الخادم: يوصل حتى لو التطبيق مسكّر أو انحذف التذكير المحلي
    const server = await api.setRegistrationAlert(m.id, true).then(() => true, () => false);
    if (ok || server) {
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

  const spotsText = m.status === 'cancelled' ? 'ملغية' : finished ? 'انتهت' : spots.left === 0 ? 'مكتملة' : spots.left === 1 ? 'باقي مكان واحد' : spots.left === 2 ? 'باقي مكانين' : `باقي ${spots.left} أماكن`;
  const bar = actionLabel(action);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* «ليلة الملعب»: سماء زرقاء بالكشافات، عشب مخطط، الكرة يسار والمعلومات يمين */}
        <View style={[st.hero, { paddingTop: insets.top }]}>
          {m.venue_photo ? (
            <>
              <Image source={{ uri: m.venue_photo }} style={StyleSheet.absoluteFill} accessibilityLabel={m.venue_name ?? 'الملعب'} />
              <View style={[StyleSheet.absoluteFill, st.photoShade]} />
            </>
          ) : (
            <>
              {/* الكشافات */}
              {[8, 30, 52, 74, 92].map((x, i) => (
                <View key={x} style={[st.light, { left: `${x}%`, top: insets.top + (i % 2 ? 6 : 20) }]} />
              ))}
              {/* المدرجات */}
              <View style={[st.stands, { top: insets.top + 56 }]} />
              {/* العشب المخطط */}
              <View style={st.grass}>
                {Array.from({ length: 8 }, (_, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? '#22964F' : '#1E8A4E' }} />
                ))}
              </View>
              <View style={st.grassShade} />
              {/* الكرة */}
              <View style={st.ball}>
                <Ionicons name="football" size={112} color="#0B1033" />
              </View>
            </>
          )}
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[st.back, { top: insets.top + 12 }]} accessibilityLabel="رجوع" hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color="#0B1033" />
          </Pressable>
          <Pressable onPress={share} style={[st.shareBtn, { top: insets.top + 12 }]} accessibilityRole="button" accessibilityLabel="شارك المباراة">
            <Ionicons name="share-social" size={17} color={c.primary} />
            <Text style={st.shareText}>شارك</Text>
          </Pressable>
          <View style={st.heroInfo}>
            <View style={st.heroChip}>
              <Text style={st.heroChipText}>{formatFormat(m.players_per_side)} · {SKILL_LABEL[m.skill_level]}</Text>
            </View>
            <Text style={st.heroTitle} numberOfLines={1}>{wideSpaces(m.venue_name ?? 'مباراة')}</Text>
            <View style={st.heroTimeRow}>
              <Ionicons name="calendar-outline" size={15} color={c.cta} />
              <Text style={st.heroTime}>{dayText} · {formatTimeRange(m.starts_at, m.ends_at)}</Text>
            </View>
          </View>
        </View>
        <View style={st.heroBand} />

        <View style={st.body}>
          {/* «تفاصيل المباراة» بالنص وخطين على الجانبين */}
          <View style={st.sectionRow}>
            <View style={[st.sectionLine, { backgroundImage: `linear-gradient(90deg, transparent, ${c.primary})` }]} />
            <Text style={st.sectionTitle}>تفاصيل المباراة</Text>
            <View style={[st.sectionLine, { backgroundImage: `linear-gradient(270deg, transparent, ${c.primary})` }]} />
          </View>
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
                <Ionicons name="medal" size={22} color={c.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.primaryDark }}>رجل المباراة</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.primaryDark }}>{m.motm_name} 🏅</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>اللاعبين: {joined.length} من {m.max_players}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={18} color={finished ? c.muted : c.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: finished ? c.muted : spotsColor(spots.tone) }}>{spotsText}</Text>
              </View>
            </View>
            <View style={st.fillTrack} accessibilityLabel={`ممتلئة ${Math.round(fill * 100)}%`}>
              <View style={[st.fillBar, { width: `${fill * 100}%` }, finished ? { backgroundColor: c.muted } : { backgroundColor: c.primary, backgroundImage: `linear-gradient(270deg, ${c.primary}, ${c.cta})` }]} />
            </View>
            {joined.map((r, i) => <PlayerRow key={r.player_id} r={r} me={r.player_id === userId} first={i === 0} onPress={() => openPlayer(r.player_id)} />)}
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
            {isStaff && !finished && !cancelled && !m.closed_at ? (
              <SmallAction
                icon="close-circle-outline"
                danger
                label={confirmCancel ? 'متأكد؟ اضغط مرة ثانية للإلغاء' : 'ألغِ المباراة'}
                onPress={() => {
                  if (!confirmCancel) return setConfirmCancel(true);
                  setConfirmCancel(false);
                  void act(() => api.staffCancelMatch(m.id)).then(() => toast('انلغت المباراة وانبلّغ اللاعبين'));
                }}
              />
            ) : null}
            {(isOrganizer || isStaff) && !finished && !cancelled && joined.length >= 2 ? (
              <SmallAction icon="git-compare-outline" label={hasTeams ? 'أعد التقسيم' : 'قسّم الفريقين'} onPress={autoBalance} />
            ) : null}
            {(isOrganizer || isStaff) && started && hasTeams ? (
              <SmallAction icon="create-outline" label={hasResult ? 'تعديل النتيجة' : 'سجّل النتيجة'} onPress={() => router.push({ pathname: '/match/result', params: { id: m.id } })} />
            ) : null}
          </Row>
        </View>
      </ScrollView>

      {/* شريط الحجز: أزرق بنقاط القمصان، وبنصه حبة بيضاء بسهم أصفر والسعر */}
      <View style={[st.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Halftone rows={6} cols={28} style={{ top: 6, ...fromLeft(6) }} color="rgba(255,255,255,0.10)" />
        <Pressable
          onPress={() => void actions.join(m)}
          disabled={!bar.enabled || actions.busyId === m.id}
          style={({ pressed }) => [st.cta, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel={bar.text}
        >
          <View style={[st.ctaIcon, !bar.enabled && { backgroundColor: c.cardAlt }]}>
            {actions.busyId === m.id ? <ActivityIndicator color={c.onCta} /> : <Ionicons name={bar.enabled ? 'chevron-back' : action.kind === 'joined' ? 'checkmark' : action.kind === 'cancelled' ? 'close' : 'time-outline'} size={20} color={bar.enabled ? c.onCta : c.muted} />}
          </View>
          <Text style={[st.ctaText, !bar.enabled && { color: c.muted }]} numberOfLines={1}>{bar.text}</Text>
          {m.cost_per_player ? (
            <>
              <View style={st.ctaDivider} />
              <View style={{ alignItems: 'flex-end' }}>
                {m.discount_pct ? <Text style={st.oldPrice}>{formatIQD(m.cost_per_player)}</Text> : null}
                <Text style={st.price}>{formatIQD(finalPrice(m) ?? 0)}</Text>
              </View>
            </>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View style={st.tile}>
      {/* زاوية صفرة: مربع مايل 45° نص ظاهر */}
      <View style={[st.tileCorner, fromLeft(-22)]} />
      <View style={st.tileIcon}>
        <Ionicons name={icon} size={20} color={c.cta} />
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
  // ليلة الملعب: سماء زرقاء غامقة متدرجة بالكشافات
  hero: { minHeight: 300, backgroundColor: c.bandBg, backgroundImage: c.heroSky, overflow: 'hidden', justifyContent: 'flex-end' },
  photoShade: { backgroundColor: 'rgba(11,16,51,0.45)', backgroundImage: 'linear-gradient(180deg, rgba(11,16,51,0.2) 0%, rgba(11,16,51,0.85) 100%)' },
  light: { position: 'absolute', width: 70, height: 70, marginLeft: -35, borderRadius: 35, backgroundColor: 'rgba(255,255,240,0.18)', backgroundImage: 'radial-gradient(circle, rgba(255,255,235,0.95) 0%, rgba(255,255,220,0.35) 18%, rgba(255,255,220,0) 70%)', boxShadow: '0 0 40px rgba(255,255,220,0.35)' },
  stands: { position: 'absolute', left: 0, right: 0, height: 70, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 3px, transparent 3px, transparent 9px)', opacity: 0.9 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, flexDirection: 'row', backgroundColor: '#1E8A4E' },
  grassShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundImage: 'linear-gradient(180deg, rgba(11,16,51,0.55) 0%, rgba(11,16,51,0.05) 45%, rgba(11,16,51,0.35) 100%)' },
  ball: { position: 'absolute', bottom: 18, ...fromLeft(18), width: 118, height: 118, borderRadius: 59, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(0,0,0,0.45)' },
  heroInfo: { paddingHorizontal: 20, paddingBottom: 22, paddingTop: 80, alignItems: 'flex-start', gap: 4, maxWidth: '64%', alignSelf: 'flex-start' },
  heroChip: { backgroundColor: c.cta, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3, boxShadow: '0 2px 0 #0B1033' },
  heroChipText: { color: c.onCta, fontFamily: fonts.bold, fontSize: 12, lineHeight: 20 },
  heroTitle: { color: '#fff', fontSize: 28, lineHeight: 42, fontFamily: fonts.display, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8 },
  heroTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTime: { color: '#fff', fontSize: 14, lineHeight: 22, fontFamily: fonts.bold },
  heroBand: { height: 8, backgroundColor: c.cta, transform: [{ skewY: '-1.2deg' }], marginTop: -4 },
  shareBtn: { position: 'absolute', left: 16, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6, boxShadow: '0 3px 0 #0B1033' },
  shareText: { color: c.primary, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 },
  sectionLine: { width: 64, height: 3, borderRadius: 2, backgroundColor: c.primary },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 30, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 11, minHeight: 72, overflow: 'hidden' },
  tileCorner: { position: 'absolute', top: -22, width: 44, height: 44, backgroundColor: c.cta, transform: [{ rotate: '45deg' }] },
  tileIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.bandBg, alignItems: 'center', justifyContent: 'center' },
  playersCard: { backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 14, gap: 6 },
  playerLine: { borderTopWidth: 1, borderTopColor: c.cardAlt },
  fillTrack: { height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden', marginBottom: 6 },
  fillBar: { height: '100%', borderRadius: 4 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 },
  slot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border },
  back: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 #0B1033' },
  body: { padding: 16, gap: 12 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  scoreBoard: { backgroundColor: c.primaryDark, borderWidth: 2, borderColor: c.cta, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeam: { fontFamily: fonts.bold, fontSize: 15 },
  scoreBig: { fontFamily: fonts.display, fontSize: 40, lineHeight: 56, color: c.cta, minWidth: 36, textAlign: 'center' },
  scoreDash: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 56, color: 'rgba(255,255,255,0.6)', marginHorizontal: 6 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bandBg, borderTopWidth: 4, borderTopColor: c.cta, paddingTop: 14, paddingHorizontal: 16, overflow: 'hidden' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 999, minHeight: 56, paddingStart: 6, paddingEnd: 18, boxShadow: '0 4px 0 #0B1033' },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.cta, alignItems: 'center', justifyContent: 'center', boxShadow: ctaShadow(c) },
  ctaText: { flex: 1, fontFamily: fonts.bold, fontSize: 17, lineHeight: 26, color: '#0B1033' },
  ctaDivider: { width: 2, height: 30, borderRadius: 1, backgroundColor: '#C9CEF5' },
  price: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 28, color: c.bandBg },
  oldPrice: { color: '#4A5185', fontSize: 11, lineHeight: 15, textDecorationLine: 'line-through' },
  motm: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, backgroundColor: c.cta, borderWidth: 2, borderColor: c.primaryDark, boxShadow: '0 3px 0 #0B1033' },
  motmIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
}));
