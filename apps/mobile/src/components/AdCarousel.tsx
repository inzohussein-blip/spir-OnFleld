import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { shareInvite } from '../lib/share';
import { useSession } from '../lib/session';
import type { Ad } from '../lib/types';
import { themed } from '../theme';
import { AD_HEIGHT, AdBanner } from './AdBanner';

const ROTATE_MS = 6000;
/** بعد ما يلمس اللاعب الإعلان، التبديل التلقائي يوقف هالمدة */
const RESUME_AFTER_MS = 9000;
/** فراغ بين البطاقات وهي تتحرك */
const GAP = 12;
/** على التلفون الحركة على خيط العرض (أنعم)، والويب ما يدعمها */
const NATIVE = Platform.OS !== 'web';

/**
 * شريط الإعلانات: البطاقة تمشي ويّا الإصبع، وتنقلب للي بعدها أو قبلها حسب المسافة والسرعة،
 * بحركة نابض ناعمة. البطاقات اللي جنبها تصغر شوية وقت السحب. يتبدّل وحده، ويوقف لما تلمسه.
 * - السحب لليسار = اللي بعده، ولليمين = اللي قبله. بالأطراف يقاوم شوية مثل المطاط.
 * - الضغطة (بدون سحب) تفتح الإعلان، والتمرير العمودي يبقى للصفحة.
 */
export function AdCarousel({ ads, now }: { ads: Ad[]; now: number }) {
  const st = useStyles();
  const router = useRouter();
  const { profile } = useSession();
  const count = ads.length;
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [touches, setTouches] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  // قيم تقراها دوال اللمس بدون إعادة إنشاء
  const liveRef = useRef({ step: 0, index: 0, count, start: 0 });
  // صار سحب بهاللمسة؟ — حتى السحب ما ينحسب ضغطة ويفتح الإعلان
  const draggedRef = useRef(false);

  const step = width + GAP;
  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(liveRef.current.count - 1, i));
    liveRef.current.index = n;
    setIndex(n);
    Animated.spring(x, { toValue: -n * liveRef.current.step, useNativeDriver: NATIVE, stiffness: 180, damping: 24, mass: 1 }).start();
  };
  const goRef = useRef(goTo);

  const hold = () => {
    setHeld(true);
    setTouches((t) => t + 1);
  };
  const holdRef = useRef(hold);
  // آخر نسخة من الدوال والعدد للمس (تتحدث بعد كل رسم)
  useEffect(() => {
    goRef.current = goTo;
    holdRef.current = hold;
    liveRef.current.count = count;
  });

  // عرض الشريط: نرجّع البطاقة لمكانها الصح لما يتغير
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w === width) return;
    setWidth(w);
    liveRef.current.step = w + GAP;
    x.setValue(-liveRef.current.index * (w + GAP));
  };

  // عدد الإعلانات تغيّر (حذف/إضافة): ما نطلع برا القائمة
  useEffect(() => {
    if (index > count - 1) goRef.current(Math.max(0, count - 1));
  }, [count, index]);

  // التبديل التلقائي، ويرجع للأول بعد الأخير
  useEffect(() => {
    if (count < 2 || held || !width) return;
    const t = setTimeout(() => goRef.current(index + 1 >= count ? 0 : index + 1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [count, index, held, width]);

  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), RESUME_AFTER_MS);
    return () => clearTimeout(t);
  }, [held, touches]);

  // eslint-disable-next-line react-hooks/refs -- الـ refs تنقرا بس داخل دوال اللمس، مو أثناء الرسم
  const [pan] = useState(() =>
    PanResponder.create({
      // السحب الأفقي بس — العمودي يبقى للصفحة
      onMoveShouldSetPanResponder: (_, g) => liveRef.current.count > 1 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => {
        draggedRef.current = true;
        holdRef.current();
        x.stopAnimation((v) => {
          liveRef.current.start = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const { start, step: s, count: n } = liveRef.current;
        let next = start + g.dx;
        const min = -(n - 1) * s;
        // مقاومة مطاطية بالأطراف
        if (next > 0) next = next * 0.35;
        else if (next < min) next = min + (next - min) * 0.35;
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const { index: i, step: s } = liveRef.current;
        const far = Math.abs(g.dx) > s * 0.18;
        const fast = Math.abs(g.vx) > 0.35;
        if ((far || fast) && g.dx < 0) goRef.current(i + 1);
        else if ((far || fast) && g.dx > 0) goRef.current(i - 1);
        else goRef.current(i);
      },
      onPanResponderTerminate: () => goRef.current(liveRef.current.index),
      // أثناء السحب ما نسلّم اللمسة للصفحة
      onPanResponderTerminationRequest: () => false,
    }),
  );

  if (!count) return null;

  const open = (ad: Ad) => {
    if (!ad.link) return;
    if (ad.link === 'share:invite') void shareInvite(profile?.public_id);
    else router.push(ad.link as Href);
  };

  return (
    <View>
      <View style={st.viewport} onLayout={onLayout} {...pan.panHandlers}>
        {width ? (
          <Animated.View style={[st.track, { transform: [{ translateX: x }] }]}>
            {ads.map((ad, i) => {
              // البطاقات اللي جنب المعروضة تصغر وتخفت شوية
              const range = [-(i + 1) * step, -i * step, -(i - 1) * step];
              const scale = x.interpolate({ inputRange: range, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' });
              const opacity = x.interpolate({ inputRange: range, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
              return (
                <Animated.View key={ad.id} style={{ width, marginRight: i < count - 1 ? GAP : 0, opacity, transform: [{ scale }] }}>
                  <AdBanner
                    ad={ad}
                    now={now}
                    onPressIn={() => {
                      draggedRef.current = false;
                      hold();
                    }}
                    onPress={ad.link ? () => !draggedRef.current && open(ad) : undefined}
                  />
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}
      </View>
      {count > 1 ? (
        <View style={st.dots}>
          {ads.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => {
                hold();
                goTo(i);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`الإعلان ${i + 1}`}
              accessibilityState={{ selected: i === index }}
            >
              <View style={[st.dot, i === index && st.dotOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed((c) => ({
  viewport: { height: AD_HEIGHT, overflow: 'hidden' },
  // الترتيب من اليسار لليمين دائماً حتى «لليسار = اللي بعده» يبقى ثابت
  track: { flexDirection: 'row', direction: 'ltr' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.border },
  dotOn: { width: 22, backgroundColor: c.primary },
}));
