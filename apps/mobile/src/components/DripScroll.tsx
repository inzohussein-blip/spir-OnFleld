import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

const SUNSET = 'linear-gradient(160deg, #FF6A00 0%, #E8173B 100%)';
/** مسافة السحب اللي تبدّي التحديث (على الويب) */
const THRESHOLD = 80;
const MAX_PULL = 130;
/** أقل مدة تبقى بيها الكرة تنط حتى الحركة تبين */
const MIN_BALL_MS = 900;

type Phase = 'idle' | 'drip' | 'ball';

/**
 * سحب للتحديث بشكل قطرة: تسحب الصفحة لتحت فتنزل قطرة بلون الغروب وتتمطّط،
 * ولما تتركها تنقلب كرة تنط لحد ما يخلص التحديث.
 * - على التلفون: نستعمل سحب النظام (أضمن على الأندرويد) ونخفي دايرته، ونرسم القطرة فوقه.
 * - على الويب: السحب نفسه مبني هنا (القطرة تكبر ويّا إصبعك).
 */
export function DripScroll({
  onRefresh,
  top = 0,
  children,
  contentContainerStyle,
}: {
  onRefresh: () => Promise<unknown> | void;
  /** مكان القطرة من فوق (تحت شريط الحالة) */
  top?: number;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const [pull] = useState(() => new Animated.Value(0));
  const [bounce] = useState(() => new Animated.Value(0));
  const [phase, setPhase] = useState<Phase>('idle');
  // حالة متغيّرة بدون إعادة رسم (مكان السكرول، هل دا يتحدث، وآخر onRefresh)
  const gRef = useRef({ atTop: true, busy: false, onRefresh });
  useEffect(() => {
    gRef.current.onRefresh = onRefresh;
  }, [onRefresh]);

  // الكرة تنط وهي بحالة التحديث
  useEffect(() => {
    if (phase !== 'ball') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, bounce]);

  const [run] = useState(() => async () => {
    const g = gRef.current;
    if (g.busy) return;
    g.busy = true;
    setPhase('drip');
    // القطرة تنزل وتتمطّط، بعدين تصير كرة
    await new Promise<void>((r) => Animated.timing(pull, { toValue: THRESHOLD, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => r()));
    setPhase('ball');
    const started = Date.now();
    try {
      await g.onRefresh();
    } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_BALL_MS - (Date.now() - started))));
      Animated.timing(pull, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => {
        setPhase('idle');
        g.busy = false;
      });
    }
  });

  // الويب: سحب مبني هنا لما الصفحة بأعلاها
  // eslint-disable-next-line react-hooks/refs -- الـ ref ينقرا بس داخل دوال اللمس، مو أثناء الرسم
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, s) => Platform.OS === 'web' && gRef.current.atTop && !gRef.current.busy && s.dy > 8 && s.dy > Math.abs(s.dx) * 1.4,
      onPanResponderGrant: () => setPhase('drip'),
      onPanResponderMove: (_, s) => pull.setValue(Math.max(0, Math.min(s.dy * 0.55, MAX_PULL))),
      onPanResponderRelease: (_, s) => {
        if (s.dy * 0.55 >= THRESHOLD) void run();
        else Animated.spring(pull, { toValue: 0, useNativeDriver: false }).start(() => setPhase('idle'));
      },
      onPanResponderTerminate: () => Animated.spring(pull, { toValue: 0, useNativeDriver: false }).start(() => setPhase('idle')),
    }),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    gRef.current.atTop = e.nativeEvent.contentOffset.y <= 0;
  };

  // القطرة: تكبر وتتمطّط ويّا السحب
  const dropScaleY = pull.interpolate({ inputRange: [0, THRESHOLD, MAX_PULL], outputRange: [0.4, 1.25, 1.5], extrapolate: 'clamp' });
  const dropScale = pull.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0.4, 1], extrapolate: 'clamp' });
  const dropY = pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: [-30, 46], extrapolate: 'clamp' });
  const opacity = pull.interpolate({ inputRange: [0, 20], outputRange: [0, 1], extrapolate: 'clamp' });
  const ballY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const contentY = Platform.OS === 'web' ? pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: [0, MAX_PULL * 0.6] }) : 0;

  return (
    <View style={{ flex: 1 }} {...(Platform.OS === 'web' ? pan.panHandlers : {})}>
      <Animated.ScrollView
        style={{ transform: [{ translateY: contentY }] }}
        contentContainerStyle={contentContainerStyle}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          Platform.OS === 'web' ? undefined : (
            // دايرة النظام مخفية — القطرة هي اللي تبين
            <RefreshControl refreshing={false} onRefresh={() => void run()} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" progressViewOffset={-1000} />
          )
        }
      >
        {children}
      </Animated.ScrollView>
      {phase !== 'idle' ? (
        <View pointerEvents="none" style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center', zIndex: 50 }} accessibilityLabel="دا يتحدّث" accessibilityLiveRegion="polite">
          {phase === 'drip' ? (
            <Animated.View style={{ opacity, transform: [{ translateY: dropY }, { scale: dropScale }, { scaleY: dropScaleY }] }}>
              {/* قطرة: مربع مدوّر من ثلاث زوايا ومقلوب 45° حتى رأسه لفوق */}
              <View style={{ width: 34, height: 34, borderRadius: 17, borderTopLeftRadius: 2, transform: [{ rotate: '45deg' }], backgroundColor: '#F2402E', backgroundImage: SUNSET, boxShadow: '0 6px 14px rgba(232,23,59,0.35)' }} />
            </Animated.View>
          ) : (
            <Animated.View style={{ transform: [{ translateY: Animated.add(dropY, ballY) }] }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2402E', backgroundImage: SUNSET, boxShadow: '0 8px 16px rgba(232,23,59,0.4)' }}>
                <Ionicons name="football" size={30} color="#fff" />
              </View>
            </Animated.View>
          )}
        </View>
      ) : null}
    </View>
  );
}
