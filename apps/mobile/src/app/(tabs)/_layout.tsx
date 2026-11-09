import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { IconName } from '../../components/ui';
import { fonts, useColors } from '../../theme';

const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 },
        tabBarStyle: { height: 72, paddingTop: 4, paddingBottom: 10, backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.header },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: fonts.bold },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', headerTitle: 'بالملعب', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="venues" options={{ title: 'الساحات', tabBarIcon: icon('location') }} />
      <Tabs.Screen name="tournaments" options={{ title: 'البطولات', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="stats" options={{ title: 'الإحصائيات', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
