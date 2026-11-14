import { Redirect, Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { Empty, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/session';
import { fonts, headerText, useColors } from '../../theme';

/** لوحة التحكم: على المتصفح فقط، وللمدير فقط (في الوضع التجريبي مفتوحة للتجربة) */
export default function AdminLayout() {
  const c = useColors();
  const { data: isAdmin, loading } = useAsync(() => api.isAdmin(), []);
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  if (loading && isAdmin === null) return <Loading />;
  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Empty title="هاي الصفحة للإدارة فقط" hint="سجّل دخول بحساب مدير" icon="lock-closed-outline" />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.header },
        headerTintColor: headerText(c),
        headerTitleStyle: { fontFamily: fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'لوحة التحكم' }} />
      <Stack.Screen name="new-match" options={{ title: 'مباراة جديدة' }} />
      <Stack.Screen name="suggestions" options={{ title: 'اقتراحات اللاعبين' }} />
      <Stack.Screen name="venues" options={{ title: 'الملاعب والصور' }} />
    </Stack>
  );
}
