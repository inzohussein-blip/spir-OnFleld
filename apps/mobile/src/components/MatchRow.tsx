import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { formatClock, formatCountdown, formatIQD, weekdayName } from '../lib/format';
import { matchAction, type MatchAction } from '../lib/matchAction';
import { finalPrice } from '../lib/pricing';
import { spotsInfo } from '../lib/schedule';
import type { Match } from '../lib/types';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

/** نص وشكل الزر الرئيسي حسب حالة المباراة — `short` للزر الصغير ببطاقة المباراة */
export function actionLabel(a: MatchAction, short = false) {
  switch (a.kind) {
    case 'join':
      return { text: short ? 'انضم' : 'انضم إلى المباراة', tone: 'primary' as const, enabled: true };
    case 'waitlist':
      return { text: short ? 'الانتظار' : 'انضم إلى قائمة الانتظار', tone: 'soft' as const, enabled: true };
    case 'joined':
      return { text: short ? '✓ منضم' : '✓ أنت منضم', tone: 'done' as const, enabled: false };
    case 'waiting':
      return { text: short ? 'بالانتظار' : 'أنت في قائمة الانتظار', tone: 'soft' as const, enabled: false };
    case 'opens_later':
      return { text: short ? `بعد ${formatCountdown(a.ms).split(' و')[0]}` : `التسجيل بعد ${formatCountdown(a.ms)}`, tone: 'muted' as const, enabled: false };
    case 'finished':
      return { text: short ? 'انتهت' : 'انتهت المباراة', tone: 'muted' as const, enabled: false };
  }
}

export function ActionPill({ action, busy, onPress, big, onBar, short }: { action: MatchAction; busy?: boolean; onPress: () => void; big?: boolean; onBar?: boolean; short?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const { text, tone, enabled } = actionLabel(action, short);
  // على الشريط الملوّن أسفل صفحة المباراة: زر فاتح على خلفية الأزرق
  const box = onBar ? (enabled ? st.pOnBar : st.pOnBarMuted) : { primary: st.pPrimary, soft: st.pSoft, done: st.pSoft, muted: st.pMuted }[tone];
  const fg = onBar ? (enabled ? c.primary : '#FFFFFF') : { primary: c.onPrimary, soft: c.primary, done: c.primary, muted: c.muted }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={short ? actionLabel(action).text : undefined}
      disabled={!enabled || busy}
      onPress={onPress}
      style={({ pressed }) => [st.pill, big && st.pillBig, short && st.pillShort, box, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.pillText, big && { fontSize: 15 }, short && { fontSize: 14 }, { color: fg }]} numberOfLines={1}>{text}</Text>}
    </Pressable>
  );
}

/** ألوان «باقي N»: أخضر كثير، برتقالي قليل، أحمر مكتملة */
export const SPOTS = {
  ok: { fg: '#167A43', bg: '#E5F6EC' },
  few: { fg: '#B45309', bg: '#FFF1DC' },
  full: { fg: '#C42B1C', bg: '#FDECEA' },
} as const;

/** شريط الامتلاء: أخضر كثير، برتقالي قليل، أحمر مكتملة */
export const SPOTS_BAR = { ok: '#22A559', few: '#F59E0B', full: '#E5484D' } as const;

/**
 * بطاقة مباراة: مربع الساحة الخضراء (أو صورة الملعب) وعليه الوقت كبير،
 * بالنص اسم الملعب والمنطقة والسعر وشريط «باقي N»، والزر الصغير على اليسار.
 * `showDay` يضيف اليوم (لما القائمة بيها أكثر من يوم).
 */
export function MatchRow({ match, now, busy, onAction, showDay }: { match: Match; now: number; busy?: boolean; onAction: () => void; showDay?: boolean }) {
  const router = useRouter();
  const st = useStyles();
  const c = useColors();
  const action = matchAction(match, now);
  const finished = action.kind === 'finished';
  const spots = spotsInfo(match);
  const fill = match.max_players ? Math.min(1, match.joined_count / match.max_players) : 0;
  const spotsFg = finished ? c.muted : SPOTS[spots.tone].fg;
  const spotsText = finished ? `${match.joined_count} لاعب` : spots.label;
  const [clock, mer] = formatClock(match.starts_at).split(' ');
  const start = new Date(match.starts_at);
  const meta = [showDay ? `${weekdayName(start)} ${start.getDate()}` : null, match.venue_address].filter(Boolean).join(' · ');
  const venue = match.venue_name ?? match.title ?? 'مباراة';
  const open = () => router.push({ pathname: '/match/[id]', params: { id: match.id } });
  return (
    <View style={[st.card, finished && { opacity: 0.75 }]}>
      <Pressable onPress={open} style={st.main} accessibilityRole="button" accessibilityLabel={`${venue} — ${clock} ${mer === 'م' ? 'مساءً' : 'صباحاً'}`}>
        <View style={st.thumb}>
          {match.venue_photo ? (
            <Image source={{ uri: match.venue_photo }} style={StyleSheet.absoluteFill} accessibilityLabel={venue} />
          ) : (
            <>
              <View style={st.pitchLine} />
              <View style={st.pitchCircle} />
            </>
          )}
          <View style={st.thumbShade}>
            <Text style={st.clock}>{clock}</Text>
            <Text style={st.mer}>{mer === 'م' ? 'مساءً' : 'صباحاً'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.venue}>{venue}</Text>
          <View style={st.metaRow}>
            {meta ? (
              <Text variant="small" style={{ color: c.muted, flexShrink: 1 }} numberOfLines={showDay ? undefined : 1}>
                {meta}
              </Text>
            ) : null}
            {match.cost_per_player ? (
              <Text variant="small" style={{ color: c.text, fontFamily: fonts.bold, flexShrink: 0 }} numberOfLines={1}>
                {meta ? '· ' : ''}
                {formatIQD(finalPrice(match) ?? 0)}
              </Text>
            ) : null}
            {match.discount_pct ? (
              <View style={st.off}>
                <Text style={st.offText}>-{match.discount_pct}%</Text>
              </View>
            ) : null}
          </View>
          <View style={st.spotsRow}>
            <View style={st.track}>
              <View style={[st.fill, { width: `${fill * 100}%`, backgroundColor: finished ? c.muted : SPOTS_BAR[spots.tone] }]} />
            </View>
            <Text style={[st.spotsText, { color: spotsFg }]}>{spotsText}</Text>
          </View>
        </View>
      </Pressable>
      <ActionPill action={action} busy={busy} onPress={onAction} short />
    </View>
  );
}

const useStyles = themed((c) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 10, paddingEnd: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#1C8B4A', overflow: 'hidden' },
  pitchLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  pitchCircle: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', top: 20, left: 20 },
  thumbShade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
  clock: { color: '#fff', fontFamily: fonts.bold, fontSize: 18, lineHeight: 23 },
  mer: { color: '#fff', fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 },
  venue: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  off: { backgroundColor: '#FFEAE6', borderRadius: 999, paddingHorizontal: 6 },
  offText: { color: '#E8173B', fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 17 },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  spotsText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  pill: { minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  pillShort: { minHeight: 38, minWidth: 64, maxWidth: 104, borderRadius: 19, paddingHorizontal: 14 },
  pillBig: { minHeight: 52, borderRadius: 18, paddingHorizontal: 22 },
  pPrimary: { backgroundColor: c.primary, backgroundImage: c.primaryGradient },
  pSoft: { backgroundColor: c.primarySoft },
  pMuted: { backgroundColor: c.cardAlt },
  pOnBar: { backgroundColor: '#FFFFFF' },
  pOnBarMuted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillText: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center' },
}));
