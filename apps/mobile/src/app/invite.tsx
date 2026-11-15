import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useToast } from '../components/feedback';
import { Button, ErrorText, Text } from '../components/ui';
import { api } from '../lib/api';
import { formatIQD, timeAgo } from '../lib/format';
import { normalizePublicId } from '../lib/teams';
import { shareInvite } from '../lib/share';
import { errMsg, useAsync } from '../lib/session';
import { fonts, themed, useColors } from '../theme';

const STATUS = {
  joined: { label: 'سجّل — بعده ما لعب', color: '#B45309', icon: 'time-outline' },
  played: { label: 'لعب أول مباراة ✓', color: '#167A43', icon: 'checkmark-circle' },
  rewarded: { label: 'انحسب بمكافأة 🎁', color: '#1E4FD8', icon: 'gift' },
} as const;

/** ادعُ أصدقاءك: رقمك ورابطك، التقدّم نحو المكافأة، وقائمة أصدقائك — وتسجيل رقم صديق دعاك */
export default function InviteScreen() {
  const c = useColors();
  const st = useStyles();
  const toast = useToast();
  const ref = useAsync(() => api.getReferrals(), []);
  const settings = useAsync(() => api.getSettings(), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = ref.data;
  const needed = settings.data?.referral_needed ?? 3;
  const reward = settings.data?.referral_reward ?? 0;
  const played = (data?.friends ?? []).filter((f) => f.status === 'played').length;

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const name = await api.claimReferral(code);
      toast(`انسجّلت دعوة ${name} ✓`);
      setCode('');
      await ref.reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={st.hero}>
        <View style={st.gift}>
          <Ionicons name="gift" size={30} color="#0C9A6F" />
        </View>
        <Text style={st.heroTitle}>
          {needed} أصدقاء = {reward ? formatIQD(reward) : 'مكافأة'} بمحفظتك
        </Text>
        <Text style={st.heroBody}>دزّ رابطك لأصدقائك. لما {needed} منهم يلعبون أول مباراة، المكافأة تنضاف لمحفظتك تلقائياً.</Text>
        {data?.code ? (
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(data.code ?? '');
              toast('انسخ رقمك ✓');
            }}
            style={st.code}
            accessibilityRole="button"
            accessibilityLabel="انسخ رقم الدعوة"
          >
            <Text style={st.codeLabel}>رقمك</Text>
            <Text style={st.codeText}>{data.code}</Text>
            <Ionicons name="copy-outline" size={18} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable onPress={() => void shareInvite(data?.code)} style={st.share} accessibilityRole="button">
          <Ionicons name="share-social-outline" size={20} color="#0C9A6F" />
          <Text style={{ color: '#0C9A6F', fontFamily: fonts.bold, fontSize: 16 }}>دز الرابط لأصدقائك</Text>
        </Pressable>
      </View>

      {/* التقدّم */}
      <View style={st.card}>
        <Text style={st.h}>المكافأة الجاية</Text>
        <View style={st.steps}>
          {Array.from({ length: needed }, (_, i) => (
            <View key={i} style={[st.step, i < played && st.stepOn]}>
              {i < played ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={{ color: c.muted, fontFamily: fonts.bold }}>{i + 1}</Text>}
            </View>
          ))}
        </View>
        <Text variant="small" style={{ color: c.muted }}>
          {played}/{needed} أصدقاء لعبوا · {Math.max(0, needed - played)} باقين
        </Text>
      </View>

      {/* الأصدقاء */}
      <Text style={st.h}>أصدقائي ({data?.friends.length ?? 0})</Text>
      {data && data.friends.length === 0 ? <Text variant="muted">بعدك ما دعيت أحد. دز الرابط وابدأ.</Text> : null}
      {data?.friends.map((f) => (
        <View key={`${f.name}-${f.created_at}`} style={st.friend}>
          <Ionicons name={STATUS[f.status].icon} size={20} color={STATUS[f.status].color} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold }}>{f.name}</Text>
            <Text variant="small" style={{ color: STATUS[f.status].color }}>{STATUS[f.status].label}</Text>
          </View>
          <Text variant="small" style={{ color: c.muted }}>{timeAgo(f.created_at)}</Text>
        </View>
      ))}

      {/* منو دعاني */}
      {data?.referred_by ? (
        <Text variant="muted">دعاك {data.referred_by} 👋</Text>
      ) : data?.can_claim ? (
        <View style={st.card}>
          <Text style={st.h}>صديق دعاك؟</Text>
          <Text variant="small" style={{ color: c.muted }}>اكتب رقمه حتى تنحسب الدعوة إله (أول 14 يوم من تسجيلك بس).</Text>
          <View style={st.claim}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(normalizePublicId(v))}
              placeholder="رقم صديقك"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              maxLength={10}
              style={st.input}
              accessibilityLabel="رقم الصديق"
            />
            <Button title="سجّل" loading={busy} disabled={!code} onPress={claim} />
          </View>
          <ErrorText message={error} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 16, gap: 12, paddingBottom: 48 },
  hero: { borderRadius: 24, padding: 18, gap: 8, alignItems: 'center', backgroundColor: '#0C9A6F', backgroundImage: 'linear-gradient(135deg, #12B886 0%, #0C9A6F 55%, #077A57 100%)' },
  gift: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontFamily: fonts.bold, fontSize: 20, lineHeight: 32, textAlign: 'center' },
  heroBody: { color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 23, fontSize: 13.5 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, marginVertical: 2 },
  codeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  codeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 18, letterSpacing: 1 },
  share: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 16, minHeight: 50 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
  h: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  stepOn: { backgroundColor: '#12B886', borderColor: '#12B886' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 12 },
  claim: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, fontSize: 16, color: c.text, backgroundColor: c.bg, outlineWidth: 0 },
}));
