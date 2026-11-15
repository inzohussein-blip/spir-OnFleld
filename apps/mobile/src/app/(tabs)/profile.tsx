import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { Button, ErrorText, Row, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { formatIQD, POSITION_LABEL } from '../../lib/format';
import { pickSquareImage } from '../../lib/pickImage';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { fonts, themed, useColors, useTheme, type ThemeMode } from '../../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

/** مجموعة بعنوان صغير وصندوق واحد بيه الأسطر */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const st = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.groupTitle}>{title}</Text>
      <View style={st.box}>{children}</View>
    </View>
  );
}

/** سطر بأيقونة ملونة على اليمين */
function Item({ icon, title, href, onPress, right, last, danger }: { icon: IconName; title: string; href?: Href; onPress?: () => void; right?: ReactNode; last?: boolean; danger?: boolean }) {
  const st = useStyles();
  const c = useColors();
  const router = useRouter();
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  const content = (
    <>
      <View style={[st.icon, danger && { backgroundColor: c.dangerSoft }]}>
        <Ionicons name={icon} size={19} color={danger ? c.danger : c.primary} />
      </View>
      <Text style={[st.rowText, danger && { color: c.danger }]}>{title}</Text>
      {right}
      {press ? <Ionicons name="chevron-back" size={18} color={c.muted} /> : null}
    </>
  );
  // سطر بدون رابط (مثل المظهر) حاوية عادية حتى تبقى عناصره قابلة للّمس
  if (!press) return <View style={[st.row, !last && st.rowLine]}>{content}</View>;
  return (
    <Pressable onPress={press} style={({ pressed }) => [st.row, !last && st.rowLine, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={title}>
      {content}
    </Pressable>
  );
}

/** اختيار المظهر صغير بنفس السطر */
function ThemePicker({ mode, onChange }: { mode: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const st = useStyles();
  const opts: [ThemeMode, string][] = [['light', 'فاتح'], ['dark', 'داكن'], ['system', 'الجهاز']];
  return (
    <View style={st.picker} accessibilityRole="radiogroup">
      {opts.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[st.pickOpt, mode === v && st.pickOn]} accessibilityRole="radio" accessibilityState={{ checked: mode === v }} accessibilityLabel={label === 'الجهاز' ? 'حسب الجهاز' : label}>
          <Text style={[st.pickText, mode === v && st.pickTextOn]}>{label}</Text>
        </Pressable>
      ))}
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
  const wallet = useAsync(() => api.getWallet(), [userId]);
  const reloadInvites = invites.reload;
  const reloadWallet = wallet.reload;
  const showAdmin = Platform.OS === 'web' && admin.data === true;
  // صاحب الملعب (أو المدير) يشوف صفحة ملاعبه — على التلفون والويب
  const showOwner = profile?.role === 'owner' || admin.data === true;
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void reload();
      void reloadInvites();
      void reloadWallet();
    }, [refresh, reload, reloadInvites, reloadWallet]),
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
  const pending = invites.data?.length ?? 0;
  const muted = (t: string) => <Text style={{ color: c.muted, fontSize: 13 }}>{t}</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={[st.content, { paddingTop: insets.top + 14 }]}>
      <Text style={st.pageTitle}>حسابي</Text>

      {/* بطاقة اللاعب: أفقية ومختصرة */}
      <View style={st.card}>
        <View style={st.cardStripe} />
        <View style={st.cardTop}>
          <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="تغيير الصورة الشخصية">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={68} ring="rgba(255,255,255,0.65)" />
            <View style={st.camera}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={13} color={c.primary} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.cardName}>{profile.full_name}</Text>
            <Text style={st.cardMeta}>
              {POSITION_LABEL[profile.preferred_position]}
              {profile.city ? ` · ${profile.city}` : ''}
            </Text>
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
                <Ionicons name="copy-outline" size={12} color="#fff" />
                <Text style={st.idText}>ID: {profile.public_id}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={st.rating} accessibilityLabel={`التقييم ${card?.overall ?? ''}`}>
            <Text style={st.ratingValue}>{card?.overall ?? '—'}</Text>
            <Text style={st.ratingLabel}>التقييم</Text>
          </View>
        </View>
        <View style={st.statsStrip}>
          {(
            [
              ['مباريات', s?.matches],
              ['أهداف', s?.goals],
              ['فوز', s?.wins],
            ] as const
          ).map(([label, v], i) => (
            <View key={label} style={[st.statCell, i > 0 && st.statSep]}>
              <Text style={st.statValue}>{v ?? 0}</Text>
              <Text style={st.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Group title="نشاطي">
        <Item icon="calendar-outline" title="مبارياتي" href="/my-matches" />
        <Item icon="stats-chart-outline" title="الإحصائيات" href="/stats" />
        <Item
          icon="people-outline"
          title="فريقي"
          href="/teams"
          right={
            pending ? (
              <View style={st.badge}>
                <Text style={st.badgeText}>{pending}</Text>
              </View>
            ) : undefined
          }
        />
        <Item icon="wallet-outline" title="المحفظة" href="/wallet" right={wallet.data ? muted(formatIQD(wallet.data.balance)) : undefined} />
        <Item icon="gift-outline" title="ادعُ أصدقاءك" href="/invite" right={muted('مكافأة 🎁')} last />
      </Group>

      <Group title="اكتشف">
        <Item icon="trophy-outline" title="البطولات" href="/tournaments" />
        <Item icon="ribbon-outline" title="اختبارات الأندية" href="/trials" />
        <Item icon="newspaper-outline" title="المنشورات" href="/posts" />
        <Item icon="search-outline" title="اللاعبين" href="/players" />
        <Item icon="bulb-outline" title="اقترح مباراة" href="/suggest" last={!showAdmin && !showOwner} />
        {showOwner ? <Item icon="business-outline" title="ملاعبي (صاحب الملعب)" href="/owner" last={!showAdmin} /> : null}
        {showAdmin ? <Item icon="speedometer-outline" title="لوحة التحكم (للإدارة)" href="/admin" last /> : null}
      </Group>

      <Group title="الإعدادات">
        <Item icon="contrast-outline" title="المظهر" right={<ThemePicker mode={mode} onChange={setMode} />} />
        <Item icon="person-outline" title="المعلومات الشخصية" href="/onboarding" />
        <Item icon="chatbubbles-outline" title="الدعم الفني" href={{ pathname: '/chat/[id]', params: { id: 'support' } }} />
        <Item icon="information-circle-outline" title="حول" href="/info" right={muted(`الإصدار ${APP_VERSION}`)} last />
      </Group>

      <Group title="الحساب">
        <Item icon="log-out-outline" title="تسجيل الخروج" onPress={signOut} />
        <Item icon="trash-outline" title="طلب حذف الحساب" danger onPress={() => setConfirmDelete(true)} last />
      </Group>

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
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  content: { paddingHorizontal: 16, gap: 18, paddingBottom: 130 },
  pageTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 34 },
  card: { backgroundColor: c.primary, borderRadius: 24, padding: 16, gap: 14, overflow: 'hidden' },
  cardStripe: { position: 'absolute', width: 140, height: 360, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, left: 40, transform: [{ rotate: '25deg' }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  camera: { position: 'absolute', bottom: -2, left: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.primary },
  cardName: { color: '#fff', fontFamily: fonts.bold, fontSize: 19, lineHeight: 30 },
  cardMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  idPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginTop: 4 },
  idText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 20, letterSpacing: 0.4 },
  rating: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 62 },
  ratingValue: { color: c.primary, fontFamily: fonts.bold, fontSize: 24, lineHeight: 34 },
  ratingLabel: { color: c.primary, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 },
  statsStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 8 },
  statCell: { flex: 1, alignItems: 'center' },
  statSep: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.25)' },
  statValue: { color: '#fff', fontFamily: fonts.bold, fontSize: 19, lineHeight: 28 },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.muted, paddingHorizontal: 4 },
  box: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowText: { flex: 1, fontSize: 15.5 },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  picker: { flexDirection: 'row', backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 3 },
  pickOpt: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9 },
  pickOn: { backgroundColor: c.primary },
  pickText: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 20, color: c.muted },
  pickTextOn: { color: '#fff' },
}));
