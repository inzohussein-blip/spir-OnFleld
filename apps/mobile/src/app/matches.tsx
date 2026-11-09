import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { MatchCard } from '../components/MatchCard';
import { Button, Empty, ErrorText, Loading, Screen, Segmented } from '../components/ui';
import { api } from '../lib/api';
import { useAsync } from '../lib/session';

type Kind = 'all' | 'small' | 'full';

export default function MatchesList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: Kind }>();
  const [kind, setKind] = useState<Kind>(params.type === 'full' || params.type === 'small' ? params.type : 'all');
  const { data, error, loading, reload } = useAsync(() => api.listOpenMatches(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const list = (data ?? []).filter((m) => kind === 'all' || (kind === 'full' ? m.players_per_side >= 9 : m.players_per_side < 9));

  return (
    <Screen>
      <Stack.Screen options={{ title: kind === 'full' ? 'مباريات الملعب الكامل' : kind === 'small' ? 'المباريات السريعة' : 'المباريات المفتوحة' }} />
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'small', label: 'سريعة', icon: 'flash' },
          { value: 'full', label: '11 ضد 11', icon: 'football' },
        ]}
      />
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && list.length === 0 ? <Empty title="لا توجد مباريات من هذا النوع حالياً" hint="أنشئ مباراة جديدة واحجز ساحة." /> : null}
      {list.map((m) => <MatchCard key={m.id} match={m} />)}
      <Button title="أنشئ مباراة واحجز ساحة" icon="add-circle" variant="outline" onPress={() => router.push('/venues')} />
    </Screen>
  );
}
