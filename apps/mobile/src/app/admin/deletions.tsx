import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '../../components/feedback';
import { Badge, Button, Empty, Loading, Row, Segmented, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFullDate } from '../../lib/format';
import { errMsg, useAsync, useNow } from '../../lib/session';
import type { AccountDeletionRequest } from '../../lib/types';
import { fonts, useColors } from '../../theme';

const LABEL: Record<AccountDeletionRequest['status'], string> = { pending: 'بانتظار الحذف', cancelled: 'انلغى (رجع دخل)', done: 'انحذف' };
const DAY = 86_400_000;

/** طلبات حذف الحساب: تنحذف خلال 30 يوم، وتنلغي تلقائياً إذا اللاعب رجع دخل */
export default function AdminDeletions() {
  const c = useColors();
  const toast = useToast();
  const now = useNow(60_000);
  const { data, loading, reload } = useAsync(() => api.adminListDeletionRequests(), []);
  const [tab, setTab] = useState<AccountDeletionRequest['status']>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function complete(id: string) {
    setBusy(id);
    try {
      await api.adminCompleteDeletion(id);
      toast('انحذف الحساب ✓');
      setConfirm(null);
      await reload();
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const list = (data ?? []).filter((r) => r.status === tab);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <Text variant="muted" style={{ lineHeight: 24 }}>
        اللاعب يطلب الحذف من «حسابي». احذف حسابه خلال 30 يوم من الطلب. إذا رجع دخل لحسابه قبلها، الطلب ينلغي تلقائياً.
      </Text>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'بانتظار الحذف' },
          { value: 'cancelled', label: 'انلغت' },
          { value: 'done', label: 'انحذفت' },
        ]}
      />
      {loading && !data ? <Loading /> : null}
      {data && list.length === 0 ? <Empty title="ماكو طلبات هنا" icon="trash-outline" /> : null}
      {list.map((r) => {
        const days = Math.ceil((new Date(r.due_at).getTime() - now) / DAY);
        return (
          <View key={r.id} style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{r.player_name}</Text>
              <Badge label={LABEL[r.status]} tone={r.status === 'pending' ? 'yellow' : r.status === 'done' ? 'gray' : 'green'} />
            </Row>
            <Text variant="small" style={{ color: c.muted }}>
              {r.public_id ? `ID ${r.public_id} · ` : ''}طلب بـ {formatFullDate(new Date(r.requested_at))}
            </Text>
            {r.status === 'pending' ? (
              <>
                <Text style={{ color: days <= 3 ? c.danger : c.text, fontFamily: fonts.semibold }}>
                  {days <= 0 ? 'خلصت المدة — لازم ينحذف هسه' : `باقي ${days} يوم للحذف (${formatFullDate(new Date(r.due_at))})`}
                </Text>
                {confirm === r.id ? (
                  <Row style={{ flexWrap: 'nowrap' }}>
                    <Button title="إي، احذف نهائياً" variant="danger" loading={busy === r.id} onPress={() => void complete(r.id)} style={{ flex: 1 }} />
                    <Button title="لا" variant="ghost" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                  </Row>
                ) : (
                  <Button title="احذف الحساب" icon="trash-outline" variant="outline" onPress={() => setConfirm(r.id)} />
                )}
              </>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
