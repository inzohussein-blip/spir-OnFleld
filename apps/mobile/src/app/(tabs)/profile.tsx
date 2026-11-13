import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Share, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerCardView } from '../../components/PlayerCardView';
import { PlayerStatsBlock } from '../../components/PlayerStatsBlock';
import { Badge, Button, Card, ErrorText, ListItem, Loading, Row, Screen, SectionTitle, Text, type IconName } from '../../components/ui';
import { CONTACT } from '../../config';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demo';
import { POSITION_LABEL } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import Constants from 'expo-constants';
import { fonts, themed, useTheme } from '../../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

const SOCIAL: { key: keyof typeof CONTACT; label: string; icon: IconName; color: string }[] = [
  { key: 'whatsapp', label: 'واتساب', icon: 'logo-whatsapp', color: '#25D366' },
  { key: 'instagram', label: 'انستغرام', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'facebook', label: 'فيسبوك', icon: 'logo-facebook', color: '#1877F2' },
];

export default function Profile() {
  const router = useRouter();
  const { profile, signOut, refresh, userId } = useSession();
  const { colors: c, scheme, setMode } = useTheme();
  const st = useStyles();
  const insets = useSafeAreaInsets();
  const { data: card, reload } = useAsync(() => (userId ? api.getPlayerCard(userId) : Promise.resolve(null)), [userId]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    void refresh();
    void reload();
  }, [refresh, reload]));
  if (!profile) return null;

  const social = SOCIAL.filter((s) => CONTACT[s.key]);

  async function deleteAccount() {
    try {
      await api.deleteAccount();
      await signOut();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <Screen style={{ paddingTop: insets.top + 16 }}>
      <View style={{ backgroundColor: c.primary, borderRadius: 24, paddingVertical: 20, alignItems: 'center', gap: 10 }}>
        {card ? (
          <Row style={{ flexWrap: 'nowrap', justifyContent: 'center', gap: 12 }}>
            <PlayerCardView card={card} width={150} mode="arcade" />
            <PlayerCardView card={card} width={150} />
          </Row>
        ) : (
          <Loading />
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 34, color: c.onPrimary }}>{profile.full_name}</Text>
        <Row style={{ justifyContent: 'center' }}>
          {card ? <Badge label={`التقييم ${card.overall}`} tone="yellow" /> : null}
          <Badge label={POSITION_LABEL[profile.preferred_position]} tone="gray" />
          {profile.city ? <Badge label={profile.city} tone="gray" /> : null}
        </Row>
      </View>

      <SectionTitle title="سجل مبارياتي" />
      {card ? <PlayerStatsBlock card={card} /> : null}

      <SectionTitle title="المحفظة" />
      <Card style={st.group}>
        <ListItem icon="wallet-outline" title="معلومات المحفظة" subtitle="رصيدك ومكافآتك وسجل العمليات" onPress={() => router.push('/wallet')} />
      </Card>

      <SectionTitle title="البيانات الشخصية" />
      <Card style={st.group}>
        <ListItem icon="person-circle-outline" title="المعلومات الشخصية" subtitle="الاسم والمحافظة والمركز" onPress={() => router.push('/onboarding')} />
        <ListItem icon="calendar-outline" title="مبارياتي" subtitle="القادمة والسابقة" onPress={() => router.push('/my-matches')} />
        <ListItem icon="people-outline" title="اللاعبين" subtitle="كل اللاعبين وإحصائياتهم" onPress={() => router.push('/players')} />
      </Card>

      <SectionTitle title="المظهر والأمان" />
      <Card style={st.group}>
        <ListItem
          icon={scheme === 'dark' ? 'moon' : 'sunny'}
          title="الثيم"
          subtitle={scheme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          right={<Switch value={scheme === 'dark'} onValueChange={(v) => setMode(v ? 'dark' : 'light')} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
        />
        <ListItem icon="shield-checkmark-outline" title="الدخول الآمن" subtitle="برقم الهاتف ورمز تحقق — بدون كلمة مرور" />
      </Card>

      <SectionTitle title="عن التطبيق" />
      <Card style={st.group}>
        <ListItem icon="information-circle-outline" title="عن بالملعب" onPress={() => router.push({ pathname: '/info', params: { doc: 'about' } })} />
        <ListItem icon="headset-outline" title="الدعم الفني" subtitle="محادثة مباشرة مع الإدارة" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: 'support' } })} />
        <ListItem icon="document-text-outline" title="الشروط والأحكام" onPress={() => router.push({ pathname: '/info', params: { doc: 'terms' } })} />
        <ListItem icon="lock-closed-outline" title="سياسة الخصوصية" onPress={() => router.push({ pathname: '/info', params: { doc: 'privacy' } })} />
        <ListItem icon="share-social-outline" title="شارك التطبيق" onPress={() => Share.share({ message: '⚽ جرّب تطبيق بالملعب — احجز ساحتك، كمّل فريقك، والعب!' })} />
      </Card>

      {social.length ? (
        <>
          <SectionTitle title="تواصل معنا" />
          <Row style={{ flexWrap: 'nowrap' }}>
            {social.map((s) => (
              <Pressable key={s.key} onPress={() => Linking.openURL(CONTACT[s.key])} style={{ flex: 1, alignItems: 'center', gap: 6, backgroundColor: c.card, borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: c.border }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={s.icon} size={24} color="#fff" />
                </View>
                <Text variant="small" style={{ fontFamily: fonts.semibold }}>{s.label}</Text>
              </Pressable>
            ))}
          </Row>
        </>
      ) : null}

      {api.isDemo ? (
        <Button title="إعادة البيانات التجريبية" icon="refresh" variant="ghost" onPress={async () => { await resetDemo(); await signOut(); }} />
      ) : null}
      <Button title="تسجيل الخروج" icon="log-out" variant="outline" onPress={signOut} />
      {confirmDelete ? (
        <Card style={{ borderColor: c.danger }}>
          <Text style={{ fontFamily: fonts.bold, color: c.danger }}>متأكد تريد تحذف حسابك؟</Text>
          <Text variant="muted">يُحذف ملفك وبيانات دخولك نهائياً. نتائج المباريات السابقة تبقى باسم «حساب محذوف».</Text>
          <ErrorText message={error} />
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button title="نعم، احذف" variant="danger" onPress={deleteAccount} style={{ flex: 1 }} />
            <Button title="إلغاء" variant="ghost" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : (
        <Button title="حذف الحساب" icon="trash" variant="danger" onPress={() => setConfirmDelete(true)} />
      )}
      <Text variant="small" style={{ color: c.muted, textAlign: 'center' }}>رقم الإصدار {APP_VERSION}</Text>
    </Screen>
  );
}

const useStyles = themed(() => ({
  group: { gap: 0, paddingVertical: 4 },
}));
