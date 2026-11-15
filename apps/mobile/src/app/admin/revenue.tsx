import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { RevenueView } from '../../components/RevenueView';
import { Chip, Loading, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { summarize } from '../../lib/revenue';
import { useAsync } from '../../lib/session';
import { useColors } from '../../theme';

const PERIODS = [
  { days: 7, label: 'آخر 7 أيام' },
  { days: 30, label: 'آخر 30 يوم' },
  { days: 90, label: 'آخر 3 أشهر' },
];

/** لوحة الأرباح: مدخول كل ملعب وكل يوم، والامتلاء، والغياب، وأوقات تستاهل عروض */
export default function AdminRevenue() {
  const c = useColors();
  const [days, setDays] = useState(30);
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);
  const { data, loading } = useAsync(() => api.adminListMatches(range.from, range.to), [range.from, range.to]);
  const s = useMemo(() => (data ? summarize(data) : null), [data]);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 980, width: '100%', alignSelf: 'center', paddingBottom: 60 }}>
      <Row>
        {PERIODS.map((p) => (
          <Chip key={p.days} label={p.label} active={days === p.days} onPress={() => setDays(p.days)} />
        ))}
      </Row>
      <Text variant="small" style={{ color: c.muted }}>
        المدخول = عدد اللي دفعوا × سعر اللاعب بعد الخصم. بالمباريات المسكّرة يدخل الحاضر والغايب، وبغيرها المنضمين.
      </Text>
      {loading && !s ? <Loading /> : s ? <RevenueView s={s} /> : null}
    </ScrollView>
  );
}
