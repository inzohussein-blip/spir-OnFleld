import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/feedback';
import { Button, ErrorText, Text } from '../components/ui';
import { api } from '../lib/api';
import { POSITION_LABEL } from '../lib/format';
import { errMsg, useAsync, useSession } from '../lib/session';
import { MAX_TEAMS, normalizePublicId } from '../lib/teams';
import type { Profile } from '../lib/types';
import { fonts, themed, useColors } from '../theme';

/** فريقي: رقمك، البحث عن لاعب بالـ ID وإضافته، فرقك، وطلبات الانضمام */
export default function Teams() {
  const c = useColors();
  const st = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useSession();
  const teams = useAsync(() => api.listMyTeams(), []);
  const invites = useAsync(() => api.listTeamInvites(), []);
  const reloadTeams = teams.reload;
  const reloadInvites = invites.reload;
  useFocusEffect(
    useCallback(() => {
      void reloadTeams();
      void reloadInvites();
    }, [reloadTeams, reloadInvites]),
  );

  const [code, setCode] = useState('');
  const [found, setFound] = useState<Profile | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myTeams = teams.data ?? [];
  const captainOf = myTeams.filter((t) => t.is_captain);
  const full = myTeams.length >= MAX_TEAMS;

  async function search() {
    const id = normalizePublicId(code);
    if (!id) return;
    setSearching(true);
    setError(null);
    try {
      setFound(await api.findPlayerByPublicId(id));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSearching(false);
    }
  }

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(done);
      await Promise.all([teams.reload(), invites.reload()]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      {/* رقمي */}
      {profile?.public_id ? (
        <Pressable
          style={st.myId}
          onPress={async () => {
            await Clipboard.setStringAsync(profile.public_id ?? '');
            toast('انسخ رقمك ✓');
          }}
          accessibilityRole="button"
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="small" style={{ color: c.muted }}>رقمك (ID) — دزّه لأصدقائك حتى يضيفوك</Text>
            <Text style={st.myIdText}>{profile.public_id}</Text>
          </View>
          <Ionicons name="copy-outline" size={22} color={c.primary} />
        </Pressable>
      ) : null}

      {/* البحث عن لاعب */}
      <Text style={st.h}>ابحث عن لاعب</Text>
      <View style={st.search}>
        <Ionicons name="search" size={22} color={c.primary} />
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(normalizePublicId(v));
            setFound(undefined);
          }}
          onSubmitEditing={search}
          placeholder="اكتب الـ ID مالته"
          placeholderTextColor={c.muted}
          keyboardType="number-pad"
          returnKeyType="search"
          maxLength={10}
          style={st.input}
          accessibilityLabel="ID اللاعب"
        />
        <Pressable onPress={search} disabled={!code || searching} style={[st.searchBtn, (!code || searching) && { opacity: 0.5 }]} accessibilityRole="button">
          <Text style={st.searchBtnText}>{searching ? '...' : 'ابحث'}</Text>
        </Pressable>
      </View>
      {found === null ? <Text variant="muted">ماكو لاعب بهذا الرقم. تأكد من الرقم وارجع جرّب.</Text> : null}
      {found ? (
        <View style={st.card}>
          <View style={st.rowCenter}>
            <Avatar name={found.full_name} url={found.avatar_url} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{found.full_name}</Text>
              <Text variant="small" style={{ color: c.muted }}>
                {POSITION_LABEL[found.preferred_position]}
                {found.city ? ` · ${found.city}` : ''} · ID {found.public_id}
              </Text>
            </View>
            <Pressable onPress={() => router.push({ pathname: '/player/[id]', params: { id: found.id } })} accessibilityRole="button" hitSlop={8}>
              <Text style={st.link}>ملفه</Text>
            </Pressable>
          </View>
          {found.id === profile?.id ? (
            <Text variant="muted">هذا إنت 🙂</Text>
          ) : captainOf.length === 0 ? (
            <Text variant="muted">سوّي فريق أول (تحت) حتى تكدر تضيفه.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {captainOf.map((t) => {
                const inTeam = t.members.some((m) => m.player_id === found.id);
                const invited = t.pending.some((p) => p.player_id === found.id);
                return (
                  <Button
                    key={t.id}
                    title={inTeam ? `بفريق «${t.name}» من قبل` : invited ? `بانتظار موافقته على «${t.name}»` : `أضفه لـ«${t.name}»`}
                    icon={inTeam || invited ? 'checkmark' : 'person-add-outline'}
                    variant={inTeam || invited ? 'ghost' : 'primary'}
                    disabled={inTeam || invited}
                    loading={busy === `add-${t.id}`}
                    onPress={() => run(`add-${t.id}`, () => api.inviteToTeam(t.id, found.id), 'وصله طلب الانضمام ✓')}
                  />
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      <ErrorText message={error} />

      {/* طلبات الانضمام */}
      <Text style={st.h}>طلبات الانضمام للفريق</Text>
      {invites.data && invites.data.length === 0 ? <Text variant="muted">ماكو طلبات هسه.</Text> : null}
      {invites.data?.map((inv) => (
        <View key={inv.id} style={st.card} testID={`invite-${inv.id}`}>
          <View style={st.rowCenter}>
            <View style={st.teamIcon}>
              <Ionicons name="people" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{inv.team_name}</Text>
              <Text variant="small" style={{ color: c.muted }}>
                القائد {inv.captain_name} · {inv.members_count} لاعب
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="وافق"
              icon="checkmark"
              style={{ flex: 1 }}
              loading={busy === `yes-${inv.id}`}
              onPress={() => run(`yes-${inv.id}`, () => api.respondTeamInvite(inv.id, true), `صرت بفريق «${inv.team_name}» ✓`)}
            />
            <Button
              title="ارفض"
              variant="outline"
              style={{ flex: 1 }}
              loading={busy === `no-${inv.id}`}
              onPress={() => run(`no-${inv.id}`, () => api.respondTeamInvite(inv.id, false), 'رفضت الطلب')}
            />
          </View>
        </View>
      ))}

      {/* فرقي */}
      <Text style={st.h}>
        فرقي ({myTeams.length}/{MAX_TEAMS})
      </Text>
      {teams.data && myTeams.length === 0 ? <Text variant="muted">بعدك ما بأي فريق. سوّي فريقك أو وافق على طلب انضمام.</Text> : null}
      {myTeams.map((t) => (
        <Pressable key={t.id} style={st.card} onPress={() => router.push({ pathname: '/team/[id]', params: { id: t.id } })} accessibilityRole="button" accessibilityLabel={t.name}>
          <View style={st.rowCenter}>
            <View style={st.teamIcon}>
              <Ionicons name="shield" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{t.name}</Text>
              <Text variant="small" style={{ color: c.muted }}>
                {t.members.length} لاعب{t.is_captain ? ' · إنت القائد' : ''}
                {t.pending.length ? ` · ${t.pending.length} بانتظار الموافقة` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={c.muted} />
          </View>
        </Pressable>
      ))}
      {full ? (
        <Text variant="muted">وصلت الحد: تكدر تكون بـ {MAX_TEAMS} فرق بس.</Text>
      ) : (
        <View style={st.create}>
          <TextInput value={newName} onChangeText={setNewName} placeholder="اسم فريق جديد" placeholderTextColor={c.muted} maxLength={30} style={st.input} accessibilityLabel="اسم فريق جديد" />
          <Pressable
            style={[st.searchBtn, (!newName.trim() || busy === 'create') && { opacity: 0.5 }]}
            disabled={!newName.trim() || busy === 'create'}
            onPress={() =>
              run('create', async () => {
                await api.createTeam(newName);
                setNewName('');
              }, 'انسوّى الفريق ✓ إنت القائد')
            }
            accessibilityRole="button"
          >
            <Text style={st.searchBtnText}>سوّي فريق</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = themed((c) => ({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  h: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28, marginTop: 6 },
  myId: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.primarySoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: c.border },
  myIdText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.primary, letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingStart: 14, paddingEnd: 6 },
  create: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingStart: 14, paddingEnd: 6 },
  input: { flex: 1, minHeight: 54, fontFamily: fonts.regular, fontSize: 16, color: c.text, outlineWidth: 0 },
  searchBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 16, height: 42, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  link: { color: c.primary, fontFamily: fonts.bold, fontSize: 15 },
  teamIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
}));
