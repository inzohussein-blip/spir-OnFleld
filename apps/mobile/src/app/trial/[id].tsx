import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Badge, Button, Card, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { APP_LABEL, formatDateTime, POSITION_LABEL, TRIAL_STATUS } from '../../lib/format';
import { errMsg, useAsync, useSession } from '../../lib/session';
import { fonts, useColors } from '../../theme';

export default function TrialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const { userId } = useSession();
  const { data: t, loading, reload } = useAsync(() => api.getTrial(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading && !t) return <Loading />;
  if (!t) return <Screen><ErrorText message="الاختبار مو موجود" /></Screen>;
  const status = TRIAL_STATUS[t.status];

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await api.applyToTrial(t!.id);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t.club_name }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6 }}>
            <Text variant="h2">{t.club_name}</Text>
            {t.verified_club ? <Ionicons name="checkmark-circle" size={18} color={c.primary} /> : null}
          </Row>
          <Badge label={status.label} tone={status.tone} />
        </Row>
        <Text variant="title">{t.title}</Text>
        <Text variant="muted">🕒 {formatDateTime(t.trial_date)}</Text>
        <Text variant="muted">📍 {t.venue_name}</Text>
        <Row>
          <Badge label={`العمر ${t.age_min}–${t.age_max}`} tone="gray" />
          {t.positions.map((p) => <Badge key={p} label={POSITION_LABEL[p]} tone="gray" />)}
          <Badge label={t.is_free ? 'مجاني' : 'برسوم'} tone={t.is_free ? 'green' : 'yellow'} />
          <Badge label={`${t.applicants} متقدّم`} tone="gray" />
        </Row>
      </Card>
      <Card>
        <Text variant="h2">عن الاختبار</Text>
        <Text style={{ lineHeight: 26 }}>{t.description}</Text>
      </Card>

      {t.my_application ? (
        <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primarySoft }}>
          <Text style={{ fontFamily: fonts.bold, color: c.primary }}>حالة طلبك: {APP_LABEL[t.my_application.status]}</Text>
          {t.my_application.scout_note ? <Text>ملاحظة الكشّاف: {t.my_application.scout_note}</Text> : <Text variant="muted">بعد الاختبار تستلم النتيجة وملاحظات الكشّاف هنا.</Text>}
        </Card>
      ) : t.status === 'open' ? (
        <>
          <Text variant="muted">الكشّاف راح يشوف بطاقتك وإحصائياتك. تأكد إن ملفك مكتمل.</Text>
          <ErrorText message={error} />
          <Button title="قدّم على الاختبار" icon="paper-plane" loading={busy} onPress={apply} />
          {userId ? <Button title="راجع بطاقتي أولاً" variant="ghost" onPress={() => router.push({ pathname: '/player/[id]', params: { id: userId } })} /> : null}
        </>
      ) : (
        <Text variant="muted">{t.status === 'upcoming' ? 'التقديم يفتح قريباً.' : 'انتهى التقديم على هذا الاختبار.'}</Text>
      )}
    </Screen>
  );
}
