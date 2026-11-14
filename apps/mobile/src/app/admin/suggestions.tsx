import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, Empty, ErrorText, Loading, Row, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatHour, timeAgo } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import type { SuggestionStatus } from '../../lib/types';
import { fonts, useColors } from '../../theme';

const LABEL: Record<SuggestionStatus, string> = { pending: 'بالانتظار', scheduled: 'صارت مباراة', rejected: 'مرفوضة' };

export default function AdminSuggestions() {
  const router = useRouter();
  const c = useColors();
  const [tab, setTab] = useState<SuggestionStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const { data, loading, reload } = useAsync(() => api.adminListSuggestions(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const list = (data ?? []).filter((s) => s.status === tab);

  async function reject(id: string) {
    try {
      await api.adminSetSuggestionStatus(id, 'rejected');
      await reload();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <Segmented<SuggestionStatus>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'بالانتظار' },
          { value: 'scheduled', label: 'صارت مباراة' },
          { value: 'rejected', label: 'مرفوضة' },
        ]}
      />
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && list.length === 0 ? <Empty title="ماكو اقتراحات هنا" icon="bulb-outline" /> : null}
      {list.map((s) => (
        <View key={s.id} style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{s.venue_name ?? 'ملعب'}</Text>
            <Badge label={LABEL[s.status]} tone={s.status === 'pending' ? 'yellow' : s.status === 'scheduled' ? 'green' : 'gray'} />
          </Row>
          <Text variant="small" style={{ color: c.muted }}>
            {s.day} · {formatHour(s.hour)} · {formatFormat(s.players_per_side)} · من {s.player_name} · {timeAgo(s.created_at)}
          </Text>
          {s.note ? <Text style={{ lineHeight: 24 }}>{s.note}</Text> : null}
          {s.status === 'pending' ? (
            <Row style={{ flexWrap: 'nowrap' }}>
              <Button title="أنشئ مباراة منه" icon="add-circle-outline" onPress={() => router.push({ pathname: '/admin/new-match', params: { suggestion: s.id } })} style={{ flex: 1 }} />
              <Button title="رفض" variant="ghost" onPress={() => void reject(s.id)} style={{ flex: 1 }} />
            </Row>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
