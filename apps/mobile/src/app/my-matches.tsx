import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { OfflineBanner, SkeletonList } from '../components/feedback';
import { MatchRow } from '../components/MatchRow';
import { Button, Empty, ErrorText, Text } from '../components/ui';
import { api } from '../lib/api';
import { useAsync, useNow } from '../lib/session';
import { useMatchActions } from '../lib/useMatchActions';
import { useColors } from '../theme';

/** مبارياتي — نفس بطاقة الرئيسية حتى يكون التطبيق كله بشكل واحد */
export default function MyMatches() {
  const router = useRouter();
  const c = useColors();
  const { data, error, offline, loading, refreshing, reload } = useAsync(() => api.listMyMatches(), [], { cacheKey: 'my-matches' });
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const { join, busyId, error: actionError } = useMatchActions(reload);
  const now = useNow(30_000);

  const nowIso = new Date(now).toISOString();
  const upcoming = (data ?? []).filter((m) => m.ends_at > nowIso).reverse();
  const past = (data ?? []).filter((m) => m.ends_at <= nowIso);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
    >
      <OfflineBanner show={offline} />
      <ErrorText message={error ?? actionError} />
      {loading && !data ? <SkeletonList count={2} /> : null}
      {data && data.length === 0 ? (
        <>
          <Empty title="بعدك ما انضميت لأي مباراة" hint="اختار مباراة من الرئيسية وانضم بضغطة" icon="football-outline" />
          <Button title="شوف المباريات" icon="home-outline" variant="outline" onPress={() => router.replace('/')} />
        </>
      ) : null}
      {upcoming.length ? <Text variant="h2">القادمة</Text> : null}
      {upcoming.map((m, i) => (
        <MatchRow key={m.id} match={m} index={i + 1} now={now} busy={busyId === m.id} onAction={() => void join(m)} />
      ))}
      {past.length ? <Text variant="h2">السابقة</Text> : null}
      {past.map((m, i) => (
        <MatchRow key={m.id} match={m} index={i + 1} now={now} onAction={() => {}} />
      ))}
    </ScrollView>
  );
}
