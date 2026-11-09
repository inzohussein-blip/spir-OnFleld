import { Pressable, View } from 'react-native';
import { POSITION_LABEL } from '../lib/format';
import type { LeaderRow } from '../lib/types';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

const MEDAL = ['#F2B705', '#A7B1B8', '#C98B5A'];

export function LeaderList({ rows, unit, decimals = 0, onPress }: { rows: LeaderRow[]; unit: string; decimals?: number; onPress?: (playerId: string) => void }) {
  const st = useStyles();
  const c = useColors();
  return (
    <View>
      {rows.map((r, i) => (
        <Pressable key={r.profile.id} onPress={() => onPress?.(r.profile.id)} style={[st.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[st.rank, { backgroundColor: MEDAL[i] ?? c.cardAlt }]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: i < 3 ? '#13201A' : c.text }}>{i + 1}</Text>
          </View>
          <View style={st.avatar}>
            <Text style={{ fontFamily: fonts.bold, color: c.primary }}>{r.profile.full_name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold }} numberOfLines={1}>{r.profile.full_name}</Text>
            <Text variant="small" style={{ color: c.muted }}>{POSITION_LABEL[r.profile.preferred_position]}</Text>
          </View>
          <View style={st.value}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: c.primary }}>{r.value.toFixed(decimals)}</Text>
            <Text variant="small" style={{ color: c.muted }}>{unit}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = themed((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  value: { alignItems: 'center', minWidth: 48 },
}));
