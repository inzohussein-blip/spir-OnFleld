import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '../../components/TabBar';
import { useColors } from '../../theme';

/** خمسة أقسام — كل شيء آخر يُفتح من الرئيسية أو من حسابي */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="venues" options={{ title: 'الملاعب' }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة' }} />
      <Tabs.Screen name="rankings" options={{ title: 'التصنيفات' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
