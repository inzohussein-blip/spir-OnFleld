import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { Badge, Button, Card, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDay } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { fonts } from '../../theme';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, loading } = useAsync(() => api.getPost(id), [id]);
  if (loading && !p) return <Loading />;
  if (!p) return <Screen><ErrorText message="المنشور غير موجود" /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'المنشور' }} />
      <View style={{ backgroundColor: p.cover_color, borderRadius: 20, height: 200, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name={p.media_count > 1 ? 'images' : 'videocam'} size={56} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: fonts.bold }}>{p.media_count} {p.media_count > 1 ? 'صورة وفيديو' : 'مقطع'}</Text>
      </View>
      <Text variant="title">{p.title}</Text>
      <Row>
        <Badge label={p.category === 'full' ? '11 ضد 11' : 'مباراة سريعة'} />
        {p.venue_name ? <Badge label={`📍 ${p.venue_name}`} tone="gray" /> : null}
        <Badge label={formatDay(new Date(p.created_at))} tone="gray" />
      </Row>
      <Card><Text style={{ lineHeight: 28 }}>{p.body}</Text></Card>
      <Button title="مشاركة" icon="share-social" variant="outline" onPress={() => Share.share({ message: `${p.title}\n\n${p.body}\n\n— تطبيق بالملعب` })} />
    </Screen>
  );
}
