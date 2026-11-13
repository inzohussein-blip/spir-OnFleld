import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Empty, Loading, Row, Screen, Segmented, Text } from '../components/ui';
import { api } from '../lib/api';
import { formatDay } from '../lib/format';
import { useAsync } from '../lib/session';
import type { PostCategory } from '../lib/types';
import { fonts, themed, useColors } from '../theme';

export default function Posts() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const [cat, setCat] = useState<PostCategory>('full');
  const { data, loading, reload } = useAsync(() => api.listPosts(cat), [cat]);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [hero, ...rest] = data ?? [];

  return (
    <Screen>
      <Segmented<PostCategory>
        value={cat}
        onChange={setCat}
        options={[
          { value: 'full', label: '11 ضد 11', icon: 'football' },
          { value: 'small', label: 'السريعة', icon: 'flash' },
        ]}
      />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? (
        <>
          <Empty title="لا توجد منشورات حالياً" hint="تابعنا، راح تنزل أخبار جديدة قريباً" icon="document-text-outline" />
          <Button title="تحديث" icon="refresh" variant="outline" onPress={reload} style={{ alignSelf: 'center', paddingHorizontal: 28 }} />
        </>
      ) : null}

      {hero ? (
        <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id: hero.id } })} style={[st.hero, { backgroundColor: hero.cover_color }]}>
          <View style={st.heroBall}><Ionicons name="football" size={140} color="rgba(255,255,255,0.08)" /></View>
          <Badge label="● جديد" tone="green" />
          <Text style={st.heroTitle}>{hero.title}</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={st.heroPill}><Text variant="small" style={{ color: '#fff' }}>🕒 {formatDay(new Date(hero.created_at))}</Text></View>
            <Text style={{ color: '#fff', fontFamily: fonts.semibold }}>اقرأ المزيد ‹</Text>
          </Row>
        </Pressable>
      ) : null}

      {rest.map((p) => (
        <Pressable key={p.id} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })} style={st.item}>
          <View style={[st.thumb, { backgroundColor: p.cover_color }]}>
            <Ionicons name={p.media_count > 1 ? 'images' : 'videocam'} size={26} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontFamily: fonts.bold }}>{p.media_count}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold }} numberOfLines={2}>{p.title}</Text>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={st.datePill}><Text variant="small" style={{ color: c.muted }}>🕒 {formatDay(new Date(p.created_at))}</Text></View>
              <Ionicons name="chevron-back" size={16} color={c.muted} />
            </Row>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const useStyles = themed((c) => ({
  hero: { borderRadius: 20, padding: 18, gap: 10, minHeight: 170, justifyContent: 'flex-end', overflow: 'hidden' },
  heroBall: { position: 'absolute', top: -10, left: 10 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 32, color: '#fff' },
  heroPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  item: { flexDirection: 'row', gap: 12, backgroundColor: c.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  thumb: { width: 76, height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  datePill: { backgroundColor: c.cardAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
}));
