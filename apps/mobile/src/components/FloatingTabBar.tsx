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
  rankings: ['trophy-outline', 'trophy'],
  profile: ['person-outline', 'person'],
};

/**
 * شريط سفلي عائم: القسم النشط يظهر بأيقونة ممتلئة واسم داخل كبسولة،
 * والبقية أيقونات فقط — أقل ازدحاماً وأسهل للمس.
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
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
              onPress={() => !focused && navigateToTab(route.key)}
              style={[st.item, focused && st.itemActive]}
              hitSlop={6}
            >
              <Ionicons name={focused ? filled : outline} size={22} color={focused ? c.primary : c.muted} />
              {focused ? <Text style={st.label}>{title}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 48, height: 48, borderRadius: 24, paddingHorizontal: 12 },
  itemActive: { backgroundColor: c.primarySoft, paddingHorizontal: 18 },
  label: { fontFamily: fonts.bold, fontSize: 14, color: c.primary },
}));
