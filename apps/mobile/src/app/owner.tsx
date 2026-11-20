import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { RevenueView } from '../components/RevenueView';
import { useToast } from '../components/feedback';
import { Button, Chip, Empty, ErrorText, Loading, Text } from '../components/ui';
import { api } from '../lib/api';
import { formatClock, formatFormat, formatHour, weekdayName } from '../lib/format';
import { summarize } from '../lib/revenue';
import { errMsg, useAsync } from '../lib/session';
import { nextDays } from '../lib/slots';
import type { Venue } from '../lib/types';
import { fonts, themed, useColors } from '../theme';

const TABS = [
  { key: 'bookings', label: 'الحجوزات' },
  { key: 'blocks', label: 'الأوقات المحجوبة' },
  { key: 'revenue', label: 'الأرباح' },
] as const;

/** صاحب الملعب: حجوزات ملاعبه، يحجب أوقات (صيانة، حجز خارجي)، وأرباحه */
export default function OwnerScreen() {
  const c = useColors();
  const st = useStyles();
  const venues = useAsync(() => api.listOwnedVenues(), []);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('bookings');
  const [venueId, setVenueId] = useState<string | null>(null);

  if (venues.loading && !venues.data) return <Loading />;
  const list = venues.data ?? [];
  if (!list.length) return <Empty title="ماكو ملاعب باسمك" hint="الإدارة تربط الملعب برقمك (ID) من لوحة التحكم" icon="business-outline" />;
  const venue = list.find((v) => v.id === venueId) ?? list[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      {list.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {list.map((v) => (
            <Chip key={v.id} label={v.name} active={v.id === venue.id} onPress={() => setVenueId(v.id)} />
          ))}
        </ScrollView>
      ) : (
        <Text style={st.title}>{venue.name}</Text>
      )}
      <View style={st.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[st.tab, tab === t.key && st.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
            <Text style={[st.tabText, tab === t.key && { color: '#fff' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'bookings' ? <Bookings venue={venue} /> : tab === 'blocks' ? <Blocks venue={venue} /> : <Revenue venue={venue} />}
    </ScrollView>
  );
}

function Bookings({ venue }: { venue: Venue }) {
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const [range] = useState(() => ({ from: new Date(Date.now() - 3600_000).toISOString(), to: new Date(Date.now() + 14 * 86400000).toISOString() }));
  const { data, loading, reload } = useAsync(() => api.ownerListMatches(range.from, range.to), [range.from, range.to]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const mine = (data ?? []).filter((m) => m.venue_id === venue.id);
  if (loading && !data) return <Loading />;
  if (!mine.length) return <Text variant="muted">ماكو حجوزات بأول أسبوعين.</Text>;
  const label = (iso: string) => `${weekdayName(new Date(iso))} ${new Date(iso).getDate()}`;
  return (
    <View style={{ gap: 8 }}>
      {mine.map((m, i) => {
        const dayLabel = label(m.starts_at);
        const header = i === 0 || label(mine[i - 1].starts_at) !== dayLabel ? dayLabel : null;
        return (
          <View key={m.id} style={{ gap: 6 }}>
            {header ? <Text style={st.dayHead}>{header}</Text> : null}
            <Pressable onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })} style={st.item} accessibilityRole="button">
              <Text style={st.time}>{formatClock(m.starts_at)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold }}>{m.field_name ?? 'الساحة'} · {formatFormat(m.players_per_side)}</Text>
                <Text variant="small" style={{ color: c.muted }}>{m.joined_count} من {m.max_players} لاعب</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={c.muted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function Blocks({ venue }: { venue: Venue }) {
  const c = useColors();
  const st = useStyles();
  const toast = useToast();
  const { data, reload } = useAsync(() => api.listBlocks([venue.id]), [venue.id]);
  const days = useMemo(() => nextDays(14), []);
  const [fieldId, setFieldId] = useState(venue.fields[0]?.id ?? '');
  const [dayIdx, setDayIdx] = useState(0);
  const field = venue.fields.find((f) => f.id === fieldId) ?? venue.fields[0];
  const hours = field ? Array.from({ length: Math.max(0, field.close_hour - field.open_hour) }, (_, i) => field.open_hour + i) : [];
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!field || from === null || to === null) return setError('اختار الساحة واليوم ومن ساعة لساعة');
    if (to <= from) return setError('ساعة النهاية لازم بعد البداية');
    const start = new Date(days[dayIdx]);
    start.setHours(from, 0, 0, 0);
    const end = new Date(days[dayIdx]);
    end.setHours(to, 0, 0, 0);
    setBusy(true);
    setError(null);
    try {
      await api.addBlock(field.id, start.toISOString(), end.toISOString(), reason);
      toast('انحجب الوقت ✓ ما راح تنزل مباراة بيه');
      setFrom(null);
      setTo(null);
      setReason('');
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={st.card}>
        <Text style={st.h}>احجب وقت</Text>
        <Text variant="small" style={{ color: c.muted }}>للصيانة أو حجز من برّا التطبيق. الوقت المحجوب ما ينعرض بإنشاء المباريات.</Text>
        {venue.fields.length > 1 ? (
          <View style={st.wrap}>
            {venue.fields.map((f) => (
              <Chip key={f.id} label={f.name} active={f.id === field?.id} onPress={() => setFieldId(f.id)} />
            ))}
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {days.map((d, i) => (
            <Chip key={d.toISOString()} label={`${weekdayName(d)} ${d.getDate()}`} active={i === dayIdx} onPress={() => setDayIdx(i)} />
          ))}
        </ScrollView>
        <Text variant="small">من</Text>
        <View style={st.wrap}>
          {hours.map((h) => (
            <Chip key={h} label={formatHour(h)} active={from === h} onPress={() => setFrom(h)} />
          ))}
        </View>
        <Text variant="small">لحد</Text>
        <View style={st.wrap}>
          {hours.map((h) => h + 1).filter((h) => from === null || h > from).map((h) => (
            <Chip key={h} label={formatHour(h)} active={to === h} onPress={() => setTo(h)} />
          ))}
        </View>
        <TextInput value={reason} onChangeText={setReason} placeholder="السبب (اختياري): صيانة، حجز خارجي…" placeholderTextColor={c.muted} style={st.input} maxLength={60} />
        <ErrorText message={error} />
        <Button title="احجب" icon="lock-closed-outline" loading={busy} onPress={add} />
      </View>

      <Text style={st.h}>الأوقات المحجوبة</Text>
      {data && data.length === 0 ? <Text variant="muted">ماكو أوقات محجوبة.</Text> : null}
      {data?.map((b) => {
        const s = new Date(b.starts_at);
        return (
          <View key={b.id} style={st.item}>
            <Ionicons name="lock-closed" size={18} color={c.warnText} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold }}>
                {weekdayName(s)} {s.getDate()} · {formatClock(b.starts_at)} لـ {formatClock(b.ends_at)}
              </Text>
              <Text variant="small" style={{ color: c.muted }}>{b.field_name}{b.reason ? ` · ${b.reason}` : ''}</Text>
            </View>
            <Pressable onPress={() => api.removeBlock(b.id).then(() => { toast('رجع الوقت متاح'); return reload(); }, (e) => toast(errMsg(e)))} hitSlop={8} accessibilityRole="button" accessibilityLabel="شيل الحجب">
              <Ionicons name="close-circle-outline" size={22} color={c.muted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function Revenue({ venue }: { venue: Venue }) {
  const [range] = useState(() => ({ from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() }));
  const { data, loading } = useAsync(() => api.ownerListMatches(range.from, range.to), [range.from, range.to]);
  const s = useMemo(() => (data ? summarize(data.filter((m) => m.venue_id === venue.id)) : null), [data, venue.id]);
  if (loading && !s) return <Loading />;
  return s ? (
    <View style={{ gap: 8 }}>
      <Text variant="small">آخر 30 يوم</Text>
      <RevenueView s={s} showVenues={false} />
    </View>
  ) : null;
}

const useStyles = themed((c) => ({
  page: { padding: 16, gap: 12, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 32 },
  tabs: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: c.primary },
  tabText: { fontFamily: fonts.bold, fontSize: 13, color: c.muted },
  dayHead: { fontFamily: fonts.bold, color: c.muted, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 12 },
  time: { fontFamily: fonts.bold, color: c.primary, minWidth: 64 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
  h: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, color: c.text, fontSize: 15, backgroundColor: c.bg, outlineWidth: 0 },
}));
