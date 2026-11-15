import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatIQD } from '../lib/format';
import { activeFilterCount, EMPTY_FILTERS, PRICE_CAPS, TIME_LABEL, type MatchFilters, type TimeOfDay } from '../lib/filters';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

/** شريط الفلاتر بالرئيسية: زر «فلترة» يفتح الخيارات، و«المفضلة» دائماً ظاهرة */
export function FilterBar({ value, onChange, formats, areas }: { value: MatchFilters; onChange: (f: MatchFilters) => void; formats: number[]; areas: string[] }) {
  const c = useColors();
  const st = useStyles();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount({ ...value, favOnly: false });
  const set = (p: Partial<MatchFilters>) => onChange({ ...value, ...p });

  return (
    <View style={{ gap: 8 }}>
      <View style={st.row}>
        <Pressable onPress={() => setOpen(!open)} style={[st.chip, (open || count > 0) && st.on]} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="فلترة المباريات">
          <Ionicons name="options-outline" size={15} color={open || count ? '#fff' : c.text} />
          <Text style={[st.chipText, (open || count > 0) && st.onText]}>فلترة{count ? ` (${count})` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => set({ favOnly: !value.favOnly })} style={[st.chip, value.favOnly && st.fav]} accessibilityRole="button" accessibilityState={{ selected: value.favOnly }}>
          <Ionicons name={value.favOnly ? 'star' : 'star-outline'} size={15} color={value.favOnly ? '#7A5B00' : c.text} />
          <Text style={[st.chipText, value.favOnly && { color: '#7A5B00' }]}>ملاعبي المفضلة</Text>
        </Pressable>
        {count || value.favOnly ? (
          <Pressable onPress={() => onChange(EMPTY_FILTERS)} hitSlop={6} accessibilityRole="button" accessibilityLabel="امسح الفلاتر" style={st.clear}>
            <Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 12 }}>مسح</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={st.panel}>
          <Group title="نوع المباراة">
            {formats.map((n) => {
              const on = value.formats.includes(n);
              return <Opt key={n} label={`${n} × ${n}`} on={on} onPress={() => set({ formats: on ? value.formats.filter((x) => x !== n) : [...value.formats, n] })} />;
            })}
          </Group>
          <Group title="الوقت">
            {(Object.keys(TIME_LABEL) as TimeOfDay[]).map((t) => (
              <Opt key={t} label={TIME_LABEL[t]} on={value.time === t} onPress={() => set({ time: value.time === t ? null : t })} />
            ))}
          </Group>
          <Group title="السعر">
            {PRICE_CAPS.map((p) => (
              <Opt key={p} label={`لحد ${formatIQD(p)}`} on={value.maxPrice === p} onPress={() => set({ maxPrice: value.maxPrice === p ? null : p })} />
            ))}
          </Group>
          {areas.length > 1 ? (
            <Group title="المنطقة">
              {areas.map((a) => (
                <Opt key={a} label={a} on={value.area === a} onPress={() => set({ area: value.area === a ? null : a })} />
              ))}
            </Group>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const st = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.groupTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function Opt({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const st = useStyles();
  return (
    <Pressable onPress={onPress} style={[st.opt, on && st.on]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[st.chipText, on && st.onText]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = themed((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  on: { backgroundColor: c.primary, borderColor: c.primary },
  onText: { color: '#fff', fontFamily: fonts.bold },
  fav: { backgroundColor: '#FFE58A', borderColor: '#F5C431' },
  chipText: { fontSize: 12.5, lineHeight: 20, fontFamily: fonts.semibold, color: c.text },
  clear: { marginStart: 'auto', paddingHorizontal: 4 },
  panel: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 12, gap: 10 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 12, color: c.muted },
  opt: { height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
}));
