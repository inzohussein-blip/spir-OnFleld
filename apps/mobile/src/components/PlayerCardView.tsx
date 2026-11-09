import { Pressable, StyleSheet, View } from 'react-native';
import { arcadeOverall, POSITION_CODE, tierOf, type CardTier } from '../lib/stats';
import type { Attributes, PlayerCard } from '../lib/types';
import { fonts } from '../theme';
import { Text } from './ui';

/**
 * بطاقة اللاعب — تصميم «بالملعب» الخاص: شريط أخضر بخطوط الملعب،
 * والفئة (برونزي/فضي/ذهبي/نخبة) حسب التقييم العام.
 */
const TIERS: Record<CardTier, { bg: string; edge: string; fg: string; label: string }> = {
  bronze: { bg: '#C98B5A', edge: '#8A5530', fg: '#2B1607', label: 'برونزية' },
  silver: { bg: '#C9D2D8', edge: '#8796A0', fg: '#1C262C', label: 'فضية' },
  gold: { bg: '#F0C64A', edge: '#B38A12', fg: '#2E2203', label: 'ذهبية' },
  elite: { bg: '#1E4FD8', edge: '#F5B700', fg: '#FFFFFF', label: 'نخبة' },
};

const ATTRS: [keyof Attributes, string][] = [
  ['pace', 'سرعة'],
  ['shooting', 'تسديد'],
  ['passing', 'تمرير'],
  ['dribbling', 'مراوغة'],
  ['defending', 'دفاع'],
  ['physical', 'بدنية'],
];

const ARCADE = { bg: '#DCE6FF', edge: '#1E4FD8', fg: '#101828', label: 'أركيد' };

/** mode: «full» بطاقة 11 ضد 11 (حسب المركز)، «arcade» بطاقة المباريات السريعة */
export function PlayerCardView({ card, onPress, width = 220, mode = 'full' }: { card: PlayerCard; onPress?: () => void; width?: number; mode?: 'full' | 'arcade' }) {
  const overall = mode === 'arcade' ? arcadeOverall(card.attributes) : card.overall;
  const tier = mode === 'arcade' ? ARCADE : TIERS[tierOf(overall)];
  const k = width / 220;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignSelf: 'center' }}>
      <View style={[s.card, { width, borderColor: tier.edge, backgroundColor: tier.bg, borderRadius: 22 * k }]}>
        {/* خطوط الملعب الزخرفية */}
        <View style={[s.stripe, { top: 0, height: 120 * k, backgroundColor: tier.edge, opacity: 0.18 }]} />
        <View style={[s.centerCircle, { width: 110 * k, height: 110 * k, borderRadius: 55 * k, top: 10 * k, borderColor: tier.fg, opacity: 0.12 }]} />

        <View style={[s.top, { padding: 12 * k }]}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 38 * k, lineHeight: 44 * k, color: tier.fg }}>{overall}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13 * k, color: tier.fg }}>{POSITION_CODE[card.profile.preferred_position]}</Text>
          </View>
          <View style={[s.avatar, { width: 84 * k, height: 84 * k, borderRadius: 42 * k, borderColor: tier.edge }]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 38 * k, lineHeight: 50 * k, color: '#13201A' }}>{card.profile.full_name.slice(0, 1)}</Text>
          </View>
        </View>

        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 18 * k, color: tier.fg, textAlign: 'center', paddingHorizontal: 8 }}>
          {card.profile.full_name}
        </Text>
        <View style={[s.divider, { backgroundColor: tier.fg }]} />

        <View style={[s.attrs, { paddingHorizontal: 14 * k, paddingBottom: 6 * k }]}>
          {ATTRS.map(([key, label]) => (
            <View key={key} style={s.attr}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15 * k, color: tier.fg }}>{card.attributes[key]}</Text>
              <Text style={{ fontSize: 12 * k, color: tier.fg, opacity: 0.85 }}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.ribbon, { backgroundColor: tier.edge }]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11 * k, color: mode === 'full' && tierOf(overall) === 'elite' ? '#101828' : '#fff' }}>
            {mode === 'arcade' ? 'بطاقة الأركيد' : `بطاقة 11 ضد 11 · ${tier.label}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** بطاقة مصغّرة لعرضها على أرضية الملعب */
export function MiniCard({ card, label, onPress }: { card: PlayerCard; label: string; onPress?: () => void }) {
  const tier = TIERS[tierOf(card.overall)];
  return (
    <Pressable onPress={onPress} style={[s.mini, { backgroundColor: tier.bg, borderColor: tier.edge }]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: tier.fg }}>{card.overall}</Text>
      <View style={[s.miniAvatar, { borderColor: tier.edge }]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: '#13201A' }}>{card.profile.full_name.slice(0, 1)}</Text>
      </View>
      <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 14, color: tier.fg, fontFamily: fonts.semibold }}>
        {card.profile.full_name.split(' ')[0]}
      </Text>
      <View style={[s.miniLabel, { backgroundColor: tier.edge }]}>
        <Text style={{ fontSize: 9, lineHeight: 13, color: '#fff', fontFamily: fonts.bold }}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 3, overflow: 'hidden', gap: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  stripe: { position: 'absolute', left: 0, right: 0 },
  centerCircle: { position: 'absolute', alignSelf: 'center', borderWidth: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { backgroundColor: '#F4F7F5', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, opacity: 0.3, marginHorizontal: 18 },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4 },
  attr: { width: '31%', alignItems: 'center' },
  ribbon: { alignItems: 'center', paddingVertical: 4 },
  mini: { width: 62, borderRadius: 10, borderWidth: 2, alignItems: 'center', paddingTop: 2, overflow: 'hidden' },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F4F7F5', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  miniLabel: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
});
