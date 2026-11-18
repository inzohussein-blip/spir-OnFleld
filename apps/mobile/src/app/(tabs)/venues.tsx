import { Ionicons } from '@expo/vector-icons';
import { PullRefreshScroll } from '../../components/PullRefreshScroll';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { OfflineBanner, SkeletonList } from '../../components/feedback';
import { Empty, ErrorText, PageHeader, SearchField, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { toggleFavoriteVenue, useFavoriteVenues } from '../../lib/favorites';
import { useAsync } from '../../lib/session';
import { cardRadius, radius, space, themed, type, useColors } from '../../theme';

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
  const { data, error, loading, offline, reload } = useAsync(() => api.listVenues(), [], { cacheKey: 'venues' });
  const [q, setQ] = useState('');
  const favs = useFavoriteVenues();

  const needle = q.trim();
  const list = (data ?? []).filter((v) => !needle || v.name.includes(needle) || (v.address ?? '').includes(needle) || v.city.includes(needle));

  return (
    <View style={st.screen}>
      <PullRefreshScroll
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        onRefresh={reload}
      >
        <PageHeader title="الملاعب" subtitle={data ? venuesCount(data.length) : undefined} />
        <View style={st.body}>
        <SearchField value={q} onChange={setQ} placeholder="ابحث عن ملعب أو منطقة" />

        <OfflineBanner show={offline} />
        <ErrorText message={error} />
        {loading && !data ? <SkeletonList count={3} height={96} /> : null}
        {data && list.length === 0 ? <Empty title="ماكو ملعب بهذا الاسم" icon="search-outline" /> : null}

        {list.map((v) => {
          const capacity = Math.max(...v.fields.map((f) => f.players_per_side * 2));
          const fav = favs.has(v.id);
          return (
            <Pressable
              key={v.id}
              onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })}
              style={({ pressed }) => [st.card, pressed && { backgroundColor: c.cardAlt }]}
              accessibilityRole="button"
              accessibilityLabel={v.name}
            >
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
                  <Ionicons name="location-outline" size={14} color={c.muted} />
                  <Text style={st.meta} numberOfLines={1}>{v.address ?? v.city}</Text>
                </View>
                {Number.isFinite(capacity) ? (
                  <View style={st.line}>
                    <Ionicons name="people-outline" size={14} color={c.muted} />
                    <Text style={st.meta}>حتى {capacity} لاعب</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => void toggleFavoriteVenue(v.id)}
                style={st.fav}
                accessibilityRole="button"
                accessibilityLabel={fav ? `شيل ${v.name} من المفضلة` : `أضف ${v.name} للمفضلة`}
              >
                <Ionicons name={fav ? 'star' : 'star-outline'} size={20} color={fav ? c.accent : c.muted} />
              </Pressable>
            </Pressable>
          );
        })}
        </View>
      </PullRefreshScroll>
    </View>
  );
}

const useStyles = themed((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  card: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, padding: space.md },
  thumb: { width: 72, height: 72, borderRadius: radius, backgroundColor: c.pitch, overflow: 'hidden' },
  thumbLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  thumbCircle: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', top: 23, left: 23 },
  name: { ...type.headline },
  meta: { ...type.caption, color: c.muted, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  fav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
