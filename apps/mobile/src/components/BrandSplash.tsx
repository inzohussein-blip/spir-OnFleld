import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import logo from '../../assets/icon.png';

/**
 * شاشة الشعار عند فتح التطبيق: الشعار بتدرّج الغروب على أسود، وتحته «احجز · العب · اربح»
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
    <View style={{ flex: 1, backgroundColor: '#0B0A0B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} accessibilityLabel="بالملعب — جاري التحميل">
      {/* توهّج الغروب */}
      <View style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, top: '18%', backgroundColor: 'rgba(255,106,0,0.16)' }} />
      <View style={{ position: 'absolute', width: 520, height: 520, borderRadius: 260, bottom: -300, backgroundColor: 'rgba(232,23,59,0.18)' }} />
      <Animated.View style={{ alignItems: 'center', gap: 16, opacity: appear, transform: [{ scale }] }}>
        <Image
          source={logo}
          style={{ width: 128, height: 128, borderRadius: 36, boxShadow: '0 20px 50px rgba(232,23,59,0.45)' }}
          accessibilityIgnoresInvertColors
        />
        <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 6 }}>بالملعب</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>احجز · العب · اربح</Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 90, width: 140, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width, borderRadius: 3, backgroundColor: '#FF4D2E', backgroundImage: 'linear-gradient(90deg, #FF6A00 0%, #E8173B 100%)' }} />
      </View>
    </View>
  );
}
