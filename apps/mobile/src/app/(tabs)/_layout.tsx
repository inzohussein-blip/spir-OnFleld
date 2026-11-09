import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { colors, fonts } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 },
        tabBarStyle: { height: 72, paddingTop: 4, paddingBottom: 10 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: fonts.bold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'المباريات', headerTitle: 'بالملعب', tabBarIcon: icon('football') }} />
      <Tabs.Screen name="venues" options={{ title: 'الساحات', tabBarIcon: icon('location') }} />
      <Tabs.Screen name="my-matches" options={{ title: 'مبارياتي', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
