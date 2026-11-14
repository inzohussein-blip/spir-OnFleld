import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Badge, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

const LINKS: { title: string; hint: string; icon: IconName; href: Href }[] = [
  { title: 'مباراة جديدة', hint: 'اختار الملعب والوقت وموعد فتح التسجيل', icon: 'add-circle-outline', href: '/admin/new-match' },
  { title: 'اقتراحات اللاعبين', hint: 'حوّل الاقتراح لمباراة بضغطة', icon: 'bulb-outline', href: '/admin/suggestions' },
  { title: 'الملاعب والصور', hint: 'ارفع صورة لكل ملعب', icon: 'images-outline', href: '/admin/venues' },
];

export default function AdminHome() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { data: suggestions, reload: reloadS } = useAsync(() => api.adminListSuggestions(), []);
  const { data: matches, reload: reloadM } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(
    useCallback(() => {
      void reloadS();
      void reloadM();
    }, [reloadS, reloadM]),
  );
  const pending = (suggestions ?? []).filter((s) => s.status === 'pending').length;
  const upcoming = (matches ?? []).length;

  return (
    <ScrollView contentContainerStyle={st.page}>
      {api.isDemo ? <Badge label="وضع تجريبي — لوحة التحكم مفتوحة للتجربة" tone="yellow" /> : null}
      <View style={st.stats}>
        <View style={st.stat}>
          <Text style={st.statValue}>{upcoming}</Text>
          <Text variant="small" style={{ color: c.muted }}>مباريات قادمة</Text>
        </View>
        <View style={st.stat}>
          <Text style={[st.statValue, pending ? { color: c.warnText } : null]}>{pending}</Text>
          <Text variant="small" style={{ color: c.muted }}>اقتراحات بانتظارك</Text>
        </View>
      </View>
      {LINKS.map((l) => (
        <Pressable key={l.title} onPress={() => router.push(l.href)} style={st.link}>
          <Ionicons name={l.icon} size={26} color={c.primary} />
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
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, alignItems: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 42, color: c.primary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18 },
}));
