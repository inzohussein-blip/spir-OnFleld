import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/feedback';
import { Button, Empty, ErrorText, Loading, Text } from '../../components/ui';
import { api } from '../../lib/api';
import { POSITION_LABEL } from '../../lib/format';
import { errMsg, useAsync } from '../../lib/session';
import { fonts, themed, useColors } from '../../theme';

/** صفحة الفريق: الأعضاء، الطلبات المعلّقة، ومباريات الفريق (للقائد) */
export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { data: team, loading, reload } = useAsync(() => api.getTeam(id), [id]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (loading && !team) return <Loading />;
  if (!team) return <Empty title="الفريق مو موجود" hint="يمكن طلعت منه أو انحذف" icon="people-outline" />;

  async function run(key: string, fn: () => Promise<unknown>, done: string, after?: () => void) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(done);
      if (after) after();
      else await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.content}>
      <Stack.Screen options={{ title: team.name }} />
      <View style={st.hero}>
        <View style={st.heroIcon}>
          <Ionicons name="shield" size={30} color="#fff" />
        </View>
        <Text style={st.heroName}>{team.name}</Text>
        <Text style={st.heroMeta}>
          {team.members.length} لاعب{team.is_captain ? ' · إنت القائد' : ''}
        </Text>
      </View>

      {/* مباريات الفريق */}
      {team.is_captain ? (
        <View style={st.box}>
          <Text style={st.h}>مباريات الفريق</Text>
          <View style={st.notice}>
            <Ionicons name="information-circle" size={20} color={c.primary} />
            <Text variant="small" style={{ flex: 1, lineHeight: 22 }}>
              إنت القائد: إذا لاعب من الفريق ما حضر، دفع مبلغه عليك.
            </Text>
          </View>
          <Button title="اطلب مباراة للفريق كامل" icon="calendar-outline" onPress={() => router.push({ pathname: '/team/suggest', params: { id: team.id } })} />
          <Button title="انضم لمباراة ويّا الفريق كامل" icon="people-outline" variant="outline" onPress={() => router.push({ pathname: '/team/join', params: { id: team.id } })} />
        </View>
      ) : (
        <View style={st.notice}>
          <Ionicons name="information-circle" size={20} color={c.primary} />
          <Text variant="small" style={{ flex: 1, lineHeight: 22 }}>
            القائد هو اللي يطلب مباريات للفريق ويدخّله لها. إذا دخّلك مباراة وما تكدر تحضر، انسحب منها وبلّغه.
          </Text>
        </View>
      )}

      {/* الأعضاء */}
      <Text style={st.h}>اللاعبين</Text>
      <View style={st.box}>
        {team.members.map((m, i) => (
          <View key={m.player_id} style={[st.member, i < team.members.length - 1 && st.line]}>
            <Pressable style={st.memberMain} onPress={() => router.push({ pathname: '/player/[id]', params: { id: m.player_id } })} accessibilityRole="button">
              <Avatar name={m.full_name} url={m.avatar_url} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{m.full_name}</Text>
                <Text variant="small" style={{ color: c.muted }}>{POSITION_LABEL[m.preferred_position]}</Text>
              </View>
              {m.role === 'captain' ? (
                <View style={st.captain}>
                  <Text style={st.captainText}>القائد</Text>
                </View>
              ) : null}
            </Pressable>
            {team.is_captain && m.role !== 'captain' ? (
              <Pressable
                onPress={() => run(`rm-${m.player_id}`, () => api.removeTeamMember(team.id, m.player_id), `شلت ${m.full_name} من الفريق`)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`شيل ${m.full_name} من الفريق`}
              >
                <Ionicons name="close-circle-outline" size={24} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {team.pending.map((p) => (
          <View key={p.invite_id} style={[st.member, st.lineTop]}>
            <View style={st.memberMain}>
              <Avatar name={p.full_name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={[st.name, { color: c.muted }]}>{p.full_name}</Text>
                <Text variant="small" style={{ color: c.muted }}>بانتظار الموافقة</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
      {team.is_captain ? (
        <Text variant="muted">تضيف لاعبين من صفحة «فريقي»: ابحث بالـ ID مالهم.</Text>
      ) : null}

      <ErrorText message={error} />
      {confirmLeave ? (
        <View style={st.box}>
          <Text>
            {team.is_captain && team.members.length > 1
              ? 'متأكد؟ القيادة تروح لأقدم لاعب بالفريق.'
              : team.members.length === 1
                ? 'متأكد؟ إنت آخر لاعب، فالفريق راح ينحذف.'
                : 'متأكد تريد تطلع من الفريق؟'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="إي، اطلع"
              variant="danger"
              style={{ flex: 1 }}
              loading={busy === 'leave'}
              onPress={() => run('leave', () => api.leaveTeam(team.id), `طلعت من «${team.name}»`, () => router.back())}
            />
            <Button title="لا" variant="outline" style={{ flex: 1 }} onPress={() => setConfirmLeave(false)} />
          </View>
        </View>
      ) : (
        <Button title="اطلع من الفريق" variant="ghost" icon="exit-outline" onPress={() => setConfirmLeave(true)} />
      )}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  hero: { backgroundColor: c.primary, borderRadius: 24, padding: 18, alignItems: 'center', gap: 4 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroName: { color: '#fff', fontFamily: fonts.bold, fontSize: 20, lineHeight: 32 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 14 },
  h: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28 },
  box: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.primarySoft, borderRadius: 14, padding: 12 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 },
  lineTop: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  name: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24 },
  captain: { backgroundColor: c.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  captainText: { color: c.primary, fontFamily: fonts.bold, fontSize: 12, lineHeight: 20 },
}));
