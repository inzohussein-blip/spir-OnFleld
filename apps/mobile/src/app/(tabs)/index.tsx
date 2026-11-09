import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { MatchCard } from '../../components/MatchCard';
import { Badge, Empty, ErrorText, Loading, Screen, SectionTitle, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync, useSession } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

const BANNERS: { title: string; body: string; icon: IconName; bg: string; href: Href }[] = [
  { title: 'دوري بالملعب', body: 'التسجيل مفتوح لبطولة الملعب الكامل — سجّل فريقك الآن', icon: 'trophy', bg: '#1E4FD8', href: '/tournaments' },
  { title: 'حجوزات الصباح', body: 'أسعار أقل للساعات قبل الـ 4 عصراً في الساحات المشاركة', icon: 'sunny', bg: '#B07A00', href: '/venues' },
  { title: 'ادعُ شلتك', body: 'أنشئ مباراة وشارك الرابط على واتساب ويكتمل العدد بسرعة', icon: 'people', bg: '#1E4E8C', href: '/venues' },
];

const SHORTCUTS: { label: string; hint: string; icon: IconName; href: Href }[] = [
  { label: 'حجز سريع', hint: 'احجز ساعة بثواني', icon: 'flash', href: '/venues' },
  { label: 'البطولات', hint: 'شارك وتابع', icon: 'trophy', href: '/tournaments' },
  { label: 'الإحصائيات', hint: 'المتصدرون والتشكيلة', icon: 'stats-chart', href: '/stats' },
  { label: 'مبارياتي', hint: 'القادمة والسابقة', icon: 'calendar', href: '/my-matches' },
];

export default function Home() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { width } = useWindowDimensions();
  const { profile } = useSession();
  const { data, error, loading, reload } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const bannerW = Math.min(width, 520) - 48;

  return (
    <Screen>
      <Text variant="title">هلا {profile?.full_name.split(' ')[0]} 👋</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={bannerW + 10} decelerationRate="fast" contentContainerStyle={{ gap: 10 }}>
        {BANNERS.map((b) => (
          <Pressable key={b.title} onPress={() => router.push(b.href)} style={[st.banner, { width: bannerW, backgroundColor: b.bg }]}>
            <View style={st.bannerCircle} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.bannerTitle}>{b.title}</Text>
              <Text style={st.bannerBody}>{b.body}</Text>
            </View>
            <Ionicons name={b.icon} size={44} color="rgba(255,255,255,0.9)" />
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle title="أقسام المباريات" hint="اختر نوع المباراة المناسب لك" />
      <Pressable onPress={() => router.push({ pathname: '/matches', params: { type: 'full' } })} style={[st.typeCard, { backgroundColor: '#1C8B4A' }]}>
        <PitchLines />
        <Badge label="ملعب كامل" tone="yellow" />
        <Text style={st.typeTitle}>11 ضد 11</Text>
        <Text style={st.typeBody}>مباريات الملعب الكامل والتشكيلات</Text>
        <View style={st.typeBtn}><Text style={st.typeBtnText}>استعرض المباريات</Text></View>
      </Pressable>
      <Pressable onPress={() => router.push({ pathname: '/matches', params: { type: 'small' } })} style={[st.typeCard, { backgroundColor: '#1E4FD8' }]}>
        <PitchLines />
        <Badge label="سريع" tone="green" />
        <Text style={st.typeTitle}>خماسي · سداسي · سباعي</Text>
        <Text style={st.typeBody}>مباريات سريعة بعدد أقل — انضم وكمّل العدد</Text>
        <View style={st.typeBtn}><Text style={st.typeBtnText}>استعرض المباريات</Text></View>
      </Pressable>

      <SectionTitle title="ليش بالملعب؟" hint="كل اللي تحتاجه لكرة القدم بمكان واحد" />
      <View style={st.grid}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s.label} onPress={() => router.push(s.href)} style={st.shortcut}>
            <View style={st.shortcutIcon}><Ionicons name={s.icon} size={22} color={c.primary} /></View>
            <Text style={{ fontFamily: fonts.bold }}>{s.label}</Text>
            <Text variant="small" style={{ color: c.muted }}>{s.hint}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle
        title="مباريات تحتاج لاعبين"
        hint="انضم بضغطة"
        action={<Pressable onPress={() => router.push('/matches')}><Text style={{ color: c.primary, fontFamily: fonts.semibold }}>عرض الكل</Text></Pressable>}
      />
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="لا توجد مباريات مفتوحة حالياً" hint="كن أول من ينشئ مباراة اليوم!" /> : null}
      {data?.slice(0, 3).map((m) => <MatchCard key={m.id} match={m} />)}
    </Screen>
  );
}

function PitchLines() {
  const st = useStyles();
  return (
    <>
      <View style={st.plHalf} />
      <View style={st.plCircle} />
      <View style={st.plBox} />
    </>
  );
}

const useStyles = themed((c) => ({
  banner: { height: 120, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  bannerCircle: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, left: -40 },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
  bannerBody: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  typeCard: { borderRadius: 18, padding: 16, gap: 4, overflow: 'hidden', minHeight: 150 },
  typeTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36, color: '#fff' },
  typeBody: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  typeBtn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 6 },
  typeBtnText: { fontFamily: fonts.bold, color: '#13201A', fontSize: 13 },
  plHalf: { position: 'absolute', top: 0, bottom: 0, left: '35%', width: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  plCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', top: '50%', marginTop: -40, left: '35%', marginLeft: -39 },
  plBox: { position: 'absolute', width: 50, top: '25%', bottom: '25%', left: 0, borderWidth: 2, borderLeftWidth: 0, borderColor: 'rgba(255,255,255,0.12)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { width: '48%', flexGrow: 1, backgroundColor: c.card, borderRadius: 16, padding: 14, gap: 2, borderWidth: 1, borderColor: c.border },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
}));
