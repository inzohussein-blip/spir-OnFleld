import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { MatchCard } from '../../components/MatchCard';
import { Button, Empty, ErrorText, Loading, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync, useSession } from '../../lib/session';

export default function Home() {
  const router = useRouter();
  const { profile } = useSession();
  const { data, error, loading, reload } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  return (
    <Screen>
      <Text variant="title">هلا {profile?.full_name.split(' ')[0]} 👋</Text>
      <Text variant="muted">مباريات قريبة تحتاج لاعبين — انضم بضغطة.</Text>
      <Button title="＋ أنشئ مباراة واحجز ساحة" onPress={() => router.push('/venues')} />
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="لا توجد مباريات مفتوحة حالياً" hint="كن أول من ينشئ مباراة اليوم!" /> : null}
      {data?.map((m) => <MatchCard key={m.id} match={m} />)}
    </Screen>
  );
}
