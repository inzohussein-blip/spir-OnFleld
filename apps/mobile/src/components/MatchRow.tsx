import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { formatClock, formatCountdown, formatIQD } from '../lib/format';
import { matchAction, type MatchAction } from '../lib/matchAction';
import type { Match } from '../lib/types';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

/** نص وشكل الزر الرئيسي حسب حالة المباراة */
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

export function ActionPill({ action, busy, onPress, big, onBar }: { action: MatchAction; busy?: boolean; onPress: () => void; big?: boolean; onBar?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const { text, tone, enabled } = actionLabel(action);
  // على الشريط الملوّن أسفل صفحة المباراة: زر فاتح على خلفية الأزرق
  const box = onBar ? (enabled ? st.pOnBar : st.pOnBarMuted) : { primary: st.pPrimary, soft: st.pSoft, done: st.pDone, muted: st.pMuted }[tone];
  const fg = onBar ? (enabled ? c.primary : '#FFFFFF') : { primary: c.onPrimary, soft: c.primary, done: '#1C8B4A', muted: c.muted }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!enabled || busy}
      onPress={onPress}
      style={({ pressed }) => [st.pill, big && st.pillBig, box, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.pillText, big && { fontSize: 15 }, { color: fg }]}>{text}</Text>}
    </Pressable>
  );
}

/** بطاقة مباراة بسيطة: رقم المباراة، اسم الساحة والزر، ثم السعر والوقت والعدد */
export function MatchRow({ match, index, now, busy, onAction }: { match: Match; index: number; now: number; busy?: boolean; onAction: () => void }) {
  const router = useRouter();
  const st = useStyles();
  const c = useColors();
  const action = matchAction(match, now);
  const open = () => router.push({ pathname: '/match/[id]', params: { id: match.id } });
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" style={{ color: c.muted }}>
        المباراة: <Text variant="small" style={{ color: c.text, fontFamily: fonts.bold }}>{index}</Text>
      </Text>
      <View style={st.card}>
        <View style={st.head}>
          <Pressable onPress={open} style={{ flex: 1 }}>
            <Text style={st.venue} numberOfLines={2}>{match.venue_name ?? match.title ?? 'مباراة'}</Text>
          </Pressable>
          <View style={{ width: 150 }}>
            <ActionPill action={action} busy={busy} onPress={onAction} />
          </View>
        </View>
        <Pressable onPress={open} style={st.body}>
          <View style={st.thumb}>
            <Ionicons name="football" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {match.cost_per_player ? (
              <Text variant="small" style={{ color: c.muted }}>
                السعر: <Text style={{ color: c.primary, fontFamily: fonts.bold }}>{formatIQD(match.cost_per_player)}</Text>
              </Text>
            ) : null}
            <Text variant="small" style={{ color: c.muted }}>
              يبدأ: <Text style={{ color: c.text, fontFamily: fonts.semibold }}>{formatClock(match.starts_at)}</Text>
            </Text>
          </View>
          <View style={st.count}>
            <Ionicons name="people-outline" size={16} color={c.primary} />
            <Text style={st.countText}>
              {match.joined_count} من {match.max_players}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = themed((c) => ({
  card: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  venue: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 26 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#1C8B4A', alignItems: 'center', justifyContent: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.cardAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  countText: { fontFamily: fonts.bold, fontSize: 13 },
  pill: { minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  pillBig: { minHeight: 52, borderRadius: 18, paddingHorizontal: 22 },
  pPrimary: { backgroundColor: c.primary },
  pSoft: { backgroundColor: c.primarySoft },
  pDone: { backgroundColor: '#E5F6EC' },
  pMuted: { backgroundColor: c.cardAlt },
  pOnBar: { backgroundColor: '#FFFFFF' },
  pOnBarMuted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillText: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center' },
}));
