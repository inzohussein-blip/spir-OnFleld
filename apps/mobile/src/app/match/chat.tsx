import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatClock, timeAgo, toWesternDigits } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import type { MatchMessage } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

/** رسائل جاهزة للتنسيق السريع */
const QUICK = ['منو يجيب الكرة؟ ⚽', 'شنو لون التيشيرتات؟', 'بالطريق 🚗', 'متأخر 10 دقايق', 'وصلت ✅'];

/** محادثة المباراة: للاعبين المنضمين والمنظّم والإدارة */
export default function MatchChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const st = useStyles();
  const { userId } = useSession();
  const match = useAsync(() => api.getMatch(id), [id]);
  const { data, loading, reload } = useAsync(() => api.listMatchMessages(id), [id]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MatchMessage>>(null);

  useEffect(() => {
    const t = setInterval(() => void reload(), 8000);
    return () => clearInterval(t);
  }, [reload]);

  async function send(raw: string) {
    const body = raw.trim();
    if (!body) return;
    setText('');
    setError(null);
    try {
      await api.sendMatchMessage(id, body);
      await reload();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setError(errMsg(e));
      setText(body);
    }
  }

  if (loading && !data) return <Loading />;
  const m = match.data;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: m?.venue_name ? `محادثة ${m.venue_name}` : 'محادثة المباراة' }} />
      {m ? (
        <View style={st.head}>
          <Ionicons name="football-outline" size={18} color={c.primary} />
          <Text variant="small" style={{ flex: 1 }}>
            {formatClock(m.starts_at)} · {m.joined_count} لاعب منضم — المحادثة للاعبين بهاي المباراة بس
          </Text>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={data ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text variant="muted" style={{ textAlign: 'center' }}>نسّقوا هنا: منو يجيب الكرة، لون التيشيرتات، والوصول 👋</Text>}
        renderItem={({ item: msg }) => {
          const mine = msg.sender_id === userId;
          return (
            <View style={[st.bubble, mine ? st.mine : st.other]}>
              {!mine ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.primary }}>{msg.sender_name}</Text> : null}
              <Text style={{ color: mine ? '#fff' : c.text, lineHeight: 24 }}>{msg.body}</Text>
              <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.75)' : c.muted }}>{timeAgo(msg.created_at)}</Text>
            </View>
          );
        }}
      />
      <ErrorText message={error} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={st.quick} keyboardShouldPersistTaps="handled">
        {QUICK.map((q) => (
          <Pressable key={q} onPress={() => void send(q)} style={st.quickChip} accessibilityRole="button">
            <Text variant="small">{q}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={st.composer}>
        <TextInput
          value={text}
          onChangeText={(v) => setText(toWesternDigits(v))}
          placeholder="اكتب رسالة…"
          placeholderTextColor={c.muted}
          style={st.input}
          multiline
          maxLength={1000}
          accessibilityLabel="رسالة"
        />
        <Pressable onPress={() => void send(text)} style={st.send} accessibilityLabel="إرسال">
          <Ionicons name="send" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = themed((c) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: c.primarySoft },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { alignSelf: 'flex-start', backgroundColor: c.primary, borderBottomRightRadius: 4 },
  other: { alignSelf: 'flex-end', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
  quick: { gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  quickChip: { alignSelf: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: c.cardAlt, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15, color: c.text, outlineWidth: 0 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
}));
