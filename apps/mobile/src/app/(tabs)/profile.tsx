import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { Button, ErrorText, Halftone, ListGroup, ListRow, PageHeader, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatIQD, POSITION_LABEL } from '../../lib/format';
import { pickSquareImage } from '../../lib/pickImage';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { cardRadius, ctaShadow, fonts, radius, space, themed, type ThemeMode, type, useTheme, wideSpaces } from '../../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

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
  const router = useRouter();
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
  const value = (t: string) => <Text style={st.value}>{t}</Text>;
  const go = (href: Parameters<typeof router.push>[0]) => () => router.push(href);

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <PageHeader title="حسابي" />
        <View style={st.content}>
        {/* بطاقة اللاعب */}
        <View style={st.playerCard}>
          <Halftone rows={14} cols={12} />
          <View style={st.cardStripe} />
          <View style={st.cardStripeThin} />
          <View style={st.cardTop}>
            <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="تغيير الصورة الشخصية">
              <Avatar name={profile.full_name} url={profile.avatar_url} size={64} ring="rgba(255,255,255,0.7)" />
              <View style={st.camera}>
                <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={13} color={c.onCta} />
              </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={st.cardName} numberOfLines={1}>{wideSpaces(profile.full_name)}</Text>
              <Text style={st.cardMeta} numberOfLines={1}>
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
                  <Text style={st.idText}>ID {profile.public_id}</Text>
                  <Ionicons name="copy-outline" size={13} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
            <View style={st.rating} accessibilityLabel={`التقييم ${card?.overall ?? ''}`}>
              <Text style={st.ratingLabel}>التقييم</Text>
              <Text style={st.ratingValue}>{card?.overall ?? '—'}</Text>
            </View>
          </View>
          <View style={st.stats}>
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

        <ListGroup title="نشاطي">
          <ListRow icon="calendar-outline" title="مبارياتي" onPress={go('/my-matches')} />
          <ListRow icon="stats-chart-outline" title="الإحصائيات" onPress={go('/stats')} />
          <ListRow
            icon="people-outline"
            title="فريقي"
            onPress={go('/teams')}
            right={
              pending ? (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{pending}</Text>
                </View>
              ) : undefined
            }
          />
          <ListRow icon="wallet-outline" title="المحفظة" onPress={go('/wallet')} right={wallet.data ? value(formatIQD(wallet.data.balance)) : undefined} />
          <ListRow icon="gift-outline" title="ادعُ أصدقاءك" onPress={go('/invite')} right={value('مكافأة')} />
        </ListGroup>

        <ListGroup title="اكتشف">
          <ListRow icon="trophy-outline" title="البطولات" onPress={go('/tournaments')} />
          <ListRow icon="ribbon-outline" title="اختبارات الأندية" onPress={go('/trials')} />
          <ListRow icon="newspaper-outline" title="المنشورات" onPress={go('/posts')} />
          <ListRow icon="search-outline" title="اللاعبين" onPress={go('/players')} />
          <ListRow icon="bulb-outline" title="اقترح مباراة" onPress={go('/suggest')} />
          {showOwner ? <ListRow icon="business-outline" title="ملاعبي (صاحب الملعب)" onPress={go('/owner')} /> : null}
          {showAdmin ? <ListRow icon="speedometer-outline" title="لوحة التحكم (للإدارة)" onPress={go('/admin')} /> : null}
        </ListGroup>

        <ListGroup title="الإعدادات">
          <ListRow icon="contrast-outline" title="المظهر" right={<ThemePicker mode={mode} onChange={setMode} />} />
          <ListRow icon="person-outline" title="المعلومات الشخصية" onPress={go('/onboarding')} />
          <ListRow icon="chatbubbles-outline" title="الدعم الفني" onPress={go({ pathname: '/chat/[id]', params: { id: 'support' } })} />
          <ListRow icon="information-circle-outline" title="حول" onPress={go('/info')} right={value(`الإصدار ${APP_VERSION}`)} />
        </ListGroup>

        <ListGroup title="الحساب">
          <ListRow icon="log-out-outline" title="تسجيل الخروج" onPress={signOut} chevron={false} />
          <ListRow icon="trash-outline" title="طلب حذف الحساب" danger onPress={() => setConfirmDelete(true)} chevron={false} />
        </ListGroup>

        {confirmDelete ? (
          <View style={[st.card, { borderColor: c.danger }]}>
            <Text style={{ fontFamily: fonts.bold, color: c.danger }}>متأكد تريد تحذف حسابك؟</Text>
            <Text variant="muted" style={{ lineHeight: 24 }}>
              يوصل طلبك للإدارة، وينحذف حسابك خلال 30 يوم. راح تطلع من حسابك هسه، وإذا رجعت دخلت قبل الحذف، الطلب ينلغي تلقائياً.
            </Text>
            <ErrorText message={error} />
            <Row style={{ flexWrap: 'nowrap' }}>
              <Button title="دز الطلب" variant="danger" onPress={requestDeletion} style={{ flex: 1 }} />
              <Button title="إلغاء" variant="outline" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
            </Row>
          </View>
        ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.xl },
  card: { backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.lg },
  playerCard: { backgroundColor: c.bandBg, borderRadius: cardRadius + 2, padding: space.lg, gap: space.lg, overflow: 'hidden' },
  // شريطين أصفر مايلين — نفس رأس الأقسام
  cardStripe: { position: 'absolute', top: -20, bottom: -20, left: -40, width: 80, backgroundColor: c.cta, transform: [{ skewX: '-14deg' }] },
  cardStripeThin: { position: 'absolute', top: -20, bottom: -20, left: 56, width: 12, backgroundColor: c.cta, transform: [{ skewX: '-14deg' }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  camera: { position: 'absolute', bottom: -2, left: -2, width: 26, height: 26, borderRadius: 8, backgroundColor: c.cta, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 34, color: '#FFFFFF' },
  cardMeta: { ...type.caption, color: 'rgba(255,255,255,0.9)' },
  idPill: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, minHeight: 28, marginTop: 2 },
  idText: { ...type.micro, fontSize: 12, lineHeight: 20, color: '#FFFFFF', letterSpacing: 0.4 },
  // التقييم بشكل درع أبيض بظل كحلي
  rating: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md, alignItems: 'center', minWidth: 72, boxShadow: ctaShadow(c) },
  ratingValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: '#1A23C9' },
  ratingLabel: { ...type.micro, color: '#0B1033' },
  stats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius, paddingVertical: space.sm },
  statCell: { flex: 1, alignItems: 'center' },
  statSep: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.25)' },
  statValue: { ...type.title, fontSize: 18, lineHeight: 28, color: '#FFFFFF' },
  statLabel: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  value: { ...type.caption, color: c.muted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  picker: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 10, padding: 3 },
  pickOpt: { paddingHorizontal: 10, minHeight: 30, justifyContent: 'center', borderRadius: 8 },
  pickOn: { backgroundColor: c.cta },
  pickText: { ...type.micro, fontSize: 12, lineHeight: 20, color: c.muted },
  pickTextOn: { color: c.onCta },
}));
