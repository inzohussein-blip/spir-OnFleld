import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { MatchRow } from '../../components/MatchRow';
import { Badge, Button, Empty, ErrorText, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatHour, formatIQD } from '../../lib/format';
import { useAsync, useNow } from '../../lib/session';
import { useMatchActions } from '../../lib/useMatchActions';
import { fonts, themed, useColors } from '../../theme';

/** صفحة الملعب: معلومات + مبارياته القادمة + اقتراح مباراة (الإنشاء من لوحة التحكم فقط) */
export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const now = useNow(30_000);
  const venue = useAsync(() => api.getVenue(id), [id], { cacheKey: 'venue' });
  const matches = useAsync(() => api.listOpenMatches(), [], { cacheKey: 'open-matches' });
  const { reload: reloadMatches } = matches;
  useFocusEffect(useCallback(() => void reloadMatches(), [reloadMatches]));
  const { join, busyId, error: actionError } = useMatchActions(reloadMatches);

  const v = venue.data;
  const here = (matches.data ?? []).filter((m) => m.venue_id === id);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={matches.refreshing} onRefresh={reloadMatches} tintColor={c.primary} colors={[c.primary]} />}
    >
      <Stack.Screen options={{ title: v?.name ?? 'الملعب' }} />
      <View style={st.hero}>
        {v?.photo_url ? (
          <Image source={{ uri: v.photo_url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={v.name} />
        ) : (
          <>
            <View style={st.heroHalf} />
            <View style={st.heroCircle} />
          </>
        )}
      </View>

      <View style={st.body}>
        <OfflineBanner show={venue.offline || matches.offline} />
        <ErrorText message={venue.error} />
        {v ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 34, flexShrink: 1 }}>{v.name}</Text>
              {v.is_verified ? <Badge label="✓ موثّق" /> : null}
            </Row>
            <Row>
              <Ionicons name="location-outline" size={18} color={c.primary} />
              <Text variant="muted">{v.city}{v.address ? ` · ${v.address}` : ''}</Text>
            </Row>
            {v.amenities.length ? <Row>{v.amenities.map((a) => <Badge key={a} label={a} tone="gray" />)}</Row> : null}
            {v.fields.map((f) => (
              <View key={f.id} style={st.field}>
                <Text style={{ fontFamily: fonts.bold }}>{f.name} · {formatFormat(f.players_per_side)}</Text>
                <Text variant="small" style={{ color: c.muted }}>
                  {f.surface ?? ''}{f.is_indoor ? ' · مغطى' : ' · مكشوف'} · {formatHour(f.open_hour)} – {formatHour(f.close_hour)} · {formatIQD(f.default_price)} بالساعة
                </Text>
              </View>
            ))}
          </>
        ) : venue.loading ? (
          <SkeletonList count={1} height={90} />
        ) : null}

        <Text style={{ fontFamily: fonts.bold, fontSize: 18, marginTop: 8 }}>مباريات هذا الملعب</Text>
        <ErrorText message={actionError} />
        {matches.loading && !matches.data ? <SkeletonList count={2} /> : null}
        {matches.data && here.length === 0 ? <Empty title="ماكو مباريات قادمة هنا" hint="تكدر تقترح مباراة على الإدارة" icon="calendar-outline" /> : null}
        {here.map((m, i) => (
          <MatchRow key={m.id} match={m} index={i + 1} now={now} busy={busyId === m.id} onAction={() => void join(m)} />
        ))}
        <Button title="اقترح مباراة بهذا الملعب" icon="bulb-outline" variant="outline" onPress={() => router.push({ pathname: '/suggest', params: { venue: id } })} />
      </View>
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  hero: { height: 200, backgroundColor: '#1C8B4A', overflow: 'hidden' },
  heroHalf: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  heroCircle: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)', top: 50, left: '50%', marginLeft: -49 },
  body: { padding: 16, gap: 12 },
  field: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 4 },
}));
