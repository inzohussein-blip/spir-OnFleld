import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapFrame, type MapFrameHandle } from '../../components/MapFrame';
import { useToast } from '../../components/feedback';
import { Text } from '../../components/ui';
import { api } from '../../lib/api';
import { directionsUrl, distanceKm, formatDistance, hasCoords, IRAQ_CENTER, mainCluster, type LatLng } from '../../lib/geo';
import { buildMapHtml, type MapMessage } from '../../lib/mapHtml';
import { useAsync } from '../../lib/session';
import { cardRadius, ctaShadow, fonts, radius, space, themed, type, useColors, useTheme } from '../../theme';

/** خريطة الملاعب المسجّلة: دبوس لكل ملعب + بطاقات تحت + موقعي + الاتجاهات */
export default function MapTab() {
  const c = useColors();
  const st = useStyles();
  const { scheme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ venue?: string }>();
  const frameRef = useRef<MapFrameHandle>(null);
  const cardsRef = useRef<ScrollViewInstance>(null);

  const venues = useAsync(() => api.listVenues(), [], { cacheKey: 'venues' });
  const matches = useAsync(() => api.listOpenMatches(), [], { cacheKey: 'open-matches' });
  const [selected, setSelected] = useState<string | null>(params.venue ?? null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);
  // فتح الخريطة على ملعب معيّن من صفحته (/map?venue=id) حتى لو التبويب مفتوح من قبل
  const [lastParam, setLastParam] = useState(params.venue);
  if (params.venue !== lastParam) {
    setLastParam(params.venue);
    if (params.venue) setSelected(params.venue);
  }
  useEffect(() => {
    if (params.venue) frameRef.current?.send({ type: 'focus', id: params.venue });
  }, [params.venue]);

  const placed = useMemo(() => (venues.data ?? []).filter(hasCoords), [venues.data]);
  const upcoming = useMemo(() => {
    const n = new Map<string, number>();
    for (const m of matches.data ?? []) if (m.venue_id) n.set(m.venue_id, (n.get(m.venue_id) ?? 0) + 1);
    return n;
  }, [matches.data]);
  const list = useMemo(
    () => (me ? [...placed].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : placed),
    [placed, me],
  );

  // الخريطة تنبني مرة وحدة لكل قائمة ملاعب/ثيم — التحديد والموقع يوصلون كرسائل
  const html = useMemo(
    () =>
      buildMapHtml({
        points: placed.map((v) => ({ id: v.id, name: v.name, lat: v.lat, lng: v.lng })),
        dark: scheme === 'dark',
        primary: c.primary,
        center: IRAQ_CENTER,
        initialIds: mainCluster(placed).map((v) => v.id),
      }),
    [placed, scheme, c.primary],
  );

  function onMessage(m: MapMessage) {
    if (m.type === 'ready') {
      setReady(true);
      if (selected) frameRef.current?.send({ type: 'focus', id: selected });
    } else if (m.type === 'select') {
      setSelected(m.id);
      const i = list.findIndex((v) => v.id === m.id);
      if (i >= 0) cardsRef.current?.scrollTo({ x: i * CARD_STEP, animated: true });
    } else if (m.type === 'error') {
      setReady(true);
    }
  }

  function focus(id: string) {
    setSelected(id);
    frameRef.current?.send({ type: 'focus', id });
  }

  async function locate() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        toast('اسمح للتطبيق يعرف موقعك حتى نرتّب الملاعب حسب الأقرب');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(here);
      const nearIds = [...placed].sort((a, b) => distanceKm(here, a) - distanceKm(here, b)).slice(0, 3).filter((v) => distanceKm(here, v) < 60).map((v) => v.id);
      frameRef.current?.send({ type: 'user', ...here, nearIds });
      cardsRef.current?.scrollTo({ x: 0, animated: true });
    } catch {
      toast('ما كدرنا نحدد موقعك هسه، جرّب مرة ثانية');
    } finally {
      setLocating(false);
    }
  }

  function directions(v: LatLng & { name: string }) {
    const ios = Platform.OS === 'ios' || (Platform.OS === 'web' && /iPhone|iPad|Macintosh/.test(globalThis.navigator?.userAgent ?? ''));
    void Linking.openURL(directionsUrl(ios ? 'apple' : 'google', v, v.name));
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {venues.data ? <MapFrame ref={frameRef} html={html} onMessage={onMessage} /> : null}
      {!ready ? (
        <View style={st.loading} pointerEvents="none">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : null}

      {/* العنوان + الأزرار العائمة */}
      <View style={[st.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={st.title}>
          <Ionicons name="map" size={18} color={c.primary} />
          <Text style={st.titleText}>خريطة الملاعب</Text>
          <View style={st.count}>
            <Text style={st.countText}>{placed.length}</Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <Pressable style={st.fab} onPress={locate} accessibilityRole="button" accessibilityLabel="موقعي">
            {locating ? <ActivityIndicator color={c.primary} /> : <Ionicons name="locate" size={22} color={c.primary} />}
          </Pressable>
          <Pressable style={st.fab} onPress={() => frameRef.current?.send({ type: 'fit' })} accessibilityRole="button" accessibilityLabel="كل الملاعب">
            <Ionicons name="scan-outline" size={21} color={c.primary} />
          </Pressable>
        </View>
      </View>

      {/* بطاقات الملاعب */}
      <ScrollView
        ref={cardsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.cardsWrap}
        contentContainerStyle={st.cards}
        snapToInterval={CARD_STEP}
        decelerationRate="fast"
      >
        {venues.data && list.length === 0 ? (
          <View style={[st.card, { justifyContent: 'center' }]}>
            <Text variant="muted">ماكو ملاعب محدد موقعها بعد</Text>
          </View>
        ) : null}
        {list.map((v) => {
          const on = v.id === selected;
          const n = upcoming.get(v.id) ?? 0;
          return (
            <Pressable key={v.id} onPress={() => focus(v.id)} style={[st.card, on && st.cardOn]} accessibilityLabel={v.name} testID={`map-card-${v.id}`}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={st.thumb}>
                  {v.photo_url ? (
                    <Image source={{ uri: v.photo_url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Ionicons name="football-outline" size={24} color="rgba(255,255,255,0.9)" />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.name} numberOfLines={1}>{v.name}</Text>
                  <Text variant="small" style={{ color: c.muted }} numberOfLines={1}>
                    {me ? `${formatDistance(distanceKm(me, v))} · ` : ''}
                    {v.address ?? v.city}
                  </Text>
                  <Text variant="small" style={{ color: n ? c.primary : c.muted, fontFamily: fonts.semibold }}>
                    {n ? `${n} ${n === 1 ? 'مباراة قادمة' : n === 2 ? 'مباراتين قادمة' : 'مباريات قادمة'}` : 'ماكو مباريات قادمة'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[st.btn, st.btnPrimary]} onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })} accessibilityRole="button">
                  <Text style={st.btnPrimaryText}>التفاصيل</Text>
                </Pressable>
                <Pressable style={st.btn} onPress={() => directions(v)} accessibilityRole="button" accessibilityLabel={`الاتجاهات إلى ${v.name}`}>
                  <Ionicons name="navigate-outline" size={16} color={c.text} />
                  <Text style={st.btnText}>الاتجاهات</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_W = 290;
const CARD_STEP = CARD_W + 12;

const useStyles = themed((c) => ({
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, backgroundColor: c.card, borderRadius: 22, paddingHorizontal: space.lg,
    borderWidth: 1, borderColor: c.border, boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  },
  titleText: { ...type.headline },
  count: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { ...type.micro, fontSize: 12, color: c.primary, lineHeight: 20 },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' },
  cardsWrap: { position: 'absolute', left: 0, right: 0, bottom: space.md, flexGrow: 0 },
  cards: { paddingHorizontal: space.lg, gap: space.md, paddingVertical: space.xs },
  card: { width: CARD_W, backgroundColor: c.card, borderRadius: cardRadius, padding: space.md, gap: space.md, borderWidth: 1, borderColor: c.border, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
  cardOn: { borderColor: c.primary, borderWidth: 1.5 },
  thumb: { width: 56, height: 56, borderRadius: radius, backgroundColor: c.pitch, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { ...type.headline },
  btn: { flex: 1, minHeight: 44, borderRadius: radius, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  btnText: { ...type.label, color: c.text },
  btnPrimary: { backgroundColor: c.cta, borderColor: c.cta, boxShadow: ctaShadow(c) },
  btnPrimaryText: { ...type.label, color: c.onCta },
}));
