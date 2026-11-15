import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AdBanner } from '../../components/AdBanner';
import { useToast } from '../../components/feedback';
import { Badge, Button, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { AD_STATE_LABEL, AD_TEMPLATE_ORDER, AD_TEMPLATES, adFromTemplate, adState, formatAdDate } from '../../lib/ads';
import { errMsg, useAsync, useNow } from '../../lib/session';
import type { Ad } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

const STATE_TONE = { live: 'green', paused: 'gray', scheduled: 'yellow', ended: 'red' } as const;

/** لوحة التحكم ← الإعلانات: الإعلانات الحالية، وتحتها القوالب الستة لإعلان جديد */
export default function AdminAds() {
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const now = useNow(60_000);
  const { data, loading, reload } = useAsync(() => api.adminListAds(), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      toast(done);
      await reload();
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const sample = (t: Ad['template']): Ad => ({ ...adFromTemplate(t), id: `tpl-${t}`, created_at: '' });

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.head}>
        <Text style={st.h}>الإعلانات ({data?.length ?? 0})</Text>
        <Text variant="small" style={{ color: c.muted }}>تطلع بالرئيسية وتتبدل كل 5 ثواني، بالترتيب من الأصغر للأكبر.</Text>
      </View>
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Text variant="muted">ماكو إعلانات. اختار قالب من تحت.</Text> : null}
      {data?.map((ad) => {
        const state = adState(ad, now);
        return (
          <View key={ad.id} style={st.item} testID={`ad-${ad.id}`}>
            <View style={{ width: 358, maxWidth: '100%' }}>
              <AdBanner ad={ad} now={now} />
            </View>
            <View style={{ flex: 1, minWidth: 240, gap: 8 }}>
              <View style={st.row}>
                <Badge label={AD_STATE_LABEL[state]} tone={STATE_TONE[state]} />
                <Text variant="small" style={{ color: c.muted }}>
                  {AD_TEMPLATES[ad.template].label} · ترتيب {ad.sort}
                </Text>
              </View>
              <Text variant="small" style={{ color: c.muted }}>
                {ad.city ? `مدينة: ${ad.city}` : 'كل المدن'}
                {ad.starts_at ? ` · من ${formatAdDate(ad.starts_at)}` : ''}
                {ad.ends_at ? ` · لحد ${formatAdDate(ad.ends_at)}` : ''}
              </Text>
              <View style={st.row}>
                <Button title="تعديل" icon="create-outline" variant="outline" onPress={() => router.push({ pathname: '/admin/ad-edit', params: { id: ad.id } })} style={st.btn} />
                <Button
                  title={ad.active ? 'إيقاف' : 'تفعيل'}
                  icon={ad.active ? 'pause-outline' : 'play-outline'}
                  variant="ghost"
                  loading={busy === `t-${ad.id}`}
                  onPress={() => run(`t-${ad.id}`, () => api.adminSaveAd({ ...ad, active: !ad.active }), ad.active ? 'توقف الإعلان' : 'رجع الإعلان يطلع ✓')}
                  style={st.btn}
                />
                {confirmDelete === ad.id ? (
                  <>
                    <Button title="إي، احذفه" variant="danger" loading={busy === `d-${ad.id}`} onPress={() => run(`d-${ad.id}`, () => api.adminDeleteAd(ad.id), 'انحذف الإعلان')} style={st.btn} />
                    <Button title="لا" variant="ghost" onPress={() => setConfirmDelete(null)} style={st.btn} />
                  </>
                ) : (
                  <Button title="حذف" icon="trash-outline" variant="ghost" onPress={() => setConfirmDelete(ad.id)} style={st.btn} />
                )}
              </View>
            </View>
          </View>
        );
      })}

      <View style={[st.head, { marginTop: 18 }]}>
        <Text style={st.h}>قوالب الإعلانات</Text>
        <Text variant="small" style={{ color: c.muted }}>اختار قالب، وعدّل النصوص والأرقام والتواريخ قبل النشر. التصميم يبقى ثابت.</Text>
      </View>
      <View style={st.grid}>
        {AD_TEMPLATE_ORDER.map((t) => (
          <Pressable key={t} onPress={() => router.push({ pathname: '/admin/ad-edit', params: { template: t } })} style={st.tpl} accessibilityRole="button" accessibilityLabel={`قالب ${AD_TEMPLATES[t].label}`}>
            <AdBanner ad={sample(t)} now={now} />
            <Text style={st.tplTitle}>{AD_TEMPLATES[t].label}</Text>
            <Text variant="small" style={{ color: c.muted }}>{AD_TEMPLATES[t].hint}</Text>
            <Text style={st.use}>استخدم هذا القالب ←</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 20, gap: 14, maxWidth: 980, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  head: { gap: 2 },
  h: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 30 },
  item: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { minHeight: 40, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tpl: { width: 390, maxWidth: '100%', backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 16, gap: 4 },
  tplTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26, marginTop: 8 },
  use: { color: c.primary, fontFamily: fonts.bold, fontSize: 14, marginTop: 4 },
}));
