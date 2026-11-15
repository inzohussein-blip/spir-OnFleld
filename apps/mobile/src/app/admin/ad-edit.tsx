import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AdBanner } from '../../components/AdBanner';
import { useToast } from '../../components/feedback';
import { Button, Chip, Empty, ErrorText, Input, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { AD_LINKS, AD_TEMPLATE_ORDER, AD_TEMPLATES, adError, adFromTemplate, formatAdDate, parseAdDate } from '../../lib/ads';
import { pickSquareImage } from '../../lib/pickImage';
import { errMsg, useAsync, useNow } from '../../lib/session';
import type { AdInput, AdTemplate, Venue } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

/** إعلان جديد من قالب (?template=) أو تعديل إعلان (?id=) — ويّا معاينة مباشرة */
export default function AdEditScreen() {
  const { id, template } = useLocalSearchParams<{ id?: string; template?: AdTemplate }>();
  const ads = useAsync(() => (id ? api.adminListAds() : Promise.resolve([])), [id]);
  const venues = useAsync(() => api.listVenues(), []);
  if (id && ads.loading && !ads.data) return <Loading />;
  const existing = id ? ads.data?.find((a) => a.id === id) : undefined;
  if (id && !existing) return <Empty title="الإعلان مو موجود" hint="يمكن انحذف" icon="megaphone-outline" />;
  const initial: AdInput = existing ?? adFromTemplate(template && AD_TEMPLATES[template] ? template : 'services');
  return <Editor key={existing?.id ?? template ?? 'new'} initial={initial} venues={venues.data ?? []} isNew={!existing} />;
}

function Editor({ initial, venues, isNew }: { initial: AdInput; venues: Venue[]; isNew: boolean }) {
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const now = useNow(30_000);
  const [ad, setAd] = useState<AdInput>(initial);
  const [starts, setStarts] = useState(() => formatAdDate(initial.starts_at));
  const [ends, setEnds] = useState(() => formatAdDate(initial.ends_at));
  const [countdown, setCountdown] = useState(() => formatAdDate(initial.countdown_to, true));
  const [rating, setRating] = useState(initial.rating === null ? '' : String(initial.rating));
  const [sort, setSort] = useState(String(initial.sort));
  const [busy, setBusy] = useState<'save' | 'image' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const info = AD_TEMPLATES[ad.template];
  const set = <K extends keyof AdInput>(k: K, v: AdInput[K]) => setAd((a) => ({ ...a, [k]: v }));
  const cities = [...new Set(venues.map((v) => v.city))];
  const links = [...AD_LINKS, ...venues.map((v) => ({ value: `/venue/${v.id}`, label: `ملعب: ${v.name}` }))];

  // القيم النهائية (التواريخ والأرقام من حقول النص)
  const startsIso = parseAdDate(starts);
  const endsIso = parseAdDate(ends, true);
  const countdownIso = parseAdDate(countdown, true);
  const ratingNum = rating.trim() ? Number(rating) : null;
  const final: AdInput = {
    ...ad,
    starts_at: startsIso ?? null,
    ends_at: endsIso ?? null,
    countdown_to: info.countdown ? countdownIso ?? null : null,
    rating: info.rating && ratingNum !== null && Number.isFinite(ratingNum) ? ratingNum : null,
    badge: info.badgeLabel ? ad.badge?.trim() || null : null,
    image_url: info.image ? ad.image_url : null,
    sort: Number.parseInt(sort, 10) || 0,
    cta: ad.cta?.trim() || null,
  };

  async function save() {
    if (startsIso === undefined || endsIso === undefined || (info.countdown && countdownIso === undefined)) {
      return setError('اكتب التاريخ هيج: 2026-11-20 (والوقت اختياري: 2026-11-20 21:30)');
    }
    if (info.rating && rating.trim() && !Number.isFinite(ratingNum)) return setError('التقييم رقم مثل 4.8');
    const err = adError(final);
    if (err) return setError(err);
    setBusy('save');
    setError(null);
    try {
      await api.adminSaveAd(final);
      toast(isNew ? 'انضاف الإعلان ✓' : 'انحفظ الإعلان ✓');
      router.back();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function upload() {
    try {
      const uri = await pickSquareImage([16, 9]);
      if (!uri) return;
      setBusy('image');
      set('image_url', await api.adminUploadAdImage(uri));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'إعلان جديد' : 'تعديل الإعلان' }} />
      <View style={st.preview}>
        <Text variant="small" style={{ color: c.muted }}>المعاينة — هيج يطلع بالرئيسية</Text>
        <View style={{ width: 358, maxWidth: '100%' }}>
          <AdBanner ad={{ ...final, id: 'preview', created_at: '' }} now={now} />
        </View>
      </View>

      <Section title="القالب">
        <View style={st.chips}>
          {AD_TEMPLATE_ORDER.map((t) => (
            <Chip key={t} label={AD_TEMPLATES[t].label} active={ad.template === t} onPress={() => set('template', t)} />
          ))}
        </View>
        <Text variant="small" style={{ color: c.muted }}>{info.hint}</Text>
      </Section>

      <Section title="النصوص">
        <Input label="الكلمة الصغيرة فوق العنوان" value={ad.eyebrow} onChangeText={(v) => set('eyebrow', v)} maxLength={30} />
        <Input label="العنوان" value={ad.title} onChangeText={(v) => set('title', v)} maxLength={40} />
        <Input label="السطر الثاني" value={ad.body} onChangeText={(v) => set('body', v)} maxLength={70} />
        <Input label="نص الزر (اتركه فارغ بدون زر)" value={ad.cta ?? ''} onChangeText={(v) => set('cta', v)} maxLength={24} />
        {info.badgeLabel ? <Input label={info.badgeLabel} value={ad.badge ?? ''} onChangeText={(v) => set('badge', v)} maxLength={6} /> : null}
        {info.countdown ? <Input label="العد التنازلي لحد (مثلاً 2026-11-20 21:00)" value={countdown} onChangeText={setCountdown} placeholder="2026-11-20 21:00" /> : null}
        {info.rating ? <Input label="التقييم (من 5)" value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="4.8" /> : null}
        {info.image ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={ad.image_url ? 'غيّر صورة الملعب' : 'ارفع صورة الملعب'} icon="image-outline" variant="outline" loading={busy === 'image'} onPress={upload} />
            {ad.image_url ? <Button title="بدون صورة (ساحة خضراء)" variant="ghost" onPress={() => set('image_url', null)} /> : null}
          </View>
        ) : null}
      </Section>

      <Section title="وين يودي الزر">
        <View style={st.chips}>
          {links.map((l) => (
            <Chip key={l.value ?? 'none'} label={l.label} active={ad.link === l.value} onPress={() => set('link', l.value)} />
          ))}
        </View>
      </Section>

      <Section title="منو يشوفه، ومتى">
        <View style={st.chips}>
          <Chip label="كل المدن" active={!ad.city} onPress={() => set('city', null)} />
          {cities.map((city) => (
            <Chip key={city} label={city} active={ad.city === city} onPress={() => set('city', city)} />
          ))}
        </View>
        <View style={st.two}>
          <View style={{ flex: 1 }}>
            <Input label="يبدأ من (فارغ = هسه)" value={starts} onChangeText={setStarts} placeholder="2026-11-20" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="ينتهي بـ (فارغ = بدون نهاية)" value={ends} onChangeText={setEnds} placeholder="2026-12-31" />
          </View>
        </View>
        <View style={st.two}>
          <View style={{ flex: 1 }}>
            <Input label="الترتيب (الأصغر يطلع أول)" value={sort} onChangeText={setSort} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="small">الحالة</Text>
            <View style={st.chips}>
              <Chip label="يطلع" active={ad.active} onPress={() => set('active', true)} />
              <Chip label="متوقف" active={!ad.active} onPress={() => set('active', false)} />
            </View>
          </View>
        </View>
      </Section>

      <ErrorText message={error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title={isNew ? 'انشر الإعلان' : 'احفظ'} icon="checkmark" loading={busy === 'save'} onPress={save} style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} style={st.cancel} accessibilityRole="button">
          <Text style={{ color: c.muted, fontFamily: fonts.bold }}>إلغاء</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const st = useStyles();
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const useStyles = themed((c) => ({
  page: { padding: 20, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  preview: { gap: 8, alignItems: 'center', backgroundColor: c.cardAlt, borderRadius: 20, padding: 16 },
  section: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 16, gap: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  two: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  cancel: { paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
}));
