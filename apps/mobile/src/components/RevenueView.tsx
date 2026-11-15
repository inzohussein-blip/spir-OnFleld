import { View } from 'react-native';
import { formatIQD, formatNumber } from '../lib/format';
import type { RevenueSummary } from '../lib/revenue';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

const WEEK: [number, string][] = [
  [6, 'سبت'],
  [0, 'أحد'],
  [1, 'اثنين'],
  [2, 'ثلاثاء'],
  [3, 'أربعاء'],
  [4, 'خميس'],
  [5, 'جمعة'],
];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 10); // 10 الصبح لـ 11 بالليل

/** عرض ملخص الأرباح: أرقام، أعمدة الأيام، الملاعب، وخريطة امتلاء الساعات */
export function RevenueView({ s, showVenues = true }: { s: RevenueSummary; showVenues?: boolean }) {
  const c = useColors();
  const st = useStyles();
  const maxDay = Math.max(1, ...s.byDay.map((d) => d.revenue));
  const heatColor = (v: number | null) => (v === null ? c.cardAlt : v >= 0.85 ? '#167A43' : v >= 0.6 ? '#22A559' : v >= 0.35 ? '#F59E0B' : '#E5484D');

  return (
    <View style={{ gap: 14 }}>
      <View style={st.tiles}>
        <Tile label="المدخول" value={formatIQD(s.revenue)} strong />
        <Tile label="المباريات" value={formatNumber(s.matches)} />
        <Tile label="اللاعبين" value={formatNumber(s.players)} />
        <Tile label="متوسط الامتلاء" value={`${Math.round(s.fill * 100)}%`} />
        <Tile label="غياب" value={`${s.noShows} · ${formatIQD(s.noShowFines)}`} />
        <Tile label="خصومات العروض" value={formatIQD(s.discountGiven)} />
      </View>

      <View style={st.card}>
        <Text style={st.h}>المدخول بالأيام</Text>
        {s.byDay.length === 0 ? <Text variant="muted">ماكو مباريات خلصت بهاي الفترة.</Text> : null}
        <View style={st.bars}>
          {s.byDay.map((d) => (
            <View key={d.key} style={st.barCol} accessibilityLabel={`${d.key}: ${formatIQD(d.revenue)}`}>
              <View style={[st.bar, { height: Math.max(4, (d.revenue / maxDay) * 120) }]} />
              <Text style={st.barLabel}>{Number(d.key.slice(8))}</Text>
            </View>
          ))}
        </View>
      </View>

      {showVenues && s.byVenue.length ? (
        <View style={st.card}>
          <Text style={st.h}>حسب الملعب</Text>
          {s.byVenue.map((v) => (
            <View key={v.name} style={st.venueRow}>
              <Text style={{ flex: 1, fontFamily: fonts.bold }}>{v.name}</Text>
              <Text variant="small" style={{ color: c.muted }}>{v.matches} مباراة · امتلاء {Math.round(v.fill * 100)}%</Text>
              <Text style={{ fontFamily: fonts.bold, color: c.primary, minWidth: 96, textAlign: 'left' }}>{formatIQD(v.revenue)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={st.card}>
        <Text style={st.h}>امتلاء الساعات</Text>
        <Text variant="small" style={{ color: c.muted }}>الأحمر = ساعات فارغة تستاهل عرض خصم، والأخضر الغامق = مليانة.</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <View style={{ width: 34 }} />
          {WEEK.map(([, l]) => (
            <Text key={l} style={st.heatHead}>{l}</Text>
          ))}
        </View>
        {HOURS.map((h) => (
          <View key={h} style={{ flexDirection: 'row', gap: 3 }}>
            <Text style={st.heatHour}>{h > 12 ? h - 12 : h}{h >= 12 ? 'م' : 'ص'}</Text>
            {WEEK.map(([d]) => {
              const v = s.heat[d][h];
              return <View key={d} style={[st.heatCell, { backgroundColor: heatColor(v) }]} accessibilityLabel={v === null ? 'ماكو' : `${Math.round(v * 100)}%`} />;
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View style={[st.tile, strong && { backgroundColor: c.primary, borderColor: c.primary }]}>
      <Text variant="small" style={{ color: strong ? 'rgba(255,255,255,0.85)' : c.muted }}>{label}</Text>
      <Text style={[st.tileValue, strong && { color: '#fff' }]}>{value}</Text>
    </View>
  );
}

const useStyles = themed((c) => ({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, minWidth: 150, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 12 },
  tileValue: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
  h: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: 140 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 34 },
  bar: { width: '100%', backgroundColor: c.primary, borderRadius: 6 },
  barLabel: { fontSize: 10, color: c.muted },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border },
  heatHead: { flex: 1, textAlign: 'center', fontSize: 10, color: c.muted },
  heatHour: { width: 34, fontSize: 10, color: c.muted, lineHeight: 18 },
  heatCell: { flex: 1, height: 18, borderRadius: 4 },
}));
