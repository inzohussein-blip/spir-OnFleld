import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import type { ChannelKind, ChatMessage } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

const TITLES: Record<ChannelKind, string> = { general: 'المحادثة العامة', announcements: 'التبليغات', support: 'محادثة الإدارة' };

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: ChannelKind }>();
  const channel: ChannelKind = id === 'announcements' || id === 'support' ? id : 'general';
  const c = useColors();
  const st = useStyles();
  const { userId } = useSession();
  const { data, loading, reload } = useAsync(() => api.listMessages(channel), [channel]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const canPost = channel !== 'announcements';

  // تحديث دوري بسيط (يُستبدل بـ Realtime عند الربط بـ Supabase)
  useEffect(() => {
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [reload]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    setError(null);
    try {
      await api.sendMessage(channel, body);
      await reload();
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setError(errMsg(e));
      setText(body);
    }
  }

  if (loading && !data) return <Loading />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: TITLES[channel] }} />
      <FlatList
        ref={list}
        data={data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text variant="muted" style={{ textAlign: 'center' }}>ابدأ المحادثة 👋</Text>}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === userId;
          return (
            <View style={[st.bubble, mine ? st.mine : m.is_admin ? st.admin : st.other]}>
              {!mine ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: m.is_admin ? c.warnText : c.primary }}>
                  {m.is_admin ? '🛡️ ' : ''}{m.sender_name}
                </Text>
              ) : null}
              <Text style={{ color: mine ? '#fff' : c.text, lineHeight: 24 }}>{m.body}</Text>
              <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.75)' : c.muted }}>{timeAgo(m.created_at)}</Text>
            </View>
          );
        }}
      />
      <ErrorText message={error} />
      {canPost ? (
        <View style={st.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة…"
            placeholderTextColor={c.muted}
            style={st.input}
            multiline
            maxLength={1000}
          />
          <Pressable onPress={send} style={st.send} accessibilityLabel="إرسال">
            <Ionicons name="send" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
        </View>
      ) : (
        <View style={st.readonly}><Text variant="small" style={{ color: c.muted }}>📢 هذه القناة للإعلانات الرسمية من الإدارة فقط</Text></View>
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = themed((c) => ({
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { alignSelf: 'flex-start', backgroundColor: c.primary, borderBottomRightRadius: 4 },
  other: { alignSelf: 'flex-end', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
  admin: { alignSelf: 'flex-end', backgroundColor: c.warnSoft, borderBottomLeftRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: c.cardAlt, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15, color: c.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  readonly: { padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
}));
