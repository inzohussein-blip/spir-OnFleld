import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Loading, Row, Screen, Text, type IconName } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAsync } from '../lib/session';
import type { ChannelKind } from '../lib/types';
import { fonts, themed, useColors } from '../theme';

const ICON: Record<ChannelKind, { icon: IconName; bg: string }> = {
  general: { icon: 'chatbubbles', bg: '#1E4FD8' },
  announcements: { icon: 'megaphone', bg: '#F08C00' },
  support: { icon: 'headset', bg: '#1C8B4A' },
};

export default function Chats() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { data, loading, reload } = useAsync(() => api.listChannels(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Text variant="muted">✓✓ كل الرسائل مقروءة</Text>
      {data?.map((ch) => (
        <Pressable
          key={ch.id}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: ch.id } })}
          style={[st.item, ch.important && { borderColor: c.accent, backgroundColor: c.accentSoft }]}
        >
          <View style={[st.icon, { backgroundColor: ICON[ch.id].bg }]}>
            <Ionicons name={ICON[ch.id].icon} size={24} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Row style={{ gap: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{ch.title}</Text>
                {ch.important ? <Badge label="مهم" tone="yellow" /> : null}
              </Row>
              {ch.last_message ? <Text variant="small" style={{ color: c.muted }}>{timeAgo(ch.last_message.created_at)}</Text> : null}
            </Row>
            <Text variant="small" style={{ color: c.muted }} numberOfLines={1}>
              {ch.last_message ? `${ch.last_message.sender_name}: ${ch.last_message.body}` : ch.subtitle}
            </Text>
          </View>
        </Pressable>
      ))}
      <Row style={{ justifyContent: 'center', marginTop: 8 }}>
        <Ionicons name="lock-closed" size={12} color={c.muted} />
        <Text variant="small" style={{ color: c.muted }}>محادثات بالملعب محمية ومخصصة للاعبين فقط</Text>
      </Row>
    </Screen>
  );
}

const useStyles = themed((c) => ({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: c.border },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
}));
