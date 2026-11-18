import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { formatClock, formatCountdown, formatIQD, weekdayName } from '../lib/format';
import { matchAction, type MatchAction } from '../lib/matchAction';
import { finalPrice } from '../lib/pricing';
import { spotsInfo } from '../lib/schedule';
import type { Match } from '../lib/types';
import { cardRadius, fonts, radius, space, themed, type, useColors, useTheme } from '../theme';
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

/** زر حالة المباراة. `big` لشريط الحجز أسفل صفحة المباراة */
export function ActionPill({ action, busy, onPress, big, short }: { action: MatchAction; busy?: boolean; onPress: () => void; big?: boolean; onBar?: boolean; short?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const { text, tone, enabled } = actionLabel(action, short);
  const box = { primary: st.pPrimary, soft: st.pSoft, done: st.pSoft, muted: st.pMuted }[tone];
  const fg = { primary: c.onPrimary, soft: c.primary, done: c.primary, muted: c.muted }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={short ? actionLabel(action).text : undefined}
      disabled={!enabled || busy}
      onPress={onPress}
      style={({ pressed }) => [st.pill, big && st.pillBig, short && st.pillShort, box, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.pillText, big && { fontSize: 15 }, { color: fg }]} numberOfLines={1}>{text}</Text>}
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

/** لون نص «باقي N»: الغامق على الفاتح، والفاتح على الداكن حتى ينقرى */
export function useSpotsColor() {
  const { scheme } = useTheme();
  return (tone: keyof typeof SPOTS) => (scheme === 'dark' ? SPOTS_BAR[tone] : SPOTS[tone].fg);
}

/**
 * بطاقة مباراة: مربع الوقت على اليمين، بالنص الملعب والتفاصيل وشريط الامتلاء،
 * والزر على اليسار. `showDay` يضيف اليوم (لما القائمة بيها أكثر من يوم).
 */
export function MatchRow({ match, now, busy, onAction, showDay }: { match: Match; now: number; busy?: boolean; onAction: () => void; showDay?: boolean }) {
  const router = useRouter();
  const st = useStyles();
  const c = useColors();
  const spotsColor = useSpotsColor();
  const action = matchAction(match, now);
  const finished = action.kind === 'finished';
  const spots = spotsInfo(match);
  const fill = match.max_players ? Math.min(1, match.joined_count / match.max_players) : 0;
  const spotsFg = finished ? c.muted : spotsColor(spots.tone);
  const spotsText = finished ? `${match.joined_count} لاعب` : spots.label;
  const [clock, mer] = formatClock(match.starts_at).split(' ');
  const start = new Date(match.starts_at);
  const meta = [showDay ? `${weekdayName(start)} ${start.getDate()}` : null, match.venue_address].filter(Boolean).join(' · ');
  const venue = match.venue_name ?? match.title ?? 'مباراة';
  const price = match.cost_per_player ? formatIQD(finalPrice(match) ?? 0) : null;
  const open = () => router.push({ pathname: '/match/[id]', params: { id: match.id } });
  return (
    <View style={[st.card, finished && { opacity: 0.7 }]}>
      <Pressable onPress={open} style={st.main} accessibilityRole="button" accessibilityLabel={`${venue} — ${clock} ${mer === 'م' ? 'مساءً' : 'صباحاً'}`}>
        <View style={st.time}>
          <Text style={st.clock}>{clock}</Text>
          <Text style={st.mer}>{mer === 'م' ? 'مساءً' : 'صباحاً'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={st.venue} numberOfLines={1}>{venue}</Text>
          {meta ? <Text style={st.meta} numberOfLines={1}>{meta}</Text> : null}
          <View style={st.priceRow}>
            {price ? <Text style={st.price}>{price}</Text> : null}
            {match.discount_pct ? (
              <View style={st.off}>
                <Text style={st.offText}>-{match.discount_pct}%</Text>
              </View>
            ) : null}
            <Text style={[st.spotsText, { color: spotsFg }]}>{spotsText}</Text>
          </View>
          <View style={st.track}>
            <View style={[st.fill, { width: `${fill * 100}%`, backgroundColor: finished ? c.muted : SPOTS_BAR[spots.tone] }]} />
          </View>
        </View>
      </Pressable>
      <ActionPill action={action} busy={busy} onPress={onAction} short />
    </View>
  );
}

const useStyles = themed((c) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, padding: space.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  time: { width: 64, height: 64, borderRadius: radius, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  clock: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: c.primary },
  mer: { ...type.micro, color: c.primary },
  venue: { ...type.headline, fontSize: 15, lineHeight: 24 },
  meta: { ...type.caption, color: c.muted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  price: { ...type.label, fontSize: 13 },
  off: { backgroundColor: c.dangerSoft, borderRadius: 999, paddingHorizontal: 6 },
  offText: { ...type.micro, color: c.danger, lineHeight: 18 },
  spotsText: { ...type.micro, fontSize: 12, marginStart: 'auto' },
  track: { height: 4, borderRadius: 2, backgroundColor: c.cardAlt, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 2 },
  pill: { minHeight: 44, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  pillShort: { minHeight: 40, minWidth: 72, maxWidth: 104, paddingHorizontal: space.md },
  pillBig: { minHeight: 52, paddingHorizontal: space.xl },
  pPrimary: { backgroundColor: c.primary },
  pSoft: { backgroundColor: c.primarySoft },
  pMuted: { backgroundColor: c.cardAlt },
  pillText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, textAlign: 'center' },
}));
