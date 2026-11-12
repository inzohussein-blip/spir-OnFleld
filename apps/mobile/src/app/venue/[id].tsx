import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Badge, Button, Card, Chip, ErrorText, Input, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDay, formatFormat, formatHour, formatIQD, SKILL_LABEL } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import { computeSlots, nextDays, type BusyRange } from '../../lib/slots';
import type { SkillLevel } from '../../lib/types';
import { fonts, themed, useColors } from '../../theme';

const LEVELS: SkillLevel[] = ['open', 'beginner', 'intermediate', 'advanced'];

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = useStyles();
  const { data: venue, loading, error } = useAsync(() => api.getVenue(id), [id]);

  const days = useMemo(() => nextDays(7), []);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [perSideChoice, setPerSideChoice] = useState<number | null>(null);
  const [level, setLevel] = useState<SkillLevel>('open');
  const [isPublic, setIsPublic] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const field = venue?.fields.find((f) => f.id === fieldId) ?? venue?.fields[0] ?? null;

  // الافتراضي: حجم الملعب المختار، ما لم يغيّره المستخدم
  const perSide = perSideChoice ?? field?.players_per_side ?? 5;
  const fieldKey = field?.id;
  const day = days[dayIdx];

  useEffect(() => {
    if (!fieldKey) return;
    let alive = true;
    api
      .getBusy(fieldKey, day)
      .then((b) => alive && setBusy(b))
      .catch(() => alive && setBusy([]));
    return () => {
      alive = false;
    };
  }, [fieldKey, day]);

  const pickField = (id: string) => {
    setFieldId(id);
    setPerSideChoice(null);
    setStartHour(null);
    setHours(1);
  };
  const pickDay = (i: number) => {
    setDayIdx(i);
    setStartHour(null);
    setHours(1);
  };

  const slots = field ? computeSlots(field, days[dayIdx], busy) : [];
  const canExtend = (h: number, n: number) =>
    Array.from({ length: n }, (_, i) => slots.find((s) => s.hour === h + i)).every((s) => s?.available);

  if (loading) return <Loading />;
  if (error || !venue || !field) return <Screen><ErrorText message={error ?? 'الساحة غير موجودة'} /></Screen>;

  const price = field.default_price * hours;
  const perPlayer = Math.ceil(price / (perSide * 2) / 250) * 250;

  async function book() {
    if (startHour === null || !field) return;
    setSaving(true);
    setSaveError(null);
    try {
      const start = new Date(days[dayIdx]);
      start.setHours(startHour, 0, 0, 0);
      const matchId = await api.createMatch({
        field_id: field.id,
        starts_at: start.toISOString(),
        hours,
        players_per_side: perSide,
        skill_level: level,
        visibility: isPublic ? 'public' : 'private',
        title: title.trim() || undefined,
      });
      router.replace({ pathname: '/match/[id]', params: { id: matchId } });
    } catch (e) {
      setSaveError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: venue.name }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="title">{venue.name}</Text>
          {venue.is_verified ? <Badge label="✓ موثّقة" /> : null}
        </Row>
        <Text variant="muted">📍 {venue.city}{venue.address ? ` · ${venue.address}` : ''}</Text>
        <Row>{venue.amenities.map((a) => <Badge key={a} label={a} tone="gray" />)}</Row>
      </Card>

      <Text variant="h2">1. اختر الملعب</Text>
      <Row>
        {venue.fields.map((f) => (
          <Chip key={f.id} label={`${f.name} · ${formatFormat(f.players_per_side)} · ${formatIQD(f.default_price)}`} active={f.id === field.id} onPress={() => pickField(f.id)} />
        ))}
      </Row>
      <Text variant="muted">
        {field.surface ?? ''}{field.is_indoor ? ' · مغطى' : ' · مكشوف'} · يعمل من {formatHour(field.open_hour)} إلى {formatHour(field.close_hour)}
      </Text>

      <Text variant="h2">2. اختر اليوم والساعة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d, i) => (
          <Chip key={d.toISOString()} label={formatDay(d)} active={i === dayIdx} onPress={() => pickDay(i)} />
        ))}
      </ScrollView>
      <View style={styles.grid}>
        {slots.map((s) => {
          const selected = startHour !== null && s.hour >= startHour && s.hour < startHour + hours;
          return (
            <Pressable
              key={s.hour}
              disabled={!s.available}
              onPress={() => {
                setStartHour(s.hour);
                if (!canExtend(s.hour, hours)) setHours(1);
              }}
              style={[styles.slot, !s.available && styles.slotBusy, selected && styles.slotSelected]}
            >
              <Text style={[styles.slotText, !s.available && { color: colors.muted }, selected && { color: colors.onPrimary }]}>{formatHour(s.hour)}</Text>
              <Text variant="small" style={[!s.available && { color: colors.muted }, selected && { color: colors.onPrimary }]}>
                {s.available ? 'متاح' : 'محجوز'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {startHour !== null ? (
        <Row>
          <Text>المدة:</Text>
          {[1, 2, 3].map((n) => (
            <Chip key={n} label={n === 1 ? 'ساعة' : n === 2 ? 'ساعتان' : '3 ساعات'} active={hours === n} onPress={() => canExtend(startHour, n) && setHours(n)} style={!canExtend(startHour, n) ? { opacity: 0.4 } : undefined} />
          ))}
        </Row>
      ) : null}

      <Text variant="h2">3. جهّز المباراة</Text>
      <Text variant="small">عدد اللاعبين لكل فريق</Text>
      <Row>
        {[3, 4, 5, 6, 7, 8, 9, 11].map((n) => (
          <Chip key={n} label={formatFormat(n)} active={perSide === n} onPress={() => setPerSideChoice(n)} />
        ))}
      </Row>
      <Text variant="small">المستوى المطلوب</Text>
      <Row>
        {LEVELS.map((l) => (
          <Chip key={l} label={SKILL_LABEL[l]} active={level === l} onPress={() => setLevel(l)} />
        ))}
      </Row>
      <Row>
        <Chip label="🌍 عامة — يراها الجميع" active={isPublic} onPress={() => setIsPublic(true)} />
        <Chip label="🔒 خاصة — بالدعوة فقط" active={!isPublic} onPress={() => setIsPublic(false)} />
      </Row>
      <Input label="اسم المباراة (اختياري)" placeholder="مثلاً: خماسي الشلة" value={title} onChangeText={setTitle} />

      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text>سعر الحجز</Text>
          <Text style={{ fontFamily: fonts.bold }}>{formatIQD(price)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text>على كل لاعب ({perSide * 2} لاعب)</Text>
          <Text style={{ fontFamily: fonts.bold }}>{formatIQD(perPlayer)}</Text>
        </Row>
        <Text variant="small" style={{ color: colors.muted }}>الدفع نقداً في الساحة.</Text>
      </Card>
      <ErrorText message={saveError} />
      <Button title={startHour === null ? 'اختر ساعة أولاً' : 'احجز وأنشئ المباراة'} disabled={startHour === null} loading={saving} onPress={book} />
    </Screen>
  );
}

const useStyles = themed((colors) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '23%', minWidth: 72, flexGrow: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.card },
  slotBusy: { borderColor: colors.border, backgroundColor: colors.cardAlt },
  slotSelected: { backgroundColor: colors.primary },
  slotText: { fontFamily: fonts.bold, color: colors.primary },
}));
