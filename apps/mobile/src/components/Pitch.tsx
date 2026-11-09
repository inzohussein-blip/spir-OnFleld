import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { PitchSlot, TeamOfWeekEntry } from '../lib/types';
import { MiniCard } from './PlayerCardView';

// مواقع المراكز على أرضية الملعب (نسبة مئوية من العرض/الارتفاع) — تشكيلة 4-3-3
const POS: Record<Exclude<PitchSlot, 'SUB1' | 'SUB2'>, { x: number; y: number; label: string }> = {
  LW: { x: 14, y: 6, label: 'جناح' },
  ST: { x: 50, y: 2, label: 'مهاجم' },
  RW: { x: 86, y: 6, label: 'جناح' },
  CM1: { x: 18, y: 31, label: 'وسط' },
  CM2: { x: 50, y: 28, label: 'وسط' },
  CM3: { x: 82, y: 31, label: 'وسط' },
  LB: { x: 11, y: 56, label: 'ظهير' },
  CB1: { x: 36, y: 58, label: 'قلب دفاع' },
  CB2: { x: 64, y: 58, label: 'قلب دفاع' },
  RB: { x: 89, y: 56, label: 'ظهير' },
  GK: { x: 50, y: 80, label: 'حارس' },
};

export function Pitch({ lineup }: { lineup: TeamOfWeekEntry[] }) {
  const router = useRouter();
  const open = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const starters = lineup.filter((e) => e.slot !== 'SUB1' && e.slot !== 'SUB2');
  const bench = lineup.filter((e) => e.slot === 'SUB1' || e.slot === 'SUB2');
  return (
    <View style={{ gap: 10 }}>
    <View style={s.pitch}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={[s.band, { top: `${i * 12.5}%`, opacity: i % 2 ? 0.0 : 0.08 }]} />
      ))}
      <View style={s.outline} />
      <View style={s.half} />
      <View style={s.circle} />
      <View style={[s.box, { top: 0, borderTopWidth: 0 }]} />
      <View style={[s.box, { bottom: 0, borderBottomWidth: 0 }]} />
      {starters.map(({ slot, card }) => {
        const p = POS[slot as keyof typeof POS];
        return (
          <View key={slot} style={[s.slot, { left: `${p.x}%`, top: `${p.y}%` }]}>
            <MiniCard card={card} label={p.label} onPress={() => open(card.profile.id)} />
          </View>
        );
      })}
    </View>
    {bench.length ? (
      <View style={s.bench}>
        {bench.map(({ slot, card }, i) => (
          <MiniCard key={slot} card={card} label={`احتياط ${i + 1}`} onPress={() => open(card.profile.id)} />
        ))}
      </View>
    ) : null}
    </View>
  );
}

const line = 'rgba(255,255,255,0.55)';
const s = StyleSheet.create({
  pitch: { width: '100%', aspectRatio: 0.72, backgroundColor: '#1F8A4C', borderRadius: 18, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, height: '12.5%', backgroundColor: '#000' },
  outline: { position: 'absolute', top: 8, bottom: 8, left: 8, right: 8, borderWidth: 2, borderColor: line, borderRadius: 4 },
  half: { position: 'absolute', top: '50%', left: 8, right: 8, height: 2, backgroundColor: line },
  circle: { position: 'absolute', top: '50%', left: '50%', width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: 45, borderWidth: 2, borderColor: line },
  box: { position: 'absolute', left: '25%', right: '25%', height: '13%', borderWidth: 2, borderColor: line, marginVertical: 8 },
  slot: { position: 'absolute', marginLeft: -31 },
  bench: { flexDirection: 'row', justifyContent: 'center', gap: 16, backgroundColor: '#14532D', borderRadius: 14, paddingVertical: 10 },
});
