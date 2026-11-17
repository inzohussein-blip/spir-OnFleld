import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, themed, useColors } from '../theme';
import { Text, type IconName } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** أيقونة كل قسم: [غير نشط، نشط] */
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  venues: ['football-outline', 'football'],
  map: ['map-outline', 'map'],
  rankings: ['trophy-outline', 'trophy'],
  profile: ['person-outline', 'person'],
};

/** القسم اللي ينرسم كزر كرة بالنص */
const CENTER = 'map';

/**
 * شريط سفلي عائم: كل قسم أيقونة وتحتها اسمها (النشط بلون الغروب)،
 * والخريطة زر دائري كبير بالنص بتدرّج الغروب طالع فوق الشريط.
 */
export function FloatingTabBar({ state, descriptors, navigateToTab, insets }: TabBarProps) {
  const c = useColors();
  const st = useStyles();
  const safe = useSafeAreaInsets();
  return (
    <View style={[st.wrap, { paddingBottom: Math.max(insets?.bottom ?? 0, safe.bottom, 10) }]} pointerEvents="box-none">
      <View style={st.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const title = descriptors[route.key]?.options.title ?? route.name;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const go = () => !focused && navigateToTab(route.key);
          if (route.name === CENTER) {
            return (
              <View key={route.key} style={st.centerSlot}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={title}
                  onPress={go}
                  style={({ pressed }) => [st.center, focused && st.centerOn, pressed && { transform: [{ scale: 0.95 }] }]}
                  hitSlop={6}
                >
                  <Ionicons name={filled} size={26} color="#fff" />
                </Pressable>
                <Text style={[st.label, focused && st.labelOn]}>{title}</Text>
              </View>
            );
          }
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} onPress={go} style={st.item} hitSlop={6}>
              <Ionicons name={focused ? filled : outline} size={22} color={focused ? c.primary : c.muted} />
              <Text style={[st.label, focused && st.labelOn]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = themed((c) => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 32,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, height: 50 },
  label: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 16, color: c.muted },
  labelOn: { fontFamily: fonts.bold, color: c.primary },
  // زر الكرة: يطلع فوق الشريط، وإطاره بلون الخلفية حتى يبين مقصوص
  centerSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 50 },
  center: {
    position: 'absolute',
    top: -34,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 5,
    borderColor: c.bg,
    backgroundColor: c.primary,
    backgroundImage: c.primaryGradient,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(232,23,59,0.35)',
  },
  centerOn: { boxShadow: '0 8px 22px rgba(232,23,59,0.55)' },
}));
