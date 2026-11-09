import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Share, Switch, View } from 'react-native';
import { PlayerCardView } from '../components/PlayerCardView';
import { PlayerStatsBlock } from '../components/PlayerStatsBlock';
import { Badge, Button, Card, ErrorText, ListItem, Loading, Row, Screen, SectionTitle, Text, type IconName } from '../components/ui';
import { CONTACT } from '../config';
import { api } from '../lib/api';
import { resetDemo } from '../lib/api/demo';
import { POSITION_LABEL } from '../lib/format';
import { errMsg, useAsync, useSession } from '../lib/session';
import { fonts, useTheme } from '../theme';

const SOCIAL: { key: keyof typeof CONTACT; label: string; icon: IconName; color: string }[] = [
  { key: 'whatsapp', label: 'واتساب', icon: 'logo-whatsapp', color: '#25D366' },
  { key: 'instagram', label: 'انستغرام', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'facebook', label: 'فيسبوك', icon: 'logo-facebook', color: '#1877F2' },
];

export default function Profile() {
  const router = useRouter();
  const { profile, signOut, refresh, userId } = useSession();
  const { colors: c, scheme, setMode } = useTheme();
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
    <Screen>
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
      <Button title="مبارياتي القادمة والسابقة" icon="calendar" variant="outline" onPress={() => router.push('/my-matches')} />

      <SectionTitle title="الإعدادات" />
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <ListItem icon="person-circle" title="تعديل المعلومات" subtitle="الاسم والمحافظة والمركز" onPress={() => router.push('/onboarding')} />
        <ListItem icon="wallet" title="المحفظة" subtitle="رصيدك ومكافآتك وسجل العمليات" onPress={() => router.push('/wallet')} />
        <ListItem icon="people" title="اللاعبين" subtitle="كل اللاعبين وإحصائياتهم" onPress={() => router.push('/players')} />
        <ListItem icon="location" title="الساحات" subtitle="تصفح الساحات واحجز" onPress={() => router.push('/venues')} />
        <ListItem
          icon={scheme === 'dark' ? 'moon' : 'sunny'}
          title="الثيم"
          subtitle={scheme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          right={<Switch value={scheme === 'dark'} onValueChange={(v) => setMode(v ? 'dark' : 'light')} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
        />
        <ListItem
          icon="share-social"
          title="شارك التطبيق"
          subtitle="ادعُ أصدقاءك يلعبون وياك"
          onPress={() => Share.share({ message: '⚽ جرّب تطبيق بالملعب — احجز ساحتك، كمّل فريقك، والعب!' })}
        />
        <ListItem icon="information-circle" title="من نحن" subtitle="تعرّف على بالملعب" />
      </Card>

      <SectionTitle title="تواصل معنا" />
      {social.length ? (
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
      ) : (
        <Card>
          <Text variant="muted">راسل الإدارة مباشرة من المحادثات.</Text>
          <Button title="محادثة الإدارة" icon="headset" variant="outline" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: 'support' } })} />
        </Card>
      )}

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
    </Screen>
  );
}
