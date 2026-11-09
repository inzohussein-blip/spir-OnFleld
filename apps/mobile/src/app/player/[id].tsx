import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PlayerCardView } from '../../components/PlayerCardView';
import { PlayerStatsBlock } from '../../components/PlayerStatsBlock';
import { Badge, ErrorText, Loading, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { POSITION_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/session';
import { fonts, useColors } from '../../theme';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { data: card, loading, error } = useAsync(() => api.getPlayerCard(id), [id]);
  if (loading && !card) return <Loading />;
  if (!card) return <Screen><ErrorText message={error ?? 'اللاعب غير موجود'} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: card.profile.full_name }} />
      <View style={{ backgroundColor: c.primary, borderRadius: 20, paddingVertical: 20, alignItems: 'center', gap: 10 }}>
        <Row style={{ flexWrap: 'nowrap', justifyContent: 'center', gap: 12 }}>
          <PlayerCardView card={card} width={150} mode="arcade" />
          <PlayerCardView card={card} width={150} />
        </Row>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: c.onPrimary }}>{card.profile.full_name}</Text>
        <Row style={{ justifyContent: 'center' }}>
          <Badge label={POSITION_LABEL[card.profile.preferred_position]} tone="yellow" />
          <Badge label={`★ ${card.profile.skill_rating.toFixed(1)}`} tone="gray" />
          <Badge label={`التزام ${Math.round(card.profile.reliability_score)}%`} tone="gray" />
        </Row>
      </View>
      <PlayerStatsBlock card={card} />
    </Screen>
  );
}
