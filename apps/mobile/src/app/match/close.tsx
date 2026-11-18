import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { Button, Empty, ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatIQD } from '../../lib/format';
import { finalPrice } from '../../lib/pricing';
import { errMsg, useAsync } from '../../lib/session';
import type { Attendance, MatchDetail, MotmVote } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

/** بعد المباراة (المنظّم أو الإدارة): منو حضر ومنو غاب، ورجل المباراة — وبعدها تتسكّر */
export default function CloseMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useAsync(() => api.getMatch(id), [id]);
  const votes = useAsync(() => api.getMotmVotes(id), [id]);
  const settings = useAsync(() => api.getSettings(), []);
  if (match.loading && !match.data) return <Loading />;
  if (!match.data) return <Empty title="المباراة مو موجودة" icon="football-outline" />;
  if (match.data.closed_at) return <Empty title="المباراة مسكّرة من قبل" hint="الحضور ورجل المباراة انسجّلوا" icon="checkmark-done-outline" />;
  return <CloseForm m={match.data} votes={votes.data ?? []} motmReward={settings.data?.motm_reward ?? 0} />;
}

function CloseForm({ m, votes, motmReward }: { m: MatchDetail; votes: MotmVote[]; motmReward: number }) {
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const joined = m.roster.filter((r) => r.status === 'joined');
  const [att, setAtt] = useState<Record<string, Attendance>>(() => Object.fromEntries(joined.map((r) => [r.player_id, 'attended' as Attendance])));
  // المرشّح الأول: صاحب أكثر أصوات
  const [motm, setMotm] = useState<string | null>(() => votes[0]?.player_id ?? null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = finalPrice(m) ?? 0;
  const absent = joined.filter((r) => att[r.player_id] === 'no_show');
  const votesOf = (pid: string) => votes.find((v) => v.player_id === pid)?.votes ?? 0;
  const name = (pid: string | null | undefined) => joined.find((r) => r.player_id === pid)?.profile.full_name ?? 'القائد';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.closeMatch(m.id, { attendance: att, motm_player_id: motm && att[motm] === 'attended' ? motm : null });
      toast(`انسكّرت المباراة ✓${res.charged ? ` · ${res.charged} غياب` : ''}${res.motm_reward ? ` · مكافأة رجل المباراة ${formatIQD(res.motm_reward)}` : ''}`);
      router.back();
    } catch (e) {
      setError(errMsg(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.page}>
      <Text style={st.title}>{m.venue_name ?? 'المباراة'}</Text>
      <Text variant="small" style={{ color: c.muted }}>
        أشّر على اللي غاب. الغايب ينخصم عليه {formatIQD(price)}، وإذا دخّله القائد ويّا الفريق ينخصم على القائد.
      </Text>

      <Text style={st.h}>الحضور ({joined.length - absent.length} من {joined.length})</Text>
      {joined.map((r) => {
        const no = att[r.player_id] === 'no_show';
        return (
          <View key={r.player_id} style={st.row}>
            <Avatar name={r.profile.full_name} url={r.profile.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold }}>{r.profile.full_name}</Text>
              {r.paid_by && r.paid_by !== r.player_id ? <Text variant="small" style={{ color: c.muted }}>ويّا فريق — الدفع على {name(r.paid_by)}</Text> : null}
            </View>
            <View style={st.toggle}>
              <Pressable onPress={() => setAtt((a) => ({ ...a, [r.player_id]: 'attended' }))} style={[st.opt, !no && st.optOn]} accessibilityRole="button" accessibilityState={{ selected: !no }} accessibilityLabel={`${r.profile.full_name} حضر`}>
                <Text style={[st.optText, !no && { color: '#fff' }]}>حضر</Text>
              </Pressable>
              <Pressable onPress={() => setAtt((a) => ({ ...a, [r.player_id]: 'no_show' }))} style={[st.opt, no && st.optNo]} accessibilityRole="button" accessibilityState={{ selected: no }} accessibilityLabel={`${r.profile.full_name} غاب`}>
                <Text style={[st.optText, no && { color: '#fff' }]}>غاب</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Text style={st.h}>🏅 رجل المباراة</Text>
      <Text variant="small" style={{ color: c.muted }}>
        {votes.length ? 'مرتبين حسب تصويت اللاعبين.' : 'بعد ماكو تصويت — اختار بنفسك.'} {motmReward ? `ياخذ ${formatIQD(motmReward)} بمحفظته.` : ''}
      </Text>
      <View style={st.chips}>
        {[...joined]
          .filter((r) => att[r.player_id] === 'attended')
          .sort((a, b) => votesOf(b.player_id) - votesOf(a.player_id))
          .map((r) => {
            const on = motm === r.player_id;
            return (
              <Pressable key={r.player_id} onPress={() => setMotm(on ? null : r.player_id)} style={[st.chip, on && st.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                {on ? <Ionicons name="medal" size={15} color={c.onCta} /> : null}
                <Text style={[{ fontFamily: fonts.semibold }, on && { color: c.onCta }]}>{r.profile.full_name}</Text>
                {votesOf(r.player_id) ? <Text variant="small" style={{ color: on ? c.onCta : c.muted }}>{votesOf(r.player_id)} صوت</Text> : null}
              </Pressable>
            );
          })}
      </View>

      <ErrorText message={error} />
      {confirm ? (
        <View style={st.confirm}>
          <Text style={{ fontFamily: fonts.bold }}>متأكد؟ ما تكدر تعدّل بعدين.</Text>
          <Text variant="small" style={{ color: c.muted }}>
            {absent.length ? `${absent.length} غياب × ${formatIQD(price)}` : 'الكل حضر'}
            {motm && att[motm] === 'attended' ? ` · رجل المباراة: ${name(motm)}` : ' · بدون رجل المباراة'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="إي، سكّرها" loading={busy} onPress={submit} style={{ flex: 1 }} />
            <Button title="لا" variant="outline" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button title="سكّر المباراة" icon="checkmark-done-outline" onPress={() => setConfirm(true)} disabled={!joined.length} />
      )}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 16, gap: 10, paddingBottom: 48 },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 32 },
  h: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 10 },
  toggle: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 12, padding: 3 },
  opt: { paddingHorizontal: 12, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optOn: { backgroundColor: c.success },
  optNo: { backgroundColor: c.danger },
  optText: { fontFamily: fonts.bold, fontSize: 13, color: c.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card, borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: c.cta, borderColor: c.primaryDark },
  confirm: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
}));
