import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Badge, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

// staff: يظهر للموظف كمان (إدارة المباريات بس) — الباقي للمدير
const LINKS: { title: string; hint: string; icon: IconName; href: Href; staff?: boolean }[] = [
  { title: 'مباراة جديدة', hint: 'اختار الملعب والوقت وموعد فتح التسجيل', icon: 'add-circle-outline', href: '/admin/new-match', staff: true },
  { title: 'إدارة المباريات', hint: 'كل المباريات الجاية: الامتلاء، الخصم، الإلغاء، والتسكير', icon: 'football-outline', href: '/admin/matches', staff: true },
  { title: 'اقتراحات اللاعبين', hint: 'حوّل الاقتراح لمباراة بضغطة', icon: 'bulb-outline', href: '/admin/suggestions' },
  { title: 'الملاعب والصور والمواقع', hint: 'ارفع صورة لكل ملعب وحدد مكانه على الخريطة', icon: 'images-outline', href: '/admin/venues' },
  { title: 'الأرباح والامتلاء', hint: 'مدخول كل ملعب وكل يوم، الغياب، وساعات فارغة تستاهل عروض', icon: 'bar-chart-outline', href: '/admin/revenue' },
  { title: 'المكافآت', hint: 'مبلغ رجل المباراة ومكافأة دعوة الأصدقاء', icon: 'gift-outline', href: '/admin/rewards' },
  { title: 'تقارير الأعطال', hint: 'الأخطاء اللي صارت عند اللاعبين، ويّا نوع التلفون والنسخة', icon: 'bug-outline', href: '/admin/crashes' },
  { title: 'الإعلانات وقوالبها', hint: 'الإعلانات بالرئيسية: 6 قوالب جاهزة تعدّل نصوصها وتواريخها', icon: 'megaphone-outline', href: '/admin/ads' },
  { title: 'الموظفين', hint: 'عيّن موظف برقم اللاعب — يدير المباريات بس', icon: 'people-outline', href: '/admin/staff' },
  { title: 'طلبات حذف الحساب', hint: 'تنحذف خلال 30 يوم، وتنلغي إذا اللاعب رجع دخل', icon: 'trash-outline', href: '/admin/deletions' },
];

export default function AdminHome() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const role = useAsync(() => api.myRole(), []);
  const [now] = useState(() => Date.now());
  const isAdmin = role.data === 'admin';
  // الموظف ما يشوف الاقتراحات وطلبات الحذف — ما نطلبها أصلاً
  const { data: suggestions, reload: reloadS } = useAsync(() => (isAdmin ? api.adminListSuggestions() : Promise.resolve([])), [isAdmin]);
  const { data: matches, reload: reloadM } = useAsync(() => api.staffListMatches(), []);
  const { data: deletions, reload: reloadD } = useAsync(() => (isAdmin ? api.adminListDeletionRequests() : Promise.resolve([])), [isAdmin]);
  useFocusEffect(
    useCallback(() => {
      void reloadS();
      void reloadM();
      void reloadD();
    }, [reloadS, reloadM, reloadD]),
  );
  const pending = (suggestions ?? []).filter((s) => s.status === 'pending').length;
  const upcoming = (matches ?? []).filter((m) => m.status !== 'cancelled' && new Date(m.ends_at).getTime() > now).length;
  // بالهاتف: صفحات المباريات بس (الباقي على المتصفح)
  const links = LINKS.filter((l) => (isAdmin || l.staff) && (Platform.OS === 'web' || l.staff));
  const toDelete = (deletions ?? []).filter((r) => r.status === 'pending').length;

  return (
    <ScrollView contentContainerStyle={st.page}>
      {role.data === 'staff' ? <Badge label="حساب موظف — إدارة المباريات" tone="green" /> : null}
      {api.isDemo ? <Badge label="وضع تجريبي — لوحة التحكم مفتوحة للتجربة" tone="yellow" /> : null}
      <View style={st.stats}>
        <View style={st.stat}>
          <Text style={st.statValue}>{upcoming}</Text>
          <Text variant="small" style={{ color: c.muted }}>مباريات قادمة</Text>
        </View>
        {isAdmin ? (
          <>
            <View style={st.stat}>
              <Text style={[st.statValue, pending ? { color: c.warnText } : null]}>{pending}</Text>
              <Text variant="small" style={{ color: c.muted }}>اقتراحات بانتظارك</Text>
            </View>
            <View style={st.stat}>
              <Text style={[st.statValue, toDelete ? { color: c.danger } : null]}>{toDelete}</Text>
              <Text variant="small" style={{ color: c.muted }}>طلبات حذف</Text>
            </View>
          </>
        ) : null}
      </View>
      {links.map((l) => (
        <Pressable key={l.title} onPress={() => router.push(l.href)} style={st.link}>
          <View style={st.linkIcon}>
            <Ionicons name={l.icon} size={22} color={c.cta} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{l.title}</Text>
            <Text variant="small" style={{ color: c.muted }}>{l.hint}</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color={c.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 20, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 16, alignItems: 'center' },
  statValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 44, color: c.primary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 16 },
  linkIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.bandBg, alignItems: 'center', justifyContent: 'center' },
}));
