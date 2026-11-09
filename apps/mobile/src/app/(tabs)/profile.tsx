import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Row, Screen, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demo';
import { POSITION_LABEL } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../theme';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="small" style={{ color: colors.muted }}>{label}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { profile, signOut, refresh } = useSession();
  useFocusEffect(useCallback(() => void refresh(), [refresh]));
  if (!profile) return null;

  return (
    <Screen>
      <Card style={styles.playerCard}>
        <Text style={styles.avatar}>{profile.full_name.slice(0, 1)}</Text>
        <Text variant="title" style={{ color: '#fff' }}>{profile.full_name}</Text>
        <Row style={{ justifyContent: 'center' }}>
          <Badge label={POSITION_LABEL[profile.preferred_position]} tone="yellow" />
          {profile.city ? <Badge label={profile.city} tone="gray" /> : null}
        </Row>
      </Card>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Stat label="المستوى" value={`★ ${profile.skill_rating.toFixed(1)}`} />
        <Stat label="الالتزام" value={`${Math.round(profile.reliability_score)}%`} />
        <Stat label="المباريات" value={String(profile.matches_played)} />
      </Row>
      <Card>
        <Text variant="h2">كيف يُحسب مستواك؟</Text>
        <Text variant="muted">
          بعد كل مباراة يقيّمك زملاؤك في المهارة واللعب الجماعي والروح الرياضية. تقييم المقيّمين المعتمدين له وزن أعلى، ونسبة
          الالتزام تنخفض عند الغياب بدون اعتذار.
        </Text>
      </Card>
      <Button title="تعديل الملف" variant="outline" onPress={() => router.push('/onboarding')} />
      {api.isDemo ? (
        <Button title="إعادة البيانات التجريبية" variant="ghost" onPress={async () => { await resetDemo(); await signOut(); }} />
      ) : null}
      <Button title="تسجيل الخروج" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerCard: { backgroundColor: colors.primary, borderColor: colors.primaryDark, alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, color: colors.text, textAlign: 'center',
    lineHeight: 72, fontSize: 32, fontFamily: fonts.bold, overflow: 'hidden',
  },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: fonts.bold, fontSize: 20 },
});
