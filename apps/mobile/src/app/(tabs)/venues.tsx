import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { HeaderBand } from '../../components/HeaderBand';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { Empty, ErrorText, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { toWesternDigits } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

export default function Venues() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { data, error, loading, offline, refreshing, reload } = useAsync(() => api.listVenues(), [], { cacheKey: 'venues' });
  const [q, setQ] = useState('');

  const needle = q.trim();
  const list = (data ?? []).filter((v) => !needle || v.name.includes(needle) || (v.address ?? '').includes(needle) || v.city.includes(needle));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <HeaderBand title="الملاعب" />
      <ScrollView
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
      >
        <View style={st.search}>
          <Ionicons name="search" size={24} color={c.primary} />
          <TextInput
            value={q}
            onChangeText={(v) => setQ(toWesternDigits(v))}
            placeholder="البحث عن الملاعب"
            placeholderTextColor={c.muted}
            style={st.input}
            returnKeyType="search"
          />
          {q ? <Ionicons name="close-circle" size={20} color={c.muted} onPress={() => setQ('')} /> : null}
        </View>

        <OfflineBanner show={offline} />
        <ErrorText message={error} />
        {loading && !data ? <SkeletonList count={3} height={120} /> : null}
        {data && list.length === 0 ? <Empty title="ماكو ملعب بهذا الاسم" icon="search-outline" /> : null}

        {list.map((v) => {
          const capacity = Math.max(...v.fields.map((f) => f.players_per_side * 2));
          return (
            <Pressable key={v.id} onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })} style={st.card}>
              <View style={st.thumb}>
                {v.photo_url ? (
                  <Image source={{ uri: v.photo_url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={v.name} />
                ) : (
                  <>
                    <View style={st.thumbLine} />
                    <View style={st.thumbCircle} />
                  </>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={st.name} numberOfLines={2}>{v.name}</Text>
                <View style={st.addr}>
                  <Ionicons name="location-outline" size={16} color={c.primary} />
                  <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{v.address ?? v.city}</Text>
                </View>
                <View style={st.cap}>
                  <Ionicons name="people-outline" size={18} color={c.primary} />
                  <Text variant="small" style={{ color: c.muted }}>{Number.isFinite(capacity) ? capacity : '-'}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16 },
  input: { flex: 1, minHeight: 56, fontFamily: fonts.regular, fontSize: 16, color: c.text, outlineWidth: 0 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: c.card, borderRadius: 26, borderWidth: 1, borderColor: c.border, padding: 16 },
  thumb: { width: 104, height: 88, borderRadius: 14, backgroundColor: '#1C8B4A', overflow: 'hidden' },
  thumbLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  thumbCircle: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', top: 27, left: 35 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: c.border },
  cap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
