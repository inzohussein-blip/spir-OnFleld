import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Card, Empty, Input, Loading, Screen } from '../components/ui';
import { LeaderList } from '../components/LeaderList';
import { api } from '../lib/api';
import { useAsync } from '../lib/session';

export default function Players() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data, loading } = useAsync(() => api.listPlayers(q), [q]);
  return (
    <Screen>
      <Input placeholder="ابحث باسم اللاعب…" value={q} onChangeText={setQ} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="لا يوجد لاعب بهذا الاسم" icon="search-outline" /> : null}
      {data?.length ? (
        <Card>
          <LeaderList
            rows={data.map((p) => ({ profile: p, value: p.skill_rating }))}
            unit="تقييم"
            decimals={1}
            onPress={(id) => router.push({ pathname: '/player/[id]', params: { id } })}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
