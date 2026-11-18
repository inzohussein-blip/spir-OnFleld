import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { Button, Card, Empty, ErrorText, Input, Loading, SectionTitle, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { errMsg, useAsync } from '../../lib/session';
import { normalizePublicId } from '../../lib/teams';
import { fonts, themed, useColors } from '../../theme';

/**
 * المدير ← الموظفين: يعيّن لاعب كموظف برقمه العام (ID)، أو يشيله.
 * الموظف يدير المباريات بس: ينشئها، يلغيها، يقسّم الفريقين، يسجّل النتيجة ويسكّرها.
 */
export default function StaffAdmin() {
  const c = useColors();
  const st = useStyles();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminListStaff(), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStaff(publicId: string, on: boolean) {
    setBusy(publicId);
    setError(null);
    try {
      const name = await api.adminSetStaff(publicId, on);
      toast(on ? `${name} صار موظف ✓` : `${name} رجع لاعب`);
      if (on) setCode('');
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>عيّن موظف</Text>
        <Text variant="small" style={{ color: c.muted }}>
          اكتب رقم اللاعب (ID) من «حسابي». الموظف يدير المباريات بس: ينشئ، يلغي، يقسّم الفريقين، يسجّل النتيجة ويسكّر المباراة. ما يشوف الأرباح ولا الإعلانات ولا الإعدادات.
        </Text>
        <Input value={code} onChangeText={(v) => setCode(normalizePublicId(v))} placeholder="رقم اللاعب" keyboardType="number-pad" maxLength={10} accessibilityLabel="رقم اللاعب" />
        <Button title="عيّنه موظف" icon="person-add-outline" loading={busy === code && !!code} disabled={!code} onPress={() => void setStaff(code, true)} />
        <ErrorText message={error} />
      </Card>

      <SectionTitle title={`الموظفين (${data?.length ?? 0})`} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="بعد ماكو موظفين" hint="عيّن أول موظف برقمه من فوك" icon="people-outline" /> : null}
      {data?.map((p) => (
        <View key={p.id} style={st.row}>
          <Avatar name={p.full_name} url={p.avatar_url} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>{p.full_name}</Text>
            <Text variant="small" style={{ color: c.muted }}>ID {p.public_id ?? '—'}</Text>
          </View>
          <Button title="شيله" variant="outline" loading={busy === p.public_id} onPress={() => p.public_id && void setStaff(p.public_id, false)} />
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 16, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 2, borderColor: c.border, padding: 12 },
}));
