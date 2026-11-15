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

/** «ملعب واحد / ملعبين / 4 ملاعب / 12 ملعب» مسجّلة */
function venuesCount(n: number) {
  if (n === 1) return 'ملعب واحد مسجّل';
  if (n === 2) return 'ملعبين مسجّلين';
  return n >= 3 && n <= 10 ? `${n} ملاعب مسجّلة` : `${n} ملعب مسجّل`;
}

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
      <HeaderBand title="الملاعب" subtitle={data ? venuesCount(data.length) : undefined} />
      <ScrollView
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
      >
        <View style={st.search}>
          <Ionicons name="search" size={22} color={c.primary} />
          <TextInput
            value={q}
            onChangeText={(v) => setQ(toWesternDigits(v))}
            placeholder="ابحث عن ملعب أو منطقة"
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
            <Pressable key={v.id} onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })} style={st.card} accessibilityRole="button" accessibilityLabel={v.name}>
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
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={st.name} numberOfLines={1}>{v.name}</Text>
                <View style={st.line}>
                  <Ionicons name="location-outline" size={15} color={c.muted} />
                  <Text variant="small" numberOfLines={1} style={{ flexShrink: 1, color: c.muted }}>{v.address ?? v.city}</Text>
                </View>
                {Number.isFinite(capacity) ? (
                  <View style={st.line}>
                    <Ionicons name="people-outline" size={15} color={c.muted} />
                    <Text variant="small" style={{ color: c.muted }}>حتى {capacity} لاعب</Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-back" size={20} color={c.muted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 10, paddingBottom: 120 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 50, fontFamily: fonts.regular, fontSize: 16, color: c.text, outlineWidth: 0 },
  // نفس شكل بطاقة المباراة: زوايا 22، إطار رفيع، صورة الساحة 16
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 10, paddingEnd: 12 },
  thumb: { width: 88, height: 68, borderRadius: 16, backgroundColor: '#1C8B4A', overflow: 'hidden' },
  thumbLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  thumbCircle: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', top: 20, left: 30 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
}));
