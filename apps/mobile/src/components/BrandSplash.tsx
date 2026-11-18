import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Text, View } from 'react-native';
import mark from '../../assets/splash-icon.png';
import { Halftone } from './ui';

const ROYAL = '#1A23C9';
const YELLOW = '#FFD60A';
const NAVY = '#0B1033';
/** نفس حجم الشعار بشاشة البداية مال النظام (imageWidth بـ app.json) حتى ما يقفز */
const MARK = 180;
const NATIVE = Platform.OS !== 'web';

/**
 * شاشة التحميل «ملكي»: تبدي مطابقة لشاشة البداية مال النظام (أزرق ملكي وبالنص الشعار بنفس الحجم)
 * حتى الانتقال ما يبين. بعدين يدخل الشريطين الأصفر من الطرف، الشعار يصعد شوية ويطلع تحته الاسم
 * والشعار النصي، وشريط التحميل الأصفر يتعبّى. لما يجهز التطبيق، الشاشة تختفي بتلاشي ناعم.
 * (ألوانها ثابتة ما تعتمد على الوضع الفاتح/الداكن.)
 */
export function BrandSplash({
  durationMs = 1200,
  done,
  fontsReady,
  onHidden,
}: {
  durationMs?: number;
  /** التطبيق جاهز: نبدي التلاشي */
  done: boolean;
  /** خط العناوين تحمّل؟ (قبلها نستعمل خط النظام) */
  fontsReady: boolean;
  onHidden: () => void;
}) {
  const [intro] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 650, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  }, [intro, progress, durationMs]);

  useEffect(() => {
    if (!done) return;
    Animated.timing(fade, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => onHidden());
  }, [done, fade, onHidden]);

  const stripesX = intro.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] });
  const markY = intro.interpolate({ inputRange: [0, 1], outputRange: [0, -48] });
  const markScale = intro.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });
  const textY = intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const textOpacity = intro.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] });

  return (
    <Animated.View style={{ flex: 1, backgroundColor: ROYAL, opacity: fade, overflow: 'hidden' }} accessibilityLabel="بالملعب — جاري التحميل">
      <Halftone rows={64} cols={30} style={{ top: 12, left: 12 }} color="rgba(255,255,255,0.10)" />
      {/* الشريطين الأصفر يدخلون من الطرف */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -60, bottom: -60, left: -40, width: 90, transform: [{ translateX: stripesX }, { skewX: '-14deg' }], backgroundColor: YELLOW }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -60, bottom: -60, left: 66, width: 16, transform: [{ translateX: stripesX }, { skewX: '-14deg' }], backgroundColor: YELLOW }} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ translateY: markY }, { scale: markScale }] }}>
          <Image source={mark} style={{ width: MARK, height: MARK }} accessibilityIgnoresInvertColors />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', top: '50%', marginTop: MARK / 2 - 62, alignItems: 'center', gap: 4, opacity: textOpacity, transform: [{ translateY: textY }] }}>
          <Text style={{ color: '#FFFFFF', fontSize: 38, lineHeight: 52, fontFamily: fontsReady ? 'ReemKufi_700Bold' : undefined, fontWeight: fontsReady ? undefined : '800' }}>بالملعب</Text>
          <Text style={{ color: '#C9CEF5', fontSize: 15, fontFamily: fontsReady ? 'ReadexPro_600SemiBold' : undefined }}>احجز · العب · اربح</Text>
        </Animated.View>
      </View>

      {/* شريط التحميل الأصفر بظل كحلي */}
      <View style={{ position: 'absolute', bottom: 84, alignSelf: 'center', width: 150, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width: barWidth, borderRadius: 4, backgroundColor: YELLOW, borderBottomWidth: 2, borderBottomColor: NAVY }} />
      </View>
    </Animated.View>
  );
}
