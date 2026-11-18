import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const YELLOW = '#FFD60A';
const NAVY = '#0B1033';
/** مسافة السحب اللي تبدّي التحديث */
const THRESHOLD = 80;
const MAX_PULL = 140;
/** أقل مدة تبقى بيها الكرة تنط حتى الحركة تبين */
const MIN_BALL_MS = 900;
const NATIVE = Platform.OS !== 'web';

type Phase = 'idle' | 'drip' | 'ball';

/**
 * سحب للتحديث بشكل كرة: تسحب الصفحة لتحت فتنزل كرة صفرة وتتمطّط مثل قطرة،
 * ولما تتركها ترجع كرة تدور وتنط لحد ما يخلص التحديث. دايرة النظام (السهم المقوّس) مخفية.
 * - الآيفون: القطرة تمشي ويّا الإصبع (من مسافة سحب الصفحة).
 * - الويب: السحب مبني هنا، والصفحة تنزل ويّا الإصبع.
 * - الأندرويد: النظام ما يعطي مسافة السحب، فالقطرة تطلع وتتمطّط أول ما يوصل السحب لحد التحديث.
 */
export function PullRefreshScroll({
  onRefresh,
  top,
  children,
  ...scroll
}: Omit<ScrollViewProps, 'refreshControl' | 'onScroll'> & {
  onRefresh: () => Promise<unknown> | void;
  /** مكان الكرة من فوق (الافتراضي: تحت شريط الحالة) */
  top?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [pull] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [phase, setPhase] = useState<Phase>('idle');
  // حالة متغيّرة بدون إعادة رسم: مكان السكرول، هل دا يتحدث، هل الإصبع يسحب، وآخر onRefresh
  const stateRef = useRef({ atTop: true, busy: false, dragging: false, onRefresh });
  useEffect(() => {
    stateRef.current.onRefresh = onRefresh;
  }, [onRefresh]);

  // الكرة تدور وتنط وقت التحديث
  useEffect(() => {
    if (phase !== 'ball') return;
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [phase, spin]);

  const [run] = useState(() => async () => {
    const g = stateRef.current;
    if (g.busy) return;
    g.busy = true;
    setPhase('drip');
    // القطرة تتمطّط لحد التحديث، بعدين ترجع كرة
    await new Promise<void>((r) => Animated.timing(pull, { toValue: THRESHOLD, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => r()));
    setPhase('ball');
    const started = Date.now();
    try {
      await g.onRefresh();
    } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_BALL_MS - (Date.now() - started))));
      Animated.timing(pull, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => {
        setPhase('idle');
        g.busy = false;
      });
    }
  });

  // الويب: سحب مبني هنا لما الصفحة بأعلاها
  // eslint-disable-next-line react-hooks/refs -- الـ ref ينقرا بس داخل دوال اللمس، مو أثناء الرسم
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, s) => Platform.OS === 'web' && stateRef.current.atTop && !stateRef.current.busy && s.dy > 8 && s.dy > Math.abs(s.dx) * 1.4,
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
    const y = e.nativeEvent.contentOffset.y;
    const g = stateRef.current;
    g.atTop = y <= 0;
    // الآيفون: الصفحة تنزل تحت الصفر وقت السحب — القطرة تمشي ويّا الإصبع
    if (Platform.OS === 'ios' && !g.busy && g.dragging) {
      if (y < 0) {
        if (phase !== 'drip') setPhase('drip');
        pull.setValue(Math.min(-y, MAX_PULL));
      } else if (phase === 'drip') {
        pull.setValue(0);
        setPhase('idle');
      }
    }
  };

  const ball = phase === 'ball';
  // القطرة: تكبر وتتمطّط ويّا السحب (رأسها لفوق)
  const dropScale = pull.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0.35, 1], extrapolate: 'clamp' });
  const dropStretch = pull.interpolate({ inputRange: [0, THRESHOLD, MAX_PULL], outputRange: [1, 1.3, 1.6], extrapolate: 'clamp' });
  const dropY = pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: [-24, 48], extrapolate: 'clamp' });
  const opacity = pull.interpolate({ inputRange: [0, 16], outputRange: [0, 1], extrapolate: 'clamp' });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const hop = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -12, 0] });
  const contentY = Platform.OS === 'web' ? pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: [0, MAX_PULL * 0.6] }) : 0;

  return (
    <View style={{ flex: 1 }} {...(Platform.OS === 'web' ? pan.panHandlers : {})}>
      <Animated.ScrollView
        {...scroll}
        style={[scroll.style, { transform: [{ translateY: contentY }] }]}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          stateRef.current.dragging = true;
        }}
        onScrollEndDrag={() => {
          stateRef.current.dragging = false;
          if (Platform.OS === 'ios' && phase === 'drip' && !stateRef.current.busy) Animated.spring(pull, { toValue: 0, useNativeDriver: false }).start(() => setPhase('idle'));
        }}
        scrollEventThrottle={16}
        refreshControl={
          Platform.OS === 'web' ? undefined : (
            // دايرة النظام مخفية — الكرة هي اللي تبين
            <RefreshControl refreshing={false} onRefresh={() => void run()} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" progressViewOffset={-1000} />
          )
        }
      >
        {children}
      </Animated.ScrollView>
      {phase !== 'idle' ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: top ?? insets.top + 10, left: 0, right: 0, alignItems: 'center', zIndex: 50 }} accessibilityLabel="دا يتحدّث" accessibilityLiveRegion="polite">
          {ball ? (
            <Animated.View style={{ transform: [{ translateY: Animated.add(dropY, hop) }, { rotate }] }}>
              <Ball />
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity, transform: [{ translateY: dropY }, { scale: dropScale }, { scaleY: dropStretch }] }}>
              {/* قطرة: مربع مدوّر من ثلاث زوايا ومقلوب 45° حتى رأسه لفوق، وبنصها الكرة */}
              <View style={{ width: 40, height: 40, borderRadius: 20, borderTopLeftRadius: 3, transform: [{ rotate: '45deg' }], backgroundColor: YELLOW, borderWidth: 2, borderColor: NAVY, alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 0 ${NAVY}` }}>
                <View style={{ transform: [{ rotate: '-45deg' }] }}>
                  <Ionicons name="football" size={24} color={NAVY} />
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** الكرة الصفرة بإطار كحلي */
function Ball() {
  return (
    <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW, borderWidth: 2, borderColor: NAVY, boxShadow: `0 4px 0 ${NAVY}` }}>
      <Ionicons name="football" size={30} color={NAVY} />
    </View>
  );
}
