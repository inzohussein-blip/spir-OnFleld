import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatDateTime, formatFormat, formatIQD, SKILL_LABEL } from '../lib/format';
import type { Match } from '../lib/types';
import { useColors } from '../theme';
import { Badge, Card, Progress, Row, Text } from './ui';

export function MatchCard({ match }: { match: Match }) {
  const router = useRouter();
  const colors = useColors();
  const left = match.max_players - match.joined_count;
  const statusBadge =
    match.status === 'finished' ? (
      <Badge label="انتهت" tone="gray" />
    ) : left <= 0 ? (
      <Badge label="مكتملة · قائمة انتظار" tone="yellow" />
    ) : (
      <Badge label={left === 1 ? 'باقي لاعب واحد' : `باقي ${left} لاعبين`} tone={left <= 2 ? 'red' : 'green'} />
    );

  return (
    <Card onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h2">{match.title || `مباراة ${formatFormat(match.players_per_side)}`}</Text>
        {statusBadge}
      </Row>
      <Text variant="muted">
        📍 {match.venue_name ?? 'بدون ساحة'}
        {match.field_name ? ` · ${match.field_name}` : ''}
      </Text>
      <Text variant="muted">🕒 {formatDateTime(match.starts_at)}</Text>
      <Row>
        <Badge label={formatFormat(match.players_per_side)} tone="gray" />
        <Badge label={SKILL_LABEL[match.skill_level]} tone="gray" />
        {match.cost_per_player ? <Badge label={`${formatIQD(match.cost_per_player)} للاعب`} tone="gray" /> : null}
      </Row>
      <View style={{ gap: 4 }}>
        <Progress value={match.joined_count} max={match.max_players} />
        <Text variant="small" style={{ color: colors.muted }}>
          {match.joined_count} / {match.max_players} لاعب
        </Text>
      </View>
    </Card>
  );
}
