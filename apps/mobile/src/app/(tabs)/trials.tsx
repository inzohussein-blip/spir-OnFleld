import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Empty, Loading, Row, Screen, SectionTitle, Text, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { APP_LABEL, formatDateTime, POSITION_LABEL, TRIAL_STATUS } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

const STEPS: { n: string; title: string; body: string; icon: IconName }[] = [
  { n: '01', title: 'كمّل بطاقتك', body: 'صورتك ومركزك وإحصائياتك', icon: 'id-card' },
  { n: '02', title: 'قدّم على الاختبار', body: 'اختر النادي والمركز', icon: 'paper-plane' },
  { n: '03', title: 'استلم النتيجة', body: 'الكشّاف يقيّمك ويرد عليك', icon: 'checkmark-done-circle' },
];

export default function Trials() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { data, loading, reload } = useAsync(() => api.listTrials(), []);
  const alert = useAsync(() => api.getTrialAlert(), []);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const toggleAlert = async () => {
    setSaving(true);
    try {
      await api.setTrialAlert(!alert.data);
      await alert.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={st.hero}>
        <View style={st.heroCircle} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={st.heroTitle}>اختبارات الأندية</Text>
          <Badge label="● قريباً المزيد" tone="green" />
        </Row>
        <Text style={st.heroBody}>طريقك من ملاعب الخماسي لأكاديميات وأندية العراق. الكشّافون يشوفون بطاقتك وإحصائياتك قبل الاختبار.</Text>
        <Row>
          {[['shield-checkmark', 'أندية موثّقة'], ['eye', 'كشّافون'], ['pricetag', 'مجاناً']].map(([i, l]) => (
            <View key={l} style={st.heroChip}>
              <Ionicons name={i as IconName} size={14} color="#fff" />
              <Text variant="small" style={{ color: '#fff' }}>{l}</Text>
            </View>
          ))}
        </Row>
      </View>

      <SectionTitle title="شلون تشتغل؟" hint="ثلاث خطوات تفصلك عن النادي" />
      <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
        {STEPS.map((s) => (
          <View key={s.n} style={st.step}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={st.stepIcon}><Ionicons name={s.icon} size={18} color={c.primary} /></View>
              <Text style={st.stepNum}>{s.n}</Text>
            </Row>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>{s.title}</Text>
            <Text variant="small" style={{ color: c.muted, fontSize: 11 }}>{s.body}</Text>
          </View>
        ))}
      </Row>

      <SectionTitle title="الاختبارات" />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="لا توجد اختبارات حالياً" hint="الأندية دتجهّز أول اختباراتها. فعّل التنبيه حتى تكون أول واحد يقدّم." icon="clipboard-outline" /> : null}
      {data?.map((t) => {
        const status = TRIAL_STATUS[t.status];
        return (
          <Card key={t.id} onPress={() => router.push({ pathname: '/trial/[id]', params: { id: t.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ gap: 6 }}>
                <Text style={{ fontFamily: fonts.bold }}>{t.club_name}</Text>
                {t.verified_club ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
              </Row>
              <Badge label={status.label} tone={status.tone} />
            </Row>
            <Text variant="h2">{t.title}</Text>
            <Text variant="muted">🕒 {formatDateTime(t.trial_date)} · 📍 {t.venue_name}</Text>
            <Row>
              <Badge label={`العمر ${t.age_min}–${t.age_max}`} tone="gray" />
              {t.positions.map((p) => <Badge key={p} label={POSITION_LABEL[p]} tone="gray" />)}
              <Badge label={t.is_free ? 'مجاني' : 'برسوم'} tone={t.is_free ? 'green' : 'yellow'} />
            </Row>
            {t.my_application ? <Text style={{ color: c.primary, fontFamily: fonts.semibold }}>✓ قدّمت — {APP_LABEL[t.my_application.status]}</Text> : null}
          </Card>
        );
      })}
      <Button
        title={alert.data ? 'التنبيه مفعّل — سنبلغك عند فتح اختبارات جديدة' : 'بلّغني من تنفتح الاختبارات'}
        icon={alert.data ? 'notifications' : 'notifications-outline'}
        variant={alert.data ? 'outline' : 'primary'}
        loading={saving}
        onPress={toggleAlert}
      />
    </Screen>
  );
}


const useStyles = themed((c) => ({
  hero: { backgroundColor: c.primary, borderRadius: 20, padding: 18, gap: 8, overflow: 'hidden' },
  heroCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 24, borderColor: 'rgba(255,255,255,0.07)', top: -40, left: -50 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36, color: '#fff' },
  heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 22 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  step: { flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 10, gap: 4, borderWidth: 1, borderColor: c.border },
  stepIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: fonts.bold, fontSize: 18, color: c.primarySoft === '#E6EDFD' ? '#BFD0F7' : c.border },
}));
