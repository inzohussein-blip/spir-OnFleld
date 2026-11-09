import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Share, Switch, View } from 'react-native';
import { PlayerCardView } from '../../components/PlayerCardView';
import { PlayerStatsBlock } from '../../components/PlayerStatsBlock';
import { Badge, Button, Card, ListItem, Loading, Row, Screen, SectionTitle, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demo';
import { POSITION_LABEL } from '../../lib/format';
import { useAsync, useSession } from '../../lib/session';
import { fonts, useTheme } from '../../theme';

export default function Profile() {
  const router = useRouter();
  const { profile, signOut, refresh, userId } = useSession();
  const { colors: c, scheme, setMode } = useTheme();
  const { data: card, reload } = useAsync(() => (userId ? api.getPlayerCard(userId) : Promise.resolve(null)), [userId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    void reload();
  }, [refresh, reload]));
  if (!profile) return null;

  return (
    <Screen>
      <View style={{ backgroundColor: c.primary, borderRadius: 22, paddingVertical: 20, alignItems: 'center', gap: 10 }}>
        {card ? <PlayerCardView card={card} width={210} /> : <Loading />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 34, color: c.onPrimary }}>{profile.full_name}</Text>
        <Row style={{ justifyContent: 'center' }}>
          <Badge label={POSITION_LABEL[profile.preferred_position]} tone="yellow" />
          {profile.city ? <Badge label={profile.city} tone="gray" /> : null}
          <Badge label={`التزام ${Math.round(profile.reliability_score)}%`} tone="gray" />
        </Row>
      </View>

      <SectionTitle title="سجل مبارياتي" />
      {card ? <PlayerStatsBlock card={card} /> : null}
      <Button title="مبارياتي القادمة والسابقة" icon="calendar" variant="outline" onPress={() => router.push('/my-matches')} />

      <SectionTitle title="الإعدادات" />
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <ListItem icon="person-circle" title="تعديل المعلومات" subtitle="الاسم والمحافظة والمركز" onPress={() => router.push('/onboarding')} />
        <ListItem
          icon={scheme === 'dark' ? 'moon' : 'sunny'}
          title="الثيم"
          subtitle={scheme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          right={<Switch value={scheme === 'dark'} onValueChange={(v) => setMode(v ? 'dark' : 'light')} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
        />
        <ListItem icon="wallet" title="المحفظة" subtitle="قريباً — الدفع الإلكتروني وسجل العمليات" />
        <ListItem icon="notifications" title="الإشعارات" subtitle="قريباً — تذكير قبل المباراة وانضمام اللاعبين" />
        <ListItem
          icon="share-social"
          title="شارك التطبيق"
          subtitle="ادعُ أصدقاءك يلعبون وياك"
          onPress={() => Share.share({ message: '⚽ جرّب تطبيق بالملعب — احجز ساحتك، كمّل فريقك، والعب!' })}
        />
        <ListItem icon="information-circle" title="عن بالملعب" subtitle="منصة عراقية لحجز الساحات وتنظيم المباريات" />
      </Card>

      {api.isDemo ? (
        <Button title="إعادة البيانات التجريبية" icon="refresh" variant="ghost" onPress={async () => { await resetDemo(); await signOut(); }} />
      ) : null}
      <Button title="تسجيل الخروج" icon="log-out" variant="danger" onPress={signOut} />
    </Screen>
  );
}
