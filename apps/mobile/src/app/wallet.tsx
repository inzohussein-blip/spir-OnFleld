import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Card, Empty, Loading, Row, Screen, SectionTitle, Text, type IconName } from '../components/ui';
import { api } from '../lib/api';
import { formatIQD, formatSigned, timeAgo } from '../lib/format';
import { useAsync } from '../lib/session';
import type { WalletTx } from '../lib/types';
import { fonts, useColors } from '../theme';

const KIND: Record<WalletTx['kind'], { label: string; icon: IconName }> = {
  topup: { label: 'شحن', icon: 'add-circle' },
  payment: { label: 'دفع', icon: 'card' },
  reward: { label: 'مكافأة', icon: 'gift' },
  refund: { label: 'استرجاع', icon: 'return-down-back' },
};

export default function WalletScreen() {
  const c = useColors();
  const { data, loading } = useAsync(() => api.getWallet(), []);
  if (loading && !data) return <Loading />;
  if (!data) return null;
  return (
    <Screen>
      <View style={{ backgroundColor: c.primary, borderRadius: 20, padding: 20, gap: 4 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)' }}>رصيدك الحالي</Text>
        <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 32, lineHeight: 46 }}>{formatIQD(data.balance)}</Text>
        <Text variant="small" style={{ color: 'rgba(255,255,255,0.85)' }}>يُستخدم لدفع حصتك من الحجوزات واشتراكات البطولات. الشحن الإلكتروني (زين كاش، FastPay، كي كارد) قريباً.</Text>
      </View>
      <SectionTitle title="سجل العمليات" />
      {data.transactions.length === 0 ? <Empty title="لا توجد عمليات بعد" icon="wallet-outline" /> : null}
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {data.transactions.map((t) => (
          <Row key={t.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, flexWrap: 'nowrap' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={KIND[t.kind].icon} size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold }}>{t.note}</Text>
              <Text variant="small" style={{ color: c.muted }}>{KIND[t.kind].label} · {timeAgo(t.created_at)}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, color: t.amount >= 0 ? '#1C8B4A' : c.danger }}>{formatSigned(t.amount)}</Text>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
