import { View } from 'react-native';
import type { PlayerCard } from '../lib/types';
import { fonts, useColors } from '../theme';
import { Card, Progress, Row, StatTile, Text } from './ui';

/** سجل المباريات: نسبة الفوز + فوز/تعادل/خسارة + أهداف/صناعة/رجل المباراة */
export function PlayerStatsBlock({ card }: { card: PlayerCard }) {
  const c = useColors();
  const s = card.stats;
  const winRate = s.matches ? Math.round((s.wins / s.matches) * 100) : 0;
  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="h2">لعبت {s.matches} مباراة</Text>
            <Progress value={s.wins} max={Math.max(1, s.matches)} />
            <Text variant="small" style={{ color: c.muted }}>
              🟢 فوز {s.wins} · 🟡 تعادل {s.draws} · 🔴 خسارة {s.losses}
            </Text>
          </View>
          <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 6, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', marginStart: 12 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>{winRate}%</Text>
            <Text style={{ fontSize: 10, color: c.muted }}>نسبة الفوز</Text>
          </View>
        </Row>
      </Card>
      <Row style={{ flexWrap: 'nowrap' }}>
        <StatTile label="فوز" value={s.wins} icon="trophy" />
        <StatTile label="تعادل" value={s.draws} icon="remove-circle" tone="yellow" />
        <StatTile label="خسارة" value={s.losses} icon="close-circle" tone="red" />
      </Row>
      <Row style={{ flexWrap: 'nowrap' }}>
        <StatTile label="أهداف" value={s.goals} icon="football" />
        <StatTile label="صناعة" value={s.assists} icon="git-merge" tone="blue" />
        <StatTile label="رجل المباراة" value={s.mvps} icon="ribbon" tone="yellow" />
      </Row>
    </>
  );
}
