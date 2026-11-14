import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { pickSquareImage } from '../../lib/pickImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Row, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
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
  const { colors: c, mode, setMode } = useTheme();
  const st = useStyles();
  const insets = useSafeAreaInsets();
  const { data: card, reload } = useAsync(() => (userId ? api.getPlayerCard(userId) : Promise.resolve(null)), [userId]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const admin = useAsync(() => api.isAdmin(), [userId]);
  const invites = useAsync(() => api.listTeamInvites(), [userId]);
  const reloadInvites = invites.reload;
  const showAdmin = Platform.OS === 'web' && admin.data === true;
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void reload();
      void reloadInvites();
    }, [refresh, reload, reloadInvites]),
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

  async function requestDeletion() {
    try {
      await api.requestAccountDeletion();
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
        {profile.public_id ? (
          <Pressable
            style={st.idPill}
            onPress={async () => {
              await Clipboard.setStringAsync(profile.public_id ?? '');
              toast('انسخ رقمك ✓ دزّه لأصدقائك حتى يضيفوك لفرقهم');
            }}
            accessibilityRole="button"
            accessibilityLabel={`رقمك ${profile.public_id} — اضغط للنسخ`}
          >
            <Text style={st.idText}>ID: {profile.public_id}</Text>
            <Ionicons name="copy-outline" size={14} color="#fff" />
          </Pressable>
        ) : null}
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
          <RowLink title="الإحصائيات" href="/stats" />
          <RowLink
            title="فريقي"
            href="/teams"
            last
            right={
              invites.data?.length ? (
                <Row style={{ gap: 6 }}>
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{invites.data.length}</Text>
                  </View>
                  <Ionicons name="chevron-back" size={20} color={c.muted} />
                </Row>
              ) : undefined
            }
          />
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
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={st.rowText}>المظهر</Text>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'فاتح', icon: 'sunny-outline' },
              { value: 'dark', label: 'داكن', icon: 'moon-outline' },
              { value: 'system', label: 'حسب الجهاز', icon: 'phone-portrait-outline' },
            ]}
          />
        </View>
      </Box>

      <Box>
        <RowLink title="الدعم الفني" href={{ pathname: '/chat/[id]', params: { id: 'support' } }} last />
      </Box>

      <Box>
        <RowLink title="تسجيل الخروج" onPress={signOut} />
        <RowLink title="طلب حذف الحساب" danger onPress={() => setConfirmDelete(true)} last />
      </Box>

      {confirmDelete ? (
        <View style={[st.box, { padding: 16, gap: 10, borderColor: c.danger }]}>
          <Text style={{ fontFamily: fonts.bold, color: c.danger }}>متأكد تريد تحذف حسابك؟</Text>
          <Text variant="muted" style={{ lineHeight: 24 }}>
            يوصل طلبك للإدارة، وينحذف حسابك خلال 30 يوم. راح تطلع من حسابك هسه، وإذا رجعت دخلت قبل الحذف، الطلب ينلغي تلقائياً.
          </Text>
          <ErrorText message={error} />
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button title="دز الطلب" variant="danger" onPress={requestDeletion} style={{ flex: 1 }} />
            <Button title="إلغاء" variant="ghost" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}

      <Box>
        <RowLink
          title="حول"
          href="/info"
          last
          right={
            <Row style={{ gap: 6 }}>
              <Text style={{ color: c.muted }}>الإصدار {APP_VERSION}</Text>
              <Ionicons name="chevron-back" size={20} color={c.muted} />
            </Row>
          }
        />
      </Box>
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
  idPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  idText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, letterSpacing: 0.5 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
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
