import { StackHeader } from '../../components/StackHeader';
import { Redirect, Stack, useSegments } from 'expo-router';
import { Platform, View } from 'react-native';
import { Empty, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/session';
import { fonts, headerText, useColors } from '../../theme';

/** صفحات إدارة المباريات: يدخلها الموظف والمدير، ومن الهاتف كمان (الموظف بالملعب) */
const STAFF_ROUTES = new Set(['index', 'new-match', 'matches']);

/**
 * لوحة التحكم:
 * - المدير: كل الصفحات (الباقي على المتصفح بس)
 * - الموظف: إدارة المباريات بس
 * في الوضع التجريبي مفتوحة للتجربة.
 */
export default function AdminLayout() {
  const c = useColors();
  const segments = useSegments() as string[];
  const page = segments[1] ?? 'index';
  const { data: role, loading } = useAsync(() => api.myRole(), []);
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff' || isAdmin;
  const staffPage = STAFF_ROUTES.has(page);
  if (loading && role === null) return <Loading />;
  if (Platform.OS !== 'web' && !(isStaff && staffPage)) return <Redirect href="/" />;
  if (!isStaff || (!isAdmin && !staffPage)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Empty title={isStaff ? 'هاي الصفحة للمدير بس' : 'هاي الصفحة للإدارة فقط'} hint={isStaff ? 'حساب الموظف يدير المباريات بس' : 'سجّل دخول بحساب مدير أو موظف'} icon="lock-closed-outline" />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
        headerStyle: { backgroundColor: c.header },
        headerTintColor: headerText(c),
        headerTitleStyle: { fontFamily: fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: isAdmin ? 'لوحة التحكم' : 'لوحة الموظفين' }} />
      <Stack.Screen name="new-match" options={{ title: 'مباراة جديدة' }} />
      <Stack.Screen name="matches" options={{ title: 'إدارة المباريات' }} />
      <Stack.Screen name="staff" options={{ title: 'الموظفين' }} />
      <Stack.Screen name="suggestions" options={{ title: 'اقتراحات اللاعبين' }} />
      <Stack.Screen name="venues" options={{ title: 'الملاعب والصور والمواقع' }} />
      <Stack.Screen name="venue-location" options={{ title: 'موقع الملعب على الخريطة' }} />
      <Stack.Screen name="deletions" options={{ title: 'طلبات حذف الحساب' }} />
      <Stack.Screen name="ads" options={{ title: 'الإعلانات وقوالبها' }} />
      <Stack.Screen name="revenue" options={{ title: 'الأرباح والامتلاء' }} />
      <Stack.Screen name="rewards" options={{ title: 'المكافآت' }} />
      <Stack.Screen name="crashes" options={{ title: 'تقارير الأعطال' }} />
      <Stack.Screen name="ad-edit" options={{ title: 'إعلان' }} />
    </Stack>
  );
}
