import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { CaptainPledge } from '../../components/CaptainPledge';
import { useToast } from '../../components/feedback';
import { Button, Chip, ErrorText, Input, Loading, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatHour, weekdayName } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import { nextDays } from '../../lib/slots';
import { smallestSizeFor } from '../../lib/teams';
import { fonts, useColors } from '../../theme';

const HOURS = [16, 17, 18, 19, 20, 21, 22, 23];
const SIZES = [5, 6, 7, 8, 11];
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** القائد يطلب من الإدارة مباراة للفريق كامل */
export default function TeamSuggest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const toast = useToast();
  const days = useMemo(() => nextDays(7), []);
  const team = useAsync(() => api.getTeam(id), [id]);
  const venues = useAsync(() => api.listVenues(), [], { cacheKey: 'venues' });

  const [venueId, setVenueId] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [dayIdx, setDayIdx] = useState(1);
  const [hour, setHour] = useState(20);
  const [size, setSize] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (team.loading && !team.data) return <Loading />;
  const t = team.data;
  if (!t) return <Text variant="muted" style={{ padding: 16 }}>الفريق مو موجود</Text>;
  const members = t.members.length;
  const perSide = size ?? smallestSizeFor(members, SIZES);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.suggestTeamMatch(id, {
        venue_id: venueId,
        venue_text: venueId ? null : other.trim() || null,
        day: isoDay(days[dayIdx]),
        hour,
        players_per_side: perSide,
        note: note.trim() || null,
      });
      toast('وصل طلبك للإدارة 👍 إذا نزّلوا المباراة كل الفريق ينضاف لها');
      router.back();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text variant="muted">
        تطلب مباراة لفريق «{t.name}» ({members} لاعب). إذا الإدارة نزّلتها، كل لاعبين الفريق ينضافون لها تلقائياً.
      </Text>

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

      <Text style={{ fontFamily: fonts.bold }}>حجم المباراة</Text>
      <Row>
        {SIZES.filter((n) => n * 2 >= members).map((n) => (
          <Chip key={n} label={formatFormat(n)} active={perSide === n} onPress={() => setSize(n)} />
        ))}
      </Row>

      <Input label="ملاحظة (اختياري)" placeholder="مثلاً: نريد نلعب ضد فريق ثاني" value={note} onChangeText={setNote} maxLength={300} multiline />
      <CaptainPledge value={pledge} onChange={setPledge} />
      <ErrorText message={error} />
      <Button title="دز الطلب للإدارة" icon="paper-plane-outline" loading={busy} disabled={!pledge} onPress={submit} />
    </ScrollView>
  );
}
