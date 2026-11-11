import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { useHeaderButtons } from '../../components/AppHeader';
import type { IconName } from '../../components/ui';
import { fonts, useColors } from '../../theme';

export default function TabsLayout() {
  const c = useColors();
  const header = useHeaderButtons();
  const icon = (name: IconName) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return (
        <View style={{ paddingHorizontal: 14, paddingVertical: 3, borderRadius: 12, backgroundColor: focused ? c.primarySoft : 'transparent' }}>
          <Ionicons name={name} color={color as string} size={22} />
        </View>
      );
    };
  return (
    <Tabs
      screenOptions={{
        ...header,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 20 },
        tabBarStyle: { height: 80, paddingTop: 6, paddingBottom: 12, backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.header },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="trials" options={{ title: 'الاختبارات', tabBarIcon: icon('ribbon') }} />
      <Tabs.Screen name="posts" options={{ title: 'المنشورات', tabBarIcon: icon('newspaper') }} />
      <Tabs.Screen name="tournaments" options={{ title: 'البطولات', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="stats" options={{ title: 'الإحصائيات', tabBarIcon: icon('stats-chart') }} />
    </Tabs>
  );
}
