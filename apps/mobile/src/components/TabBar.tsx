import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, themed, useColors } from '../theme';
import { Text, type IconName } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** أيقونة كل قسم: [غير نشط، نشط] — كلها من نفس العائلة وبنفس الحجم */
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  venues: ['football-outline', 'football'],
  map: ['map-outline', 'map'],
  rankings: ['trophy-outline', 'trophy'],
  profile: ['person-outline', 'person'],
};

/**
 * الشريط السفلي «ملكي»: أزرق ملكي ملتصق بأسفل الشاشة، خمسة أقسام متساوية،
 * أيقونة بحجم 24 وتحتها اسمها. النشط بالأصفر وبأيقونة معبّاة.
 */
export function TabBar({ state, descriptors, navigateToTab, insets }: TabBarProps) {
  const c = useColors();
  const st = useStyles();
  const safe = useSafeAreaInsets();
  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets?.bottom ?? 0, safe.bottom, 6) }]} accessibilityRole="tablist">
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
            style={st.item}
            testID={`tab-${route.name}`}
          >
            <Ionicons name={focused ? filled : outline} size={24} color={focused ? c.tabActive : c.tabInactive} />
            <Text style={[st.label, focused && st.labelOn]} numberOfLines={1}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themed((c) => ({
  bar: { flexDirection: 'row', backgroundColor: c.tabBg, paddingTop: c.tabRound ? 10 : 8, borderTopLeftRadius: c.tabRound, borderTopRightRadius: c.tabRound, overflow: 'hidden', borderTopWidth: c.tabBg === '#FFFFFF' ? 1 : 0, borderTopColor: c.border },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, color: c.tabInactive },
  labelOn: { fontFamily: fonts.bold, color: c.tabActive, ...(c.tabUnderline ? { borderBottomWidth: 2, borderBottomColor: c.cta, paddingBottom: 1 } : null) },
}));
