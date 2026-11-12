import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { MatchCard } from '../components/MatchCard';
import { Empty, ErrorText, Loading, Screen, Text } from '../components/ui';
import { api } from '../lib/api';
import { useAsync, useNow } from '../lib/session';

export default function MyMatches() {
  const { data, error, loading, reload } = useAsync(() => api.listMyMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const now = new Date(useNow()).toISOString();
  const upcoming = (data ?? []).filter((m) => m.ends_at > now).reverse();
  const past = (data ?? []).filter((m) => m.ends_at <= now);

  return (
    <Screen>
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="لم تنضم لأي مباراة بعد" hint="تصفح المباريات المفتوحة وانضم لإحداها." /> : null}
      {upcoming.length ? <Text variant="h2">القادمة</Text> : null}
      {upcoming.map((m) => <MatchCard key={m.id} match={m} />)}
      {past.length ? <Text variant="h2">السابقة</Text> : null}
      {past.map((m) => <MatchCard key={m.id} match={m} />)}
    </Screen>
  );
}
