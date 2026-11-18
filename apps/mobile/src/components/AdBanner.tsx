import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Image, Pressable, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { countdownParts } from '../lib/ads';
import type { Ad } from '../lib/types';
import { fonts } from '../theme';
import { Text } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];
const NAVY = '#0B1F5C';
const GOLD = '#F5C431';

/** ألوان كل قالب: الخلفية المتدرجة، ولون كتابة الزر، وأيقونة الكلمة الصغيرة */
const LOOK: Record<Ad['template'], { bg: string; base: string; accent: string; icon: IconName }> = {
  services: { bg: 'linear-gradient(135deg, #2F66F0 0%, #1739B0 60%, #0B1F5C 100%)', base: '#1739B0', accent: '#1E4FD8', icon: 'sparkles' },
  league: { bg: 'linear-gradient(135deg, #0B1F5C 0%, #13286E 55%, #1E3FA0 100%)', base: '#13286E', accent: NAVY, icon: 'flame' },
  motm: { bg: 'linear-gradient(135deg, #7A4DFF 0%, #4C2BD1 55%, #2A1A8C 100%)', base: '#4C2BD1', accent: '#4C2BD1', icon: 'star' },
  offpeak: { bg: 'linear-gradient(135deg, #FF8A3D 0%, #F25C1F 55%, #C93C10 100%)', base: '#F25C1F', accent: '#E2541A', icon: 'sunny' },
  invite: { bg: 'linear-gradient(135deg, #12B886 0%, #0C9A6F 55%, #077A57 100%)', base: '#0C9A6F', accent: '#0C9A6F', icon: 'gift' },
  partner: { bg: 'linear-gradient(90deg, #0E5A30 0%, #1C8B4A 70%)', base: '#1C8B4A', accent: '#1C8B4A', icon: 'location' },
};

/** أطول شوية من تحت حتى العنوان والتفاصيل والزر ياخذون راحتهم */
export const AD_HEIGHT = 168;

/** إعلان واحد بأحد القوالب الستة. `now` للعد التنازلي */
export function AdBanner({ ad, now, onPress, onPressIn, onPressOut, style }: { ad: Ad; now: number; onPress?: (e: GestureResponderEvent) => void; onPressIn?: (e: GestureResponderEvent) => void; onPressOut?: () => void; style?: ViewStyle }) {
  const look = LOOK[ad.template];
  const countdown = ad.template === 'league' ? countdownParts(ad.countdown_to, now) : null;
  const photo = ad.template === 'partner' && ad.image_url ? ad.image_url : null;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`إعلان: ${ad.title}`}
      style={({ pressed }) => [box, { backgroundColor: look.base, backgroundImage: look.bg }, pressed && { opacity: 0.92 }, style]}
    >
      {/* الخلفية */}
      {photo ? (
        <>
          <Image source={{ uri: photo }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} accessibilityLabel={ad.title} />
          <View style={[fill, { backgroundImage: 'linear-gradient(270deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.05) 100%)' }]} />
        </>
      ) : ad.template === 'partner' ? (
        <Stripes />
      ) : null}
      {!photo ? <PitchLines faint={ad.template === 'league'} wide={ad.template === 'partner'} /> : null}
      {ad.template !== 'partner' ? <View style={shine} /> : null}
      {ad.template === 'league' ? <View style={goldGlow} /> : null}

      {/* النص */}
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
        {ad.eyebrow ? (
          <View style={[eyebrow, ad.template === 'league' && { backgroundColor: GOLD, borderColor: GOLD }]}>
            <Ionicons name={look.icon} size={11} color={ad.template === 'league' ? NAVY : '#fff'} />
            <Text style={[eyebrowText, ad.template === 'league' && { color: NAVY }]} numberOfLines={1}>{ad.eyebrow}</Text>
          </View>
        ) : null}
        <Text style={[title, ad.template === 'partner' && { fontSize: 20, lineHeight: 30 }]}>{ad.title}</Text>
        {ad.body ? <Text style={body}>{ad.body}</Text> : null}
        {countdown ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {(
              [
                [countdown[0], 'أيام'],
                [countdown[1], 'ساعة'],
                [countdown[2], 'دقيقة'],
              ] as const
            ).map(([n, l]) => (
              <View key={l} style={cdBox}>
                <Text style={cdNum}>{n}</Text>
                <Text style={cdLabel}>{l}</Text>
              </View>
            ))}
          </View>
        ) : ad.cta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <View style={cta}>
              {ad.link === 'share:invite' ? <Ionicons name="share-social" size={15} color={look.accent} /> : null}
              <Text style={[ctaText, { color: look.accent }]}>{ad.cta}</Text>
              {ad.link && ad.link !== 'share:invite' ? <Ionicons name="chevron-back" size={15} color={look.accent} /> : null}
            </View>
            {ad.template === 'partner' && ad.rating !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={13} color={GOLD} />
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 12 }}>{ad.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* الرسمة */}
      {ad.template !== 'partner' ? <Art ad={ad} /> : null}
    </Pressable>
  );
}

function Art({ ad }: { ad: Ad }) {
  switch (ad.template) {
    case 'services':
      return (
        <View style={art}>
          <View style={glow} />
          <Bubble size={62} top={24} right={21} icon="football" color={NAVY} iconSize={40} />
          <Bubble size={34} top={2} left={6} icon="camera" color="#1E4FD8" />
          <Bubble size={34} bottom={4} left={2} icon="water" color="#0EA5E9" />
          <Bubble size={30} bottom={0} right={2} icon="medkit" color="#E5484D" iconSize={15} />
        </View>
      );
    case 'league':
      return (
        <View style={art}>
          <View style={[glow, { backgroundColor: 'rgba(245,196,49,0.28)' }]} />
          <Ionicons name="trophy" size={78} color={GOLD} />
          <View style={{ position: 'absolute', bottom: 6, width: 64, height: 8, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        </View>
      );
    case 'motm':
      return (
        <View style={art}>
          <View style={playerCard}>
            <Text style={{ color: NAVY, fontFamily: fonts.bold, fontSize: 22, lineHeight: 26 }}>{ad.badge || '88'}</Text>
            <Text style={{ color: NAVY, fontFamily: fonts.bold, fontSize: 9, lineHeight: 13 }}>رجل المباراة</Text>
            <View style={{ marginTop: 4, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(11,31,92,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={26} color={NAVY} />
            </View>
            <Text style={{ color: NAVY, fontFamily: fonts.bold, fontSize: 9, lineHeight: 14, marginTop: 2 }}>لاعبك</Text>
          </View>
          <Bubble size={30} top={2} left={2} icon="star" color={GOLD} iconSize={16} />
        </View>
      );
    case 'offpeak':
      return (
        <View style={art}>
          <View style={glow} />
          <View style={discount}>
            <Text style={{ color: '#F25C1F', fontFamily: fonts.bold, fontSize: (ad.badge ?? '').length > 4 ? 22 : 28, lineHeight: 34 }}>{ad.badge || '%'}</Text>
            <Text style={{ color: '#F25C1F', fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 }}>خصم</Text>
          </View>
        </View>
      );
    case 'invite':
      return (
        <View style={art}>
          <View style={glow} />
          {(
            [
              ['ع', '#FFFFFF', 16, 48],
              ['م', '#FFE58A', 38, 10],
              ['ح', '#CFE0FF', 60, 48],
            ] as const
          ).map(([l, bg, top, right]) => (
            <View key={l} style={[friend, { top, right, backgroundColor: bg }]}>
              <Text style={{ color: NAVY, fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 }}>{l}</Text>
            </View>
          ))}
          <Bubble size={30} top={4} left={0} icon="gift" color="#0C9A6F" iconSize={16} />
        </View>
      );
    default:
      return null;
  }
}

function Bubble({ size, icon, color, iconSize, ...pos }: { size: number; icon: IconName; color: string; iconSize?: number; top?: number; bottom?: number; left?: number; right?: number }) {
  return (
    <View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 12px rgba(0,0,0,0.25)' }, pos]}>
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.53)} color={color} />
    </View>
  );
}

/** خطوط ملعب خفيفة بخلفية الإعلان */
function PitchLines({ faint, wide }: { faint?: boolean; wide?: boolean }) {
  const c = `rgba(255,255,255,${faint ? 0.08 : wide ? 0.32 : 0.13})`;
  if (wide) {
    // إعلان الملعب: نص ملعب على اليسار
    return (
      <View pointerEvents="none" style={fill}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '33%', width: 2, backgroundColor: c }} />
        <View style={{ position: 'absolute', left: '33%', top: AD_HEIGHT / 2 - 34, width: 68, height: 68, marginLeft: -33, borderRadius: 34, borderWidth: 2, borderColor: c }} />
        <View style={{ position: 'absolute', left: -2, top: AD_HEIGHT / 2 - 40, width: 40, height: 80, borderWidth: 2, borderColor: c }} />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={fill}>
      <View style={{ position: 'absolute', top: 12, bottom: 12, left: -20, right: -20, borderWidth: 2, borderColor: c, borderRadius: 4 }} />
      <View style={{ position: 'absolute', top: 12, bottom: 12, left: '50%', width: 2, backgroundColor: c }} />
      <View style={{ position: 'absolute', left: '50%', top: AD_HEIGHT / 2 - 30, width: 60, height: 60, marginLeft: -29, borderRadius: 30, borderWidth: 2, borderColor: c }} />
      <View style={{ position: 'absolute', left: -20, top: AD_HEIGHT / 2 - 35, width: 70, height: 70, borderWidth: 2, borderColor: c }} />
      <View style={{ position: 'absolute', right: -20, top: AD_HEIGHT / 2 - 35, width: 70, height: 70, borderWidth: 2, borderColor: c }} />
    </View>
  );
}

function Stripes() {
  return (
    <View pointerEvents="none" style={[fill, { flexDirection: 'row' }]}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? 'transparent' : 'rgba(255,255,255,0.05)' }} />
      ))}
    </View>
  );
}

const fill: ViewStyle = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 };
const box: ViewStyle = { height: AD_HEIGHT, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 };
const shine: ViewStyle = { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: -170, right: -60, backgroundColor: 'rgba(255,255,255,0.10)' };
const goldGlow: ViewStyle = { position: 'absolute', width: 170, height: 170, borderRadius: 85, top: -10, left: -30, backgroundColor: 'rgba(245,196,49,0.16)' };
const eyebrow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 9, marginBottom: 2 };
const eyebrowText = { color: '#fff', fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 18 };
const title = { color: '#fff', fontFamily: fonts.bold, fontSize: 18.5, lineHeight: 29 };
const body = { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, lineHeight: 20 };
const cta: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, height: 38, boxShadow: '0 4px 10px rgba(0,0,0,0.18)' };
const ctaText = { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22 };
const cdBox: ViewStyle = { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, alignItems: 'center', minWidth: 40 };
const cdNum = { color: '#fff', fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 };
const cdLabel = { color: 'rgba(255,255,255,0.85)', fontSize: 9.5, lineHeight: 13 };
const art: ViewStyle = { width: 104, height: 110, alignItems: 'center', justifyContent: 'center' };
const glow: ViewStyle = { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.16)' };
const playerCard: ViewStyle = { width: 78, height: 104, borderRadius: 14, alignItems: 'center', paddingTop: 7, backgroundColor: GOLD, backgroundImage: 'linear-gradient(160deg, #FFE58A 0%, #F5C431 55%, #C9951A 100%)', transform: [{ rotate: '-8deg' }], boxShadow: '0 10px 20px rgba(0,0,0,0.35)' };
const discount: ViewStyle = { width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }], boxShadow: '0 8px 18px rgba(0,0,0,0.25)' };
const friend: ViewStyle = { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#0C9A6F', alignItems: 'center', justifyContent: 'center' };
