import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { pickSquareImage } from '../../lib/pickImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demo';
import { POSITION_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { fonts, themed, useColors, useTheme } from '../../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

/** صندوق بإطار يحتوي صفوفاً مفصولة بخطوط — بسيط وواضح */
function Box({ children }: { children: ReactNode }) {
  const st = useStyles();
  return <View style={st.box}>{children}</View>;
}

function RowLink({ title, href, onPress, right, last, danger }: { title: string; href?: Href; onPress?: () => void; right?: ReactNode; last?: boolean; danger?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const router = useRouter();
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  const content = (
    <>
      <Text style={[st.rowText, danger && { color: c.danger }]}>{title}</Text>
      {right ?? (press ? <Ionicons name="chevron-back" size={20} color={c.muted} /> : null)}
    </>
  );
  // صف بدون رابط (مثل مفتاح الوضع الداكن) يكون حاوية عادية حتى تبقى عناصره قابلة للّمس
  if (!press) return <View style={[st.row, !last && st.rowLine]}>{content}</View>;
  return (
    <Pressable onPress={press} style={({ pressed }) => [st.row, !last && st.rowLine, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const st = useStyles();
  return (
    <View style={{ gap: 10 }}>
      <Text style={st.section}>{title}</Text>
      {children}
    </View>
  );
}

export default function Profile() {
  const { profile, signOut, refresh, userId } = useSession();
  const { colors: c, scheme, setMode } = useTheme();
  const st = useStyles();
  const insets = useSafeAreaInsets();
  const { data: card, reload } = useAsync(() => (userId ? api.getPlayerCard(userId) : Promise.resolve(null)), [userId]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const admin = useAsync(() => api.isAdmin(), [userId]);
  const showAdmin = Platform.OS === 'web' && admin.data === true;
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void reload();
    }, [refresh, reload]),
  );
  if (!profile) return null;

  async function changePhoto() {
    try {
      const uri = await pickSquareImage();
      if (!uri) return;
      setUploading(true);
      await api.uploadAvatar(uri);
      await refresh();
      toast('تحدّثت صورتك ✓');
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  async function deleteAccount() {
    try {
      await api.deleteAccount();
      await signOut();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const s = card?.stats;
  const stat = (label: string, value: number | undefined) => (
    <View style={st.statRow}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value ?? 0}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={[st.content, { paddingTop: insets.top + 20 }]}>
      {/* بطاقة اللاعب */}
      <View style={st.card}>
        <View style={st.cardStripe} />
        <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="تغيير الصورة الشخصية">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={110} ring="rgba(255,255,255,0.6)" />
          <View style={st.camera}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={16} color={c.primary} />
          </View>
        </Pressable>
        <Row style={{ justifyContent: 'center', gap: 10 }}>
          <Text style={st.cardMeta}>{POSITION_LABEL[profile.preferred_position]}</Text>
          <Text style={st.cardMeta}>{card?.overall ?? '—'}</Text>
        </Row>
        <Text style={st.cardName}>{profile.full_name}</Text>
        <View style={st.cardDivider} />
        <View style={st.statsGrid}>
          <View style={{ flex: 1, gap: 4 }}>
            {stat('الأهداف', s?.goals)}
            {stat('المباريات', s?.matches)}
            {stat('الصناعة', s?.assists)}
          </View>
          <View style={st.statsSep} />
          <View style={{ flex: 1, gap: 4 }}>
            {stat('الفوز', s?.wins)}
            {stat('الخسارة', s?.losses)}
            {stat('رجل المباراة', s?.mvps)}
          </View>
        </View>
      </View>

      <Section title="المحفظة">
        <Box>
          <RowLink title="معلومات المحفظة" href="/wallet" last />
        </Box>
      </Section>

      <Section title="البيانات الشخصية">
        <Box>
          <RowLink title="المعلومات الشخصية" href="/onboarding" />
          <RowLink title="مبارياتي" href="/my-matches" />
          <RowLink title="الإحصائيات" href="/stats" last />
        </Box>
      </Section>

      <Section title="المزيد">
        <Box>
          <RowLink title="البطولات" href="/tournaments" />
          <RowLink title="اختبارات الأندية" href="/trials" />
          <RowLink title="المنشورات" href="/posts" />
          <RowLink title="اللاعبين" href="/players" />
          <RowLink title="اقترح مباراة" href="/suggest" last={!showAdmin} />
          {showAdmin ? <RowLink title="لوحة التحكم (للإدارة)" href="/admin" last /> : null}
        </Box>
      </Section>

      <Box>
        <RowLink
          title="الوضع الداكن"
          right={<Switch value={scheme === 'dark'} onValueChange={(v) => setMode(v ? 'dark' : 'light')} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
          last
        />
      </Box>

      <Box>
        <RowLink title="عن بالملعب" href={{ pathname: '/info', params: { doc: 'about' } }} />
        <RowLink title="الدعم الفني" href={{ pathname: '/chat/[id]', params: { id: 'support' } }} />
        <RowLink title="الشروط والأحكام" href={{ pathname: '/info', params: { doc: 'terms' } }} />
        <RowLink title="سياسة الخصوصية" href={{ pathname: '/info', params: { doc: 'privacy' } }} last />
      </Box>

      <Box>
        <RowLink title="تسجيل الخروج" onPress={signOut} />
        {api.isDemo ? <RowLink title="إعادة البيانات التجريبية" onPress={async () => { await resetDemo(); await signOut(); }} /> : null}
        <RowLink title="حذف الحساب" danger onPress={() => setConfirmDelete(true)} />
        <RowLink title="رقم الإصدار" right={<Text style={{ color: c.muted }}>{APP_VERSION}</Text>} last />
      </Box>

      {confirmDelete ? (
        <View style={[st.box, { padding: 16, gap: 10, borderColor: c.danger }]}>
          <Text style={{ fontFamily: fonts.bold, color: c.danger }}>متأكد تريد تحذف حسابك؟</Text>
          <Text variant="muted">يُحذف ملفك وبيانات دخولك نهائياً. نتائج المباريات السابقة تبقى باسم «حساب محذوف».</Text>
          <ErrorText message={error} />
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button title="نعم، احذف" variant="danger" onPress={deleteAccount} style={{ flex: 1 }} />
            <Button title="إلغاء" variant="ghost" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  content: { paddingHorizontal: 16, gap: 22, paddingBottom: 130 },
  card: { alignSelf: 'center', width: 300, backgroundColor: c.primary, borderRadius: 30, paddingTop: 22, paddingBottom: 18, paddingHorizontal: 18, alignItems: 'center', gap: 6, overflow: 'hidden' },
  cardStripe: { position: 'absolute', width: 140, height: 420, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, left: 170, transform: [{ rotate: '25deg' }] },
  camera: { position: 'absolute', bottom: 2, left: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.primary },
  cardMeta: { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
  cardName: { color: '#fff', fontFamily: fonts.bold, fontSize: 20, lineHeight: 30 },
  cardDivider: { height: 2, width: '80%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 1, marginVertical: 4 },
  statsGrid: { flexDirection: 'row', alignSelf: 'stretch', gap: 12 },
  statsSep: { width: 2, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  statValue: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  section: { fontFamily: fonts.bold, fontSize: 18 },
  box: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowText: { fontSize: 16 },
}));
