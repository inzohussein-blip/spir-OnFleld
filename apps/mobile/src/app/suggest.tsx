import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '../components/feedback';
import { Badge, Button, Chip, ErrorText, Input, Row, Text } from '../components/ui';
import { api } from '../lib/api';
import { formatFormat, formatHour, weekdayName } from '../lib/format';
import { errMsg, useAsync } from '../lib/session';
import { nextDays } from '../lib/slots';
import type { SuggestionStatus } from '../lib/types';
import { fonts, useColors } from '../theme';

const HOURS = [16, 17, 18, 19, 20, 21, 22, 23];
const SIZES = [5, 6, 7, 8, 11];
const STATUS: Record<SuggestionStatus, { label: string; tone: 'yellow' | 'green' | 'gray' }> = {
  pending: { label: 'بانتظار الإدارة', tone: 'yellow' },
  scheduled: { label: 'صارت مباراة ✓', tone: 'green' },
  rejected: { label: 'ما تمّت', tone: 'gray' },
};

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** اقتراح مباراة على الإدارة — الإنشاء نفسه من لوحة التحكم */
export default function Suggest() {
  const c = useColors();
  const toast = useToast();
  const params = useLocalSearchParams<{ venue?: string }>();
  const days = useMemo(() => nextDays(7), []);
  const venues = useAsync(() => api.listVenues(), [], { cacheKey: 'venues' });
  const mine = useAsync(() => api.listMySuggestions(), []);

  const [venueId, setVenueId] = useState<string | null>(params.venue ?? null);
  const [other, setOther] = useState('');
  const [dayIdx, setDayIdx] = useState(1);
  const [hour, setHour] = useState(20);
  const [size, setSize] = useState(5);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.suggestMatch({
        venue_id: venueId,
        venue_text: venueId ? null : other.trim() || null,
        day: isoDay(days[dayIdx]),
        hour,
        players_per_side: size,
        note: note.trim() || null,
      });
      setNote('');
      toast('وصل اقتراحك للإدارة 👍 راح نبلّغك إذا صار مباراة');
      await mine.reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text variant="muted">ما لكيت مباراة تناسبك؟ اقترح وحدة، والإدارة تنزّلها إذا اكتمل الطلب.</Text>

      <Text style={{ fontFamily: fonts.bold }}>الملعب</Text>
      <Row>
        {(venues.data ?? []).map((v) => (
          <Chip key={v.id} label={v.name} active={venueId === v.id} onPress={() => setVenueId(v.id)} />
        ))}
        <Chip label="ملعب ثاني" active={venueId === null} onPress={() => setVenueId(null)} />
      </Row>
      {venueId === null ? <Input placeholder="اسم الملعب أو المنطقة" value={other} onChangeText={setOther} /> : null}

      <Text style={{ fontFamily: fonts.bold }}>اليوم</Text>
      <Row>
        {days.map((d, i) => (
          <Chip key={d.toISOString()} label={i === 0 ? 'اليوم' : `${weekdayName(d)} ${d.getDate()}`} active={dayIdx === i} onPress={() => setDayIdx(i)} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>الوقت</Text>
      <Row>
        {HOURS.map((h) => (
          <Chip key={h} label={formatHour(h)} active={hour === h} onPress={() => setHour(h)} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>عدد اللاعبين</Text>
      <Row>
        {SIZES.map((n) => (
          <Chip key={n} label={formatFormat(n)} active={size === n} onPress={() => setSize(n)} />
        ))}
      </Row>

      <Input label="ملاحظة (اختياري)" placeholder="مثلاً: عدنا 6 لاعبين جاهزين" value={note} onChangeText={setNote} maxLength={300} multiline />
      <ErrorText message={error} />
      <Button title="أرسل الاقتراح" icon="paper-plane-outline" loading={busy} onPress={submit} />

      {mine.data?.length ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>اقتراحاتي</Text>
          {mine.data.map((s) => (
            <View key={s.id} style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 12, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.semibold }}>{s.venue_name ?? 'ملعب'}</Text>
                <Badge label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
              </Row>
              <Text variant="small" style={{ color: c.muted }}>
                {s.day} · {formatHour(s.hour)} · {formatFormat(s.players_per_side)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
