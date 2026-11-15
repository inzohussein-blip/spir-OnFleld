import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '../../components/feedback';
import { Button, ErrorText, Input, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatIQD } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import type { AppSettings } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

/** مبالغ المكافآت: رجل المباراة ودعوة الأصدقاء */
export default function AdminRewards() {
  const { data } = useAsync(() => api.getSettings(), []);
  if (!data) return <Loading />;
  return <Form initial={data} />;
}

function Form({ initial }: { initial: AppSettings }) {
  const c = useColors();
  const st = useStyles();
  const toast = useToast();
  const [motm, setMotm] = useState(String(initial.motm_reward));
  const [refReward, setRefReward] = useState(String(initial.referral_reward));
  const [needed, setNeeded] = useState(String(initial.referral_needed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (s: string) => Number.parseInt(s.replace(/,/g, ''), 10);

  async function save() {
    const next = { motm_reward: num(motm), referral_reward: num(refReward), referral_needed: num(needed) };
    if (Object.values(next).some((v) => !Number.isFinite(v) || v < 0) || next.referral_needed < 1 || next.referral_needed > 20) {
      return setError('اكتب أرقام صحيحة (عدد الأصدقاء من 1 لـ 20)');
    }
    setBusy(true);
    setError(null);
    try {
      await api.adminSaveSettings(next);
      toast('انحفظت المكافآت ✓');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.card}>
        <Text style={st.h}>🏅 رجل المباراة</Text>
        <Text variant="small" style={{ color: c.muted }}>ينضاف لمحفظة اللي يختاره المنظّم لما يسكّر المباراة (اللاعبين يصوّتون بعد المباراة).</Text>
        <Input label="المبلغ (د.ع)" value={motm} onChangeText={setMotm} keyboardType="number-pad" />
      </View>
      <View style={st.card}>
        <Text style={st.h}>🎁 دعوة الأصدقاء</Text>
        <Text variant="small" style={{ color: c.muted }}>الصديق ينحسب لما يحضر أول مباراة. كل ما يكمل العدد، المكافأة تنضاف لمحفظة اللي دعاهم.</Text>
        <Input label="كم صديق" value={needed} onChangeText={setNeeded} keyboardType="number-pad" />
        <Input label="المكافأة (د.ع)" value={refReward} onChangeText={setRefReward} keyboardType="number-pad" />
        {Number.isFinite(num(refReward)) && Number.isFinite(num(needed)) ? (
          <Text variant="small" style={{ color: c.primary, fontFamily: fonts.bold }}>
            كل {num(needed)} أصدقاء = {formatIQD(num(refReward))}
          </Text>
        ) : null}
      </View>
      <Text variant="small" style={{ color: c.muted }}>تذكير: إذا غيّرت المبالغ، عدّل نصوص الإعلانات حتى تطابقها (لوحة التحكم ← الإعلانات).</Text>
      <ErrorText message={error} />
      <Button title="احفظ" icon="checkmark" loading={busy} onPress={save} />
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 20, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 10 },
  h: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28 },
}));
