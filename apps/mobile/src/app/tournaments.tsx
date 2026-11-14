import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Badge, Card, Empty, ErrorText, Loading, Progress, Row, Screen, SectionTitle, Text } from '../components/ui';
import { api } from '../lib/api';
import { formatDay, formatFormat, formatIQD, TOURNAMENT_STATUS as STATUS_LABEL } from '../lib/format';
import { useAsync } from '../lib/session';
import { fonts, useColors } from '../theme';


export default function Tournaments() {
  const router = useRouter();
  const c = useColors();
  const { data, error, loading, reload } = useAsync(() => api.listTournaments(), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  return (
    <Screen>
      <SectionTitle title="البطولات" hint="شارك بفريقك أو تابع المجموعات والنتائج" />
      <ErrorText message={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="ماكو بطولات هسه" icon="trophy-outline" /> : null}
      {data?.map((t) => {
        const st = STATUS_LABEL[t.status];
        return (
          <Card key={t.id} onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })} style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ backgroundColor: c.primary, padding: 16, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Ionicons name="trophy" size={28} color={c.accent} />
                <Badge label={st.label} tone={st.tone} />
              </Row>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: c.onPrimary }}>{t.name}</Text>
              <Text style={{ color: c.onPrimary, opacity: 0.85 }}>📍 {t.venue_name} · يبدأ {formatDay(new Date(t.starts_on))}</Text>
            </View>
            <View style={{ padding: 14, gap: 10 }}>
              <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
                <Info icon="people" label={`${t.team_count} فريق`} hint={formatFormat(t.players_per_side)} />
                <Info icon="git-network" label={t.format} hint="نظام البطولة" />
              </Row>
              <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
                <Info icon="cash" label={formatIQD(t.team_fee)} hint={`اشتراك الفريق · ${formatIQD(t.player_fee)} للاعب`} />
                {t.prize ? <Info icon="medal" label={t.prize} hint="الجائزة" /> : null}
              </Row>
              <View style={{ gap: 4 }}>
                <Progress value={t.registered_teams} max={t.team_count} />
                <Text variant="small" style={{ color: c.muted }}>
                  {t.registered_teams} من {t.team_count} فرق مسجّلة
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

function Info({ icon, label, hint }: { icon: 'people' | 'git-network' | 'cash' | 'medal'; label: string; hint: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.cardAlt, borderRadius: 12, padding: 10 }}>
      <Ionicons name={icon} size={20} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14 }} numberOfLines={2}>{label}</Text>
        <Text variant="small" style={{ color: c.muted }} numberOfLines={2}>{hint}</Text>
      </View>
    </View>
  );
}
