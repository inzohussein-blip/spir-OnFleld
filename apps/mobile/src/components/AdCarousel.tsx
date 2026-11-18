import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, View, type GestureResponderEvent } from 'react-native';
import { shareInvite } from '../lib/share';
import { useSession } from '../lib/session';
import type { Ad } from '../lib/types';
import { themed } from '../theme';
import { AdBanner } from './AdBanner';

const ROTATE_MS = 7000;
/** بعد ما يلمس اللاعب الإعلان، التبديل التلقائي يوقف هالمدة */
const RESUME_AFTER_MS = 10000;

/**
 * شريط الإعلانات: إعلان واحد بالمرة، يتبدل وحده، ونقاط تحته.
 * - الضغطة تفتح الإعلان، والسحب الأفقي يبدّل، والتمرير العمودي يروح للصفحة (ما يبدّل ولا يفتح).
 * - ما يتبدل الإعلان تحت إصبع اللاعب: التبديل يوقف أول ما يلمس، ويرجع بعد شوية.
 */
export function AdCarousel({ ads, now }: { ads: Ad[]; now: number }) {
  const st = useStyles();
  const router = useRouter();
  const { profile } = useSession();
  const [index, setIndex] = useState(0);
  // اللاعب لمس الإعلان: التبديل التلقائي يوقف، ويرجع بعد شوية من آخر لمسة
  const [held, setHeld] = useState(false);
  const [touches, setTouches] = useState(0);
  const count = ads.length;
  const current = count ? ads[index % count] : null;

  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), RESUME_AFTER_MS);
    return () => clearTimeout(t);
  }, [held, touches]);

  useEffect(() => {
    if (count < 2 || held) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearTimeout(t);
  }, [count, index, held]);

  // السحب الأفقي بس — والعمودي يبقى للصفحة
  const pan = useMemo(() => {
    // نحسب المسافة بأنفسنا من بداية السحب لنهايته (أدق من dx على الويب)
    const drag = { startX: 0 };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: (e, g) => {
        drag.startX = e.nativeEvent.pageX - g.dx;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (e) => {
        setHeld(true);
        setTouches((t) => t + 1);
        const dx = e.nativeEvent.pageX - drag.startX;
        // السحب لليسار = اللي بعده (اتجاه القراءة من اليمين)
        if (count > 1 && Math.abs(dx) > 40) setIndex((i) => (i + (dx < 0 ? 1 : -1) + count) % count);
      },
    });
  }, [count]);
  const hold = () => {
    setHeld(true);
    setTouches((t) => t + 1);
  };
  // مكان بداية اللمسة: إذا الإصبع تحرّك (تمرير للصفحة) ما تنحسب ضغطة
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const moved = (e: GestureResponderEvent) =>
    !startPoint || Math.hypot(e.nativeEvent.pageX - startPoint.x, e.nativeEvent.pageY - startPoint.y) > 10;

  if (!current) return null;

  const open = (ad: Ad) => {
    if (!ad.link) return;
    if (ad.link === 'share:invite') void shareInvite(profile?.public_id);
    else router.push(ad.link as Href);
  };

  return (
    <View>
      <View {...pan.panHandlers}>
        <AdBanner
          ad={current}
          now={now}
          onPress={current.link ? (e) => !moved(e) && open(current) : undefined}
          onPressIn={(e) => {
            hold();
            setStartPoint({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
          }}
        />
      </View>
      {count > 1 ? (
        <View style={st.dots}>
          {ads.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => {
                hold();
                setIndex(i);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`الإعلان ${i + 1}`}
              accessibilityState={{ selected: i === index % count }}
            >
              <View style={[st.dot, i === index % count && st.dotOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed((c) => ({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotOn: { width: 18, backgroundColor: c.primary },
}));
