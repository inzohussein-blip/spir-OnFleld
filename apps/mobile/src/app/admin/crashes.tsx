import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useToast } from '../../components/feedback';
import { Badge, Button, Empty, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import type { CrashReport } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

const PLATFORM = { android: 'أندرويد', ios: 'آيفون', web: 'ويب' } as const;

/** تقارير الأعطال: نفس الخطأ يتجمّع بسطر واحد ويّا عدد مرات حدوثه */
export default function AdminCrashes() {
  const c = useColors();
  const st = useStyles();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminListCrashes(), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  // تجميع حسب الرسالة
  const groups = new Map<string, CrashReport[]>();
  for (const r of data ?? []) groups.set(r.message, [...(groups.get(r.message) ?? []), r]);
  const list = [...groups.entries()].sort((a, b) => b[1][0].created_at.localeCompare(a[1][0].created_at));

  if (loading && !data) return <Loading />;
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text variant="small" style={{ color: c.muted }}>
        كل خطأ يصير عند لاعب يوصل هنا ويّا نوع التلفون ورقم النسخة والصفحة. ابدأ بالأكثر تكرار.
      </Text>
      {list.length === 0 ? <Empty title="ماكو أعطال 🎉" hint="ما وصل أي تقرير" icon="shield-checkmark-outline" /> : null}
      {list.map(([message, items]) => {
        const last = items[0];
        const platforms = [...new Set(items.map((i) => i.platform))];
        const versions = [...new Set(items.map((i) => i.app_version).filter(Boolean))];
        return (
          <Pressable key={message} onPress={() => setOpen(open === message ? null : message)} style={st.card} accessibilityRole="button">
            <View style={st.row}>
              <Badge label={`${items.length} مرة`} tone={items.length > 5 ? 'red' : 'yellow'} />
              {platforms.map((p) => (
                <Badge key={p} label={PLATFORM[p]} tone="gray" />
              ))}
              <Text variant="small" style={{ color: c.muted }}>آخر مرة {timeAgo(last.created_at)}</Text>
            </View>
            <Text style={st.msg}>{message}</Text>
            <Text variant="small" style={{ color: c.muted }}>
              {last.screen ? `الصفحة: ${last.screen}` : ''}
              {versions.length ? ` · النسخة ${versions.join('، ')}` : ''}
              {last.user_name ? ` · ${last.user_name}` : ''}
            </Text>
            {open === message && last.stack ? <Text style={st.stack}>{last.stack}</Text> : null}
          </Pressable>
        );
      })}
      {list.length ? (
        confirm ? (
          <View style={st.row}>
            <Button title="إي، امسحها كلها" variant="danger" onPress={() => api.adminClearCrashes().then(() => { setConfirm(false); toast('انمسحت التقارير'); return reload(); }, (e) => toast(errMsg(e)))} />
            <Button title="لا" variant="ghost" onPress={() => setConfirm(false)} />
          </View>
        ) : (
          <Button title="امسح كل التقارير (بعد التصليح)" icon="trash-outline" variant="ghost" onPress={() => setConfirm(true)} />
        )
      ) : null}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 20, gap: 12, maxWidth: 900, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  msg: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24, writingDirection: 'ltr', textAlign: 'left' },
  stack: { fontSize: 11.5, lineHeight: 17, color: c.muted, writingDirection: 'ltr', textAlign: 'left', backgroundColor: c.cardAlt, borderRadius: 10, padding: 10 },
}));
