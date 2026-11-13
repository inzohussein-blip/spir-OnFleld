import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { formatClock, formatCountdown, formatFormat, formatIQD } from '../lib/format';
import { matchAction, type MatchAction } from '../lib/matchAction';
import type { Match } from '../lib/types';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

/** نص وشكل الزر الرئيسي حسب حالة المباراة — يُستخدم في البطاقة وفي الشريط السفلي لصفحة المباراة */
export function actionLabel(a: MatchAction) {
  switch (a.kind) {
    case 'join':
      return { text: 'انضم إلى المباراة', tone: 'primary' as const, enabled: true };
    case 'waitlist':
      return { text: 'انضم إلى قائمة الانتظار', tone: 'soft' as const, enabled: true };
    case 'joined':
      return { text: '✓ أنت منضم', tone: 'done' as const, enabled: false };
    case 'waiting':
      return { text: 'أنت في قائمة الانتظار', tone: 'soft' as const, enabled: false };
    case 'opens_later':
      return { text: `التسجيل بعد ${formatCountdown(a.ms)}`, tone: 'muted' as const, enabled: false };
    case 'finished':
      return { text: 'انتهت المباراة', tone: 'muted' as const, enabled: false };
  }
}

export function ActionPill({ action, busy, onPress, big }: { action: MatchAction; busy?: boolean; onPress: () => void; big?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const { text, tone, enabled } = actionLabel(action);
  const box = { primary: st.pPrimary, soft: st.pSoft, done: st.pDone, muted: st.pMuted }[tone];
  const fg = { primary: c.onPrimary, soft: c.primary, done: '#1C8B4A', muted: c.muted }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!enabled || busy}
      onPress={onPress}
      style={({ pressed }) => [st.pill, big && st.pillBig, box, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.pillText, big && { fontSize: 16 }, { color: fg }]}>{text}</Text>}
    </Pressable>
  );
}

/** بطاقة مباراة في قائمة اليوم: الساحة، السعر، الوقت، العدد، وزر انضمام مباشر */
export function MatchRow({ match, now, busy, onAction }: { match: Match; now: number; busy?: boolean; onAction: () => void }) {
  const router = useRouter();
  const st = useStyles();
  const c = useColors();
  const action = matchAction(match, now);
  const open = () => router.push({ pathname: '/match/[id]', params: { id: match.id } });
  return (
    <View style={st.card}>
      <Pressable onPress={open} style={st.top}>
        <View style={st.thumb}>
          <Ionicons name="football" size={26} color={c.primary} />
          <Text style={st.thumbText}>{formatFormat(match.players_per_side)}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={st.venue} numberOfLines={2}>{match.venue_name ?? match.title ?? 'مباراة'}</Text>
          {match.field_name ? (
            <Text variant="small" style={{ color: c.muted }} numberOfLines={1}>{match.field_name}</Text>
          ) : null}
          <View style={st.meta}>
            <Text variant="small" style={{ color: c.muted }}>
              يبدأ <Text variant="small" style={{ color: c.text, fontFamily: fonts.semibold }}>{formatClock(match.starts_at)}</Text>
            </Text>
            {match.cost_per_player ? (
              <Text variant="small" style={{ color: c.primary, fontFamily: fonts.bold }}>{formatIQD(match.cost_per_player)}</Text>
            ) : null}
            <View style={st.count}>
              <Ionicons name="people-outline" size={14} color={c.primary} />
              <Text style={st.countText}>
                {match.joined_count} من {match.max_players}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      <ActionPill action={action} busy={busy} onPress={onAction} />
    </View>
  );
}

const useStyles = themed((c) => ({
  card: { backgroundColor: c.card, borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: c.border },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontFamily: fonts.bold, fontSize: 11, color: c.primary },
  venue: { fontFamily: fonts.bold, fontSize: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.cardAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontFamily: fonts.bold, fontSize: 12 },
  pill: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  pillBig: { minHeight: 52, borderRadius: 18, paddingHorizontal: 22 },
  pPrimary: { backgroundColor: c.primary },
  pSoft: { backgroundColor: c.primarySoft },
  pDone: { backgroundColor: '#E5F6EC' },
  pMuted: { backgroundColor: c.cardAlt },
  pillText: { fontFamily: fonts.bold, fontSize: 14 },
}));
