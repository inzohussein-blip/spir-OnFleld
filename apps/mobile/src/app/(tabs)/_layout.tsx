import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { useColors } from '../../theme';

/** أربعة أقسام فقط — كل شيء آخر يُفتح من الرئيسية أو من حسابي */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="venues" options={{ title: 'الملاعب' }} />
      <Tabs.Screen name="rankings" options={{ title: 'التصنيفات' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
