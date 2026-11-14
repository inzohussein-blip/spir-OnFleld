import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useToast } from '../../components/feedback';
import { Button, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { pickSquareImage } from '../../lib/pickImage';
import { errMsg, useAsync } from '../../lib/session';
import { fonts, useColors } from '../../theme';

export default function AdminVenues() {
  const c = useColors();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.listVenues(), []);
  const [uploading, setUploading] = useState<string | null>(null);

  async function upload(venueId: string) {
    try {
      const uri = await pickSquareImage([16, 9]);
      if (!uri) return;
      setUploading(venueId);
      await api.adminUploadVenuePhoto(venueId, uri);
      await reload();
      toast('انرفعت الصورة ✓');
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setUploading(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      {loading && !data ? <Loading /> : null}
      {data?.map((v) => (
        <View key={v.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14 }}>
          <View style={{ width: 160, height: 90, borderRadius: 12, backgroundColor: '#1C8B4A', overflow: 'hidden' }}>
            {v.photo_url ? <Image source={{ uri: v.photo_url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={v.name} /> : null}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{v.name}</Text>
            <Text variant="small" style={{ color: c.muted }}>{v.city}{v.address ? ` · ${v.address}` : ''}</Text>
            <Button title={v.photo_url ? 'غيّر الصورة' : 'ارفع صورة'} icon="image-outline" variant="outline" loading={uploading === v.id} onPress={() => void upload(v.id)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
