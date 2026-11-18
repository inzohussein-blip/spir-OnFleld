import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import logo from '../../assets/icon.png';

/**
 * شاشة الشعار عند فتح التطبيق: الشعار على الأزرق الملكي وشريطين أصفر مايلين، وتحته «احجز · العب · اربح»
 * وشريط تحميل يتعبّى. تطلع بعد شاشة البداية مال النظام لحد ما يجهز التطبيق.
 * (ألوانها ثابتة — ما تعتمد على الوضع الفاتح/الداكن — وخطها خط النظام لأن خط Cairo ممكن بعده ما تحمّل)
 */
export function BrandSplash({ durationMs = 1300 }: { durationMs?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [appear, progress, durationMs]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] });
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <View style={{ flex: 1, backgroundColor: '#1A23C9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} accessibilityLabel="بالملعب — جاري التحميل">
      {/* شريطين أصفر مايلين — علامة «ملكي» */}
      <View style={{ position: 'absolute', top: -40, bottom: -40, left: -50, width: 130, backgroundColor: '#FFD60A', transform: [{ skewX: '-14deg' }] }} />
      <View style={{ position: 'absolute', top: -40, bottom: -40, left: 96, width: 20, backgroundColor: '#FFD60A', transform: [{ skewX: '-14deg' }] }} />
      <Animated.View style={{ alignItems: 'center', gap: 16, opacity: appear, transform: [{ scale }] }}>
        <Image
          source={logo}
          style={{ width: 128, height: 128, borderRadius: 36, boxShadow: '0 6px 0 #0B1033' }}
          accessibilityIgnoresInvertColors
        />
        <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 6 }}>بالملعب</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>احجز · العب · اربح</Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 90, width: 140, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width, borderRadius: 3, backgroundColor: '#FFD60A' }} />
      </View>
    </View>
  );
}
