import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Badge, Card, Chip, Empty, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { formatFormat, formatIQD } from '../../lib/format';
import { useAsync } from '../../lib/session';

export default function Venues() {
  const router = useRouter();
  const { data, error, loading } = useAsync(() => api.listVenues(), []);
  const [city, setCity] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);

  const cities = useMemo(() => Array.from(new Set((data ?? []).map((v) => v.city))), [data]);
  const sizes = useMemo(() => Array.from(new Set((data ?? []).flatMap((v) => v.fields.map((f) => f.players_per_side)))).sort(), [data]);
  const list = (data ?? []).filter((v) => (!city || v.city === city) && (!size || v.fields.some((f) => f.players_per_side === size)));

  return (
    <Screen>
      <Row>
        <Chip label="كل المدن" active={!city} onPress={() => setCity(null)} />
        {cities.map((c) => (
          <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
        ))}
      </Row>
      <Row>
        <Chip label="كل الأحجام" active={!size} onPress={() => setSize(null)} />
        {sizes.map((s) => (
          <Chip key={s} label={formatFormat(s)} active={size === s} onPress={() => setSize(s)} />
        ))}
      </Row>
      <ErrorText message={error} />
      {loading ? <Loading /> : null}
      {!loading && list.length === 0 ? <Empty title="لا توجد ساحات مطابقة" /> : null}
      {list.map((v) => {
        const minPrice = Math.min(...v.fields.map((f) => f.default_price));
        return (
          <Card key={v.id} onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="h2">{v.name}</Text>
              {v.is_verified ? <Badge label="✓ موثّقة" /> : null}
            </Row>
            <Text variant="muted">📍 {v.city}{v.address ? ` · ${v.address}` : ''}</Text>
            <Row>
              {v.fields.map((f) => (
                <Badge key={f.id} label={`${f.name} · ${formatFormat(f.players_per_side)}`} tone="gray" />
              ))}
            </Row>
            {Number.isFinite(minPrice) ? <Text style={{ fontFamily: 'Cairo_700Bold' }}>من {formatIQD(minPrice)} / ساعة</Text> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
