import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatIQD } from '../lib/format';
import { activeFilterCount, EMPTY_FILTERS, PRICE_CAPS, TIME_LABEL, type MatchFilters, type TimeOfDay } from '../lib/filters';
import { cardRadius, space, themed, type, useColors } from '../theme';
import { Chip, Text } from './ui';

/** شريط الفلاتر بالرئيسية: زر «فلترة» يفتح الخيارات، و«المفضلة» دائماً ظاهرة */
export function FilterBar({ value, onChange, formats, areas }: { value: MatchFilters; onChange: (f: MatchFilters) => void; formats: number[]; areas: string[] }) {
  const c = useColors();
  const st = useStyles();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount({ ...value, favOnly: false });
  const set = (p: Partial<MatchFilters>) => onChange({ ...value, ...p });

  return (
    <View style={{ gap: space.sm }}>
      <View style={st.row}>
        <Chip icon="options-outline" label={`فلترة${count ? ` (${count})` : ''}`} active={open || count > 0} onPress={() => setOpen(!open)} />
        <Chip icon={value.favOnly ? 'star' : 'star-outline'} label="ملاعبي المفضلة" active={value.favOnly} onPress={() => set({ favOnly: !value.favOnly })} />
        {count || value.favOnly ? (
          <Pressable onPress={() => onChange(EMPTY_FILTERS)} hitSlop={8} accessibilityRole="button" accessibilityLabel="امسح الفلاتر" style={st.clear}>
            <Text style={[st.clearText, { color: c.primary }]}>مسح</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={st.panel}>
          <Group title="نوع المباراة">
            {formats.map((n) => {
              const on = value.formats.includes(n);
              return <Chip key={n} label={`${n} × ${n}`} active={on} onPress={() => set({ formats: on ? value.formats.filter((x) => x !== n) : [...value.formats, n] })} />;
            })}
          </Group>
          <Group title="الوقت">
            {(Object.keys(TIME_LABEL) as TimeOfDay[]).map((t) => (
              <Chip key={t} label={TIME_LABEL[t]} active={value.time === t} onPress={() => set({ time: value.time === t ? null : t })} />
            ))}
          </Group>
          <Group title="السعر">
            {PRICE_CAPS.map((p) => (
              <Chip key={p} label={`لحد ${formatIQD(p)}`} active={value.maxPrice === p} onPress={() => set({ maxPrice: value.maxPrice === p ? null : p })} />
            ))}
          </Group>
          {areas.length > 1 ? (
            <Group title="المنطقة">
              {areas.map((a) => (
                <Chip key={a} label={a} active={value.area === a} onPress={() => set({ area: value.area === a ? null : a })} />
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
    <View style={{ gap: space.sm }}>
      <Text style={st.groupTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {children}
      </ScrollView>
    </View>
  );
}

const useStyles = themed((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  clear: { marginStart: 'auto', paddingHorizontal: space.xs, minHeight: 36, justifyContent: 'center' },
  clearText: { ...type.label },
  panel: { backgroundColor: c.card, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, padding: space.md, gap: space.md },
  groupTitle: { ...type.micro, color: c.muted },
}));
