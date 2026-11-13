import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { LeaderList } from '../components/LeaderList';
import { Pitch } from '../components/Pitch';
import { PlayerCardView } from '../components/PlayerCardView';
import { Card, Empty, Loading, Row, Screen, Segmented, SectionTitle, StatTile, Text } from '../components/ui';
import { api } from '../lib/api';
import { useAsync } from '../lib/session';
import { fonts, useColors } from '../theme';

type Tab = 'leaders' | 'xi' | 'potm';

export default function Stats() {
  const [tab, setTab] = useState<Tab>('leaders');
  return (
    <Screen>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'leaders', label: 'المتصدرون' },
          { value: 'xi', label: 'تشكيلة الشهر' },
          { value: 'potm', label: 'لاعب الشهر' },
        ]}
      />
      {tab === 'leaders' ? <Leaders /> : tab === 'xi' ? <TeamOfWeek /> : <PlayerOfMonth />}
    </Screen>
  );
}

function Leaders() {
  const router = useRouter();
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const { data, loading, reload } = useAsync(
    async () => {
      const [goals, assists, mvps, rating] = await Promise.all([
        api.getLeaderboard('goals', 5),
        api.getLeaderboard('assists', 5),
        api.getLeaderboard('mvps', 5),
        api.getLeaderboard('rating', 5),
      ]);
      return { goals, assists, mvps, rating };
    },
    [],
  );
  useFocusEffect(useCallback(() => void reload(), [reload]));
  if (loading && !data) return <Loading />;
  if (!data) return null;

  const block = (title: string, hint: string, rows: typeof data.goals, unit: string, decimals = 0) => (
    <View style={{ gap: 8 }}>
      <SectionTitle title={title} hint={hint} />
      <Card>{rows.length ? <LeaderList rows={rows} unit={unit} decimals={decimals} onPress={open} /> : <Text variant="muted">ماكو بيانات بعد</Text>}</Card>
    </View>
  );

  return (
    <>
      {block('الهدافون', 'أكثر اللاعبين تسجيلاً للأهداف', data.goals, 'هدف')}
      {block('صنّاع اللعب', 'أكثر اللاعبين صناعة للأهداف', data.assists, 'صناعة')}
      {block('رجل المباراة', 'أكثر اللاعبين فوزاً بتصويت أفضل لاعب', data.mvps, 'مرة')}
      {block('الأعلى تقييماً', 'حسب تقييمات زملائهم', data.rating, 'تقييم', 1)}
    </>
  );
}

function TeamOfWeek() {
  const { data, loading } = useAsync(() => api.getTeamOfWeek(), []);
  if (loading && !data) return <Loading />;
  if (!data || data.length < 5) return <Empty title="لم تكتمل تشكيلة الشهر" hint="تُختار تلقائياً من أفضل اللاعبين أداءً في مباريات الشهر." icon="people-outline" />;
  return (
    <>
      <SectionTitle title="تشكيلة الشهر" hint="4-3-3 + احتياطيان · حسب التقييم والأهداف والصناعة وجوائز رجل المباراة" />
      <Pitch lineup={data} />
    </>
  );
}

function PlayerOfMonth() {
  const c = useColors();
  const router = useRouter();
  const { data: card, loading } = useAsync(() => api.getPlayerOfMonth(), []);
  if (loading && !card) return <Loading />;
  if (!card) return <Empty title="لا يوجد لاعب للشهر بعد" icon="star-outline" />;
  return (
    <>
      <View style={{ backgroundColor: c.primary, borderRadius: 20, paddingVertical: 20, gap: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 38, color: c.accent }}>⭐ لاعب الشهر</Text>
        <PlayerCardView card={card} width={240} onPress={() => router.push({ pathname: '/player/[id]', params: { id: card.profile.id } })} />
      </View>
      <Row style={{ flexWrap: 'nowrap' }}>
        <StatTile label="أهداف" value={card.stats.goals} icon="football" />
        <StatTile label="صناعة" value={card.stats.assists} icon="git-merge" tone="blue" />
        <StatTile label="رجل المباراة" value={card.stats.mvps} icon="ribbon" tone="yellow" />
      </Row>
    </>
  );
}
