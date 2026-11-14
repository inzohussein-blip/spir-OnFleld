import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { MapFrame } from '../../components/MapFrame';
import { useToast } from '../../components/feedback';
import { Button, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { hasCoords, IRAQ_CENTER, type LatLng } from '../../lib/geo';
import { buildMapHtml } from '../../lib/mapHtml';
import { errMsg, useAsync } from '../../lib/session';
import { fonts, useColors, useTheme } from '../../theme';

/** المدير يحدد مكان الملعب: يضغط على الخريطة أو يسحب الدبوس ثم يحفظ */
export default function VenueLocation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { data: venue, loading } = useAsync(() => api.getVenue(id), [id]);
  const [pick, setPick] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);

  const start = venue && hasCoords(venue) ? { lat: venue.lat, lng: venue.lng } : null;
  const html = useMemo(() => {
    const at = venue && hasCoords(venue) ? { lat: venue.lat, lng: venue.lng } : null;
    return buildMapHtml({ points: [], dark: scheme === 'dark', primary: c.primary, center: at ?? IRAQ_CENTER, pick: at, pickMode: true });
  }, [venue, scheme, c.primary]);

  async function save() {
    if (!pick) return;
    setSaving(true);
    try {
      await api.adminSetVenueLocation(id, pick.lat, pick.lng);
      toast('انحفظ موقع الملعب ✓');
      router.back();
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !venue) return <Loading />;
  const shown = pick ?? start;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, gap: 6, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{venue?.name}</Text>
        <Text variant="muted">اضغط على مكان الملعب بالخريطة، أو اسحب الدبوس لحد ما يصير بمكانه بالضبط.</Text>
        <Text variant="small" style={{ color: c.muted }} testID="picked-coords">
          {shown ? `${shown.lat.toFixed(5)}, ${shown.lng.toFixed(5)}` : 'بعدك ما حددت مكان'}
        </Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        {venue ? <MapFrame html={html} onMessage={(m) => m.type === 'pick' && setPick({ lat: m.lat, lng: m.lng })} /> : null}
      </View>
      <View style={{ padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <Button title="احفظ الموقع" icon="checkmark" loading={saving} disabled={!pick} onPress={save} />
      </View>
    </View>
  );
}
