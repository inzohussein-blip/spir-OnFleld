import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '../../components/feedback';
import { Badge, Button, Chip, ErrorText, Input, Row, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatHour, formatIQD, SKILL_LABEL, weekdayName } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import { computeSlots, nextDays, type BusyRange } from '../../lib/slots';
import type { SkillLevel } from '../../lib/types';
import { fonts, useColors } from '../../theme';

const LEVELS: SkillLevel[] = ['open', 'beginner', 'intermediate', 'advanced'];
const OPENS: { label: string; hoursBefore: number | null }[] = [
  { label: 'فوراً', hoursBefore: null },
  { label: 'قبل يوم', hoursBefore: 24 },
  { label: 'قبل 12 ساعة', hoursBefore: 12 },
  { label: 'قبل 6 ساعات', hoursBefore: 6 },
];

/** التاريخ المحلي YYYY-MM-DD (بدون تحويل UTC) */
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** نموذج إنشاء مباراة (للإدارة) — يمكن تعبئته من اقتراح لاعب */
export default function NewMatch() {
  const router = useRouter();
  const c = useColors();
  const toast = useToast();
  const params = useLocalSearchParams<{ suggestion?: string }>();
  const days = useMemo(() => nextDays(14), []);
  const venues = useAsync(() => api.listVenues(), []);
  const suggestions = useAsync(() => api.adminListSuggestions(), []);
  const suggestion = (suggestions.data ?? []).find((s) => s.id === params.suggestion) ?? null;

  const [fieldId, setFieldId] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(1);
  const [hour, setHour] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [perSide, setPerSide] = useState(5);
  const [level, setLevel] = useState<SkillLevel>('open');
  const [opensIdx, setOpensIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const allFields = (venues.data ?? []).flatMap((v) => v.fields.map((f) => ({ ...f, venueName: v.name, venueId: v.id })));
  const field = allFields.find((f) => f.id === fieldId) ?? null;
  const day = days[dayIdx];

  // تعبئة من الاقتراح مرة وحدة عند توفر البيانات
  if (suggestion && venues.data && !prefilled) {
    setPrefilled(true);
    const f = allFields.find((x) => x.venueId === suggestion.venue_id) ?? null;
    if (f) setFieldId(f.id);
    const idx = days.findIndex((d) => localDay(d) === suggestion.day);
    if (idx >= 0) setDayIdx(idx);
    setHour(suggestion.hour);
    setPerSide(suggestion.players_per_side);
  }

  useEffect(() => {
    if (!fieldId) return;
    let alive = true;
    api
      .getBusy(fieldId, day)
      .then((b) => alive && setBusy(b))
      .catch(() => alive && setBusy([]));
    return () => {
      alive = false;
    };
  }, [fieldId, day]);

  const slots = field ? computeSlots(field, day, busy) : [];

  async function submit() {
    if (!field || hour === null) return setError('اختار الملعب والساعة');
    setSaving(true);
    setError(null);
    try {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const opens = OPENS[opensIdx].hoursBefore;
      const id = await api.adminCreateMatch({
        field_id: field.id,
        starts_at: start.toISOString(),
        hours,
        players_per_side: perSide,
        skill_level: level,
        visibility: 'public',
        title: title.trim() || undefined,
        registration_opens_at: opens === null ? null : new Date(start.getTime() - opens * 3600_000).toISOString(),
        suggestion_id: suggestion?.id ?? null,
      });
      toast('نزلت المباراة ✓');
      router.replace({ pathname: '/match/[id]', params: { id } });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      {suggestion ? (
        <View style={{ backgroundColor: c.warnSoft, borderRadius: 14, padding: 12, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, color: c.warnText }}>من اقتراح {suggestion.player_name}</Text>
          {suggestion.note ? <Text variant="small" style={{ color: c.warnText }}>{suggestion.note}</Text> : null}
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.bold }}>الملعب</Text>
      <Row>
        {allFields.map((f) => (
          <Chip key={f.id} label={`${f.venueName} · ${f.name} · ${formatFormat(f.players_per_side)}`} active={fieldId === f.id} onPress={() => { setFieldId(f.id); setPerSide(f.players_per_side); setHour(null); }} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>اليوم</Text>
      <Row>
        {days.map((d, i) => (
          <Chip key={d.toISOString()} label={`${weekdayName(d)} ${d.getDate()}`} active={dayIdx === i} onPress={() => { setDayIdx(i); setHour(null); }} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>الساعة</Text>
      {field ? (
        <Row>
          {slots.map((s) => (
            <Chip key={s.hour} label={s.available ? formatHour(s.hour) : `${formatHour(s.hour)} · محجوز`} active={hour === s.hour} onPress={() => s.available && setHour(s.hour)} style={!s.available ? { opacity: 0.4 } : undefined} />
          ))}
        </Row>
      ) : (
        <Text variant="muted">اختار الملعب أولاً</Text>
      )}

      <Text style={{ fontFamily: fonts.bold }}>المدة</Text>
      <Row>
        {[1, 2].map((n) => (
          <Chip key={n} label={n === 1 ? 'ساعة' : 'ساعتين'} active={hours === n} onPress={() => setHours(n)} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>عدد اللاعبين لكل فريق</Text>
      <Row>
        {[3, 4, 5, 6, 7, 8, 9, 11].map((n) => (
          <Chip key={n} label={formatFormat(n)} active={perSide === n} onPress={() => setPerSide(n)} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>المستوى</Text>
      <Row>
        {LEVELS.map((l) => (
          <Chip key={l} label={SKILL_LABEL[l]} active={level === l} onPress={() => setLevel(l)} />
        ))}
      </Row>

      <Text style={{ fontFamily: fonts.bold }}>فتح التسجيل</Text>
      <Row>
        {OPENS.map((o, i) => (
          <Chip key={o.label} label={o.label} active={opensIdx === i} onPress={() => setOpensIdx(i)} />
        ))}
      </Row>

      <Input label="اسم المباراة (اختياري)" placeholder="مثلاً: خماسي الجمعة" value={title} onChangeText={setTitle} />

      {field ? (
        <Row>
          <Badge label={`سعر الحجز ${formatIQD(field.default_price * hours)}`} tone="gray" />
          <Badge label={`على كل لاعب ${formatIQD(Math.ceil((field.default_price * hours) / (perSide * 2) / 250) * 250)}`} />
        </Row>
      ) : null}
      <ErrorText message={error} />
      <Button title="نزّل المباراة" icon="checkmark-circle-outline" loading={saving} disabled={!field || hour === null} onPress={submit} />
    </ScrollView>
  );
}
