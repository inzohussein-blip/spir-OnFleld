import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Api, ProfileInput } from './types';
import { toWesternDigits } from '../format';
import { normalizePublicId } from '../teams';
import { attributesFromRating, monthRange, overallOf, pickTeamOfWeek, pointsOf } from '../stats';
import type { PlayerTeam, TeamInvite, MatchSuggestion, RankingRow, ChannelKind, ChatChannel, ChatMessage, Post, Trial, Wallet, Attributes, LeaderRow, Match, MatchDetail, MatchEvent, PlayerCard, PlayerStats, Profile, RosterEntry, Tournament, TournamentDetail, Venue, Ad, FieldBlock, StaffMember, UserRole } from '../types';
import { adError, liveAdsFor } from '../ads';

const PROFILE_COLS = 'id, full_name, city, preferred_position, skill_rating, reliability_score, matches_played, attributes, avatar_url, role, public_id';
const VENUE_COLS = 'id, name, city, address, amenities, is_verified, photos, lat, lng, fields(id, venue_id, name, players_per_side, surface, is_indoor, default_price, open_hour, close_hour)';
const mapVenue = (v: any): Venue => ({ ...v, photo_url: v.photos?.[0] ?? null });
const EMPTY_STATS: PlayerStats = { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0, yellow: 0, red: 0 };

/** يحوّل الرقم المحلي العراقي (07xxxxxxxxx) إلى الصيغة الدولية */
export function toE164(phone: string) {
  const digits = toWesternDigits(phone).replace(/\D/g, '');
  if (digits.startsWith('964')) return `+${digits}`;
  if (digits.startsWith('0')) return `+964${digits.slice(1)}`;
  return `+964${digits}`;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;
  const num = (x: unknown) => Number(x ?? 0);
  const mapProfile = (p: any): Profile => {
    const { attributes: _a, ...rest } = p;
    return { ...rest, skill_rating: num(rest.skill_rating), reliability_score: num(rest.reliability_score) };
  };

  async function loadTeams(me: string, ids: string[]): Promise<PlayerTeam[]> {
    if (!ids.length) return [];
    const { data, error } = await sb
      .from('teams')
      .select('id, name, captain_id, created_at, members:team_members(player_id, joined_at, profile:profiles(id, full_name, avatar_url, preferred_position))')
      .in('id', ids)
      .order('created_at');
    fail(error);
    const captainOf = (data ?? []).filter((t: any) => t.captain_id === me).map((t: any) => t.id);
    let pending: any[] = [];
    if (captainOf.length) {
      const r = await sb.from('team_invites').select('id, team_id, player_id, player:profiles!team_invites_player_id_fkey(full_name)').in('team_id', captainOf).eq('status', 'pending');
      fail(r.error);
      pending = r.data ?? [];
    }
    return (data ?? []).map((t: any): PlayerTeam => ({
      id: t.id, name: t.name, captain_id: t.captain_id, created_at: t.created_at, is_captain: t.captain_id === me,
      members: [...(t.members ?? [])]
        .sort((a: any, b: any) => (a.player_id === t.captain_id ? -1 : b.player_id === t.captain_id ? 1 : a.joined_at.localeCompare(b.joined_at)))
        .map((m: any) => ({
          player_id: m.player_id, full_name: m.profile?.full_name ?? '', avatar_url: m.profile?.avatar_url ?? null,
          preferred_position: m.profile?.preferred_position ?? 'any', role: m.player_id === t.captain_id ? 'captain' : 'member',
        })),
      pending: pending.filter((p) => p.team_id === t.id).map((p) => ({ invite_id: p.id, player_id: p.player_id, full_name: p.player?.full_name ?? '' })),
    }));
  }
  const toCard = (p: any, st?: Partial<PlayerStats>): PlayerCard => {
    const profile = mapProfile(p);
    const attributes: Attributes = p.attributes ?? attributesFromRating(profile.skill_rating, profile.preferred_position);
    const stats = { ...EMPTY_STATS, ...(st ?? {}) };
    return { profile: { ...profile, matches_played: stats.matches || profile.matches_played }, attributes, overall: overallOf(attributes, profile.preferred_position), stats };
  };
  /** بطاقات كل اللاعبين الذين لديهم إحصائيات (منذ تاريخ اختياري) */
  async function cardsSince(since: Date | null): Promise<PlayerCard[]> {
    const { data: st, error } = await sb.rpc('player_stats', { p_since: since?.toISOString() ?? null, p_player: null });
    fail(error);
    const rows = (st ?? []) as (PlayerStats & { player_id: string })[];
    if (!rows.length) return [];
    const { data: ps, error: e2 } = await sb.from('profiles').select(PROFILE_COLS).in('id', rows.map((r) => r.player_id));
    fail(e2);
    return (ps ?? []).map((p: any) => toCard(p, rows.find((r) => r.player_id === p.id)));
  }
  const monthAgo = () => new Date(Date.now() - 30 * 24 * 3600 * 1000);
  /** يضيف حالتي (منضم/انتظار) لكل مباراة */
  async function withMyStatus(rows: any[]): Promise<Match[]> {
    const me = await uid();
    if (!me || !rows.length) return rows.map((r) => ({ ...r, my_status: null }));
    const { data } = await sb.from('match_players').select('match_id, status').eq('player_id', me).in('match_id', rows.map((r) => r.id)).in('status', ['joined', 'waitlist']);
    const mine = new Map((data ?? []).map((r: any) => [r.match_id, r.status]));
    return rows.map((r) => ({ ...r, my_status: mine.get(r.id) ?? null }));
  }

  return {
    isDemo: false,
    currentUserId: uid,

    async sendOtp(phone) {
      const { error } = await sb.auth.signInWithOtp({ phone: toE164(phone) });
      fail(error);
    },
    async verifyOtp(phone, code) {
      const { error } = await sb.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
      fail(error);
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async getMyProfile() {
      const id = await uid();
      if (!id) return null;
      const { data, error } = await sb.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle();
      fail(error);
      // الملف يُنشأ تلقائياً باسم «لاعب جديد» — نعتبره غير مكتمل حتى يحفظه اللاعب
      if (!data || !data.city) return null;
      return mapProfile(data);
    },
    async saveProfile(input: ProfileInput) {
      const id = await uid();
      if (!id) throw new Error('لازم تسجّل دخول');
      const { error } = await sb.from('profiles').upsert({ id, ...input });
      fail(error);
    },

    async listVenues() {
      const { data, error } = await sb
        .from('venues')
        .select(VENUE_COLS)
        .order('is_verified', { ascending: false });
      fail(error);
      return (data ?? []).map(mapVenue);
    },
    async getVenue(id) {
      const { data, error } = await sb
        .from('venues')
        .select(VENUE_COLS)
        .eq('id', id)
        .maybeSingle();
      fail(error);
      return data ? mapVenue(data) : null;
    },
    async getBusy(fieldId, day) {
      const from = new Date(day);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const { data, error } = await sb.rpc('field_busy', { p_field_id: fieldId, p_from: from.toISOString(), p_to: to.toISOString() });
      fail(error);
      return data ?? [];
    },

    async createMatch() {
      throw new Error('إنشاء المباريات صار من لوحة التحكم فقط — تكدر تقترح مباراة من «حسابي»');
    },
    async listOpenMatches() {
      const { data, error } = await sb
        .from('match_cards')
        .select('*')
        .eq('visibility', 'public')
        .neq('status', 'cancelled')
        .gt('ends_at', new Date().toISOString())
        .order('starts_at');
      fail(error);
      return withMyStatus(data ?? []);
    },
    async listMyMatches() {
      const id = await uid();
      if (!id) return [];
      const { data: mine, error: e1 } = await sb.from('match_players').select('match_id').eq('player_id', id).in('status', ['joined', 'waitlist']);
      fail(e1);
      const ids = (mine ?? []).map((r) => r.match_id);
      if (!ids.length) return [];
      const { data, error } = await sb.from('match_cards').select('*').in('id', ids).order('starts_at', { ascending: false });
      fail(error);
      return withMyStatus(data ?? []);
    },
    async getMatch(id): Promise<MatchDetail | null> {
      const { data: m, error } = await sb.from('match_cards').select('*').eq('id', id).maybeSingle();
      fail(error);
      if (!m) return null;
      const { data: roster, error: e2 } = await sb
        .from('match_players')
        .select(`player_id, status, team, position, joined_at, profile:profiles(${PROFILE_COLS})`)
        .eq('match_id', id)
        .in('status', ['joined', 'waitlist'])
        .order('joined_at');
      fail(e2);
      const { data: sc } = await sb.from('matches').select('score_a, score_b').eq('id', id).maybeSingle();
      const { data: ev } = await sb.from('match_events').select('player_id, kind').eq('match_id', id);
      const [withStatus] = await withMyStatus([m]);
      return {
        ...withStatus,
        score_a: sc?.score_a ?? null,
        score_b: sc?.score_b ?? null,
        events: (ev ?? []) as MatchEvent[],
        roster: (roster ?? []).map((r: any) => ({ ...r, position: r.position ?? r.profile?.preferred_position ?? null, profile: mapProfile(r.profile) })) as RosterEntry[],
      };
    },
    async joinMatch(id) {
      const { data, error } = await sb.rpc('join_match', { p_match_id: id });
      fail(error);
      return data;
    },
    async leaveMatch(id) {
      const { error } = await sb.rpc('leave_match', { p_match_id: id });
      fail(error);
    },
    async saveTeams(id, assignments) {
      for (const [player_id, team] of Object.entries(assignments)) {
        const { error } = await sb.from('match_players').update({ team }).eq('match_id', id).eq('player_id', player_id);
        fail(error);
      }
    },
    async submitRatings(matchId, ratings, mvpId) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const { error } = await sb.from('player_ratings').insert(ratings.map((r) => ({ match_id: matchId, rater_id: me, ...r })));
      if (error?.code === '23505') throw new Error('قيّمت هاي المباراة قبل');
      fail(error);
      if (mvpId) {
        const { error: e2 } = await sb.from('match_mvp_votes').insert({ match_id: matchId, voter_id: me, player_id: mvpId });
        fail(e2);
      }
    },
    async submitResult(matchId, input) {
      const { error } = await sb.rpc('submit_match_result', {
        p_match_id: matchId,
        p_score_a: input.score_a,
        p_score_b: input.score_b,
        p_events: input.events,
      });
      fail(error);
    },

    async getPlayerCard(playerId) {
      const { data: p, error } = await sb.from('profiles').select(PROFILE_COLS).eq('id', playerId).maybeSingle();
      fail(error);
      if (!p) return null;
      const { data: st } = await sb.rpc('player_stats', { p_since: null, p_player: playerId });
      return toCard(p, (st ?? [])[0]);
    },
    async getLeaderboard(kind, limit = 10): Promise<LeaderRow[]> {
      if (kind === 'rating') {
        const { data, error } = await sb.from('profiles').select(PROFILE_COLS).not('city', 'is', null).order('skill_rating', { ascending: false }).limit(limit);
        fail(error);
        return (data ?? []).map((p: any) => ({ profile: mapProfile(p), value: num(p.skill_rating) }));
      }
      const cards = await cardsSince(null);
      return cards
        .map((c) => ({ profile: c.profile, value: c.stats[kind] }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    },
    async getTeamOfWeek() {
      return pickTeamOfWeek(await cardsSince(monthAgo()));
    },
    async getRankings(monthOffset): Promise<RankingRow[]> {
      const { from, to } = monthRange(monthOffset);
      const { data: st, error } = await sb.rpc('player_stats_range', { p_from: from.toISOString(), p_to: to.toISOString() });
      fail(error);
      const rows = (st ?? []) as (PlayerStats & { player_id: string })[];
      if (!rows.length) return [];
      const { data: ps, error: e2 } = await sb.from('profiles').select(PROFILE_COLS).in('id', rows.map((r) => r.player_id));
      fail(e2);
      return (ps ?? [])
        .map((p: any) => {
          const card = toCard(p, rows.find((r) => r.player_id === p.id));
          return { profile: card.profile, stats: card.stats, overall: card.overall, points: pointsOf(card.stats) };
        })
        .sort((a, b) => b.points - a.points || b.overall - a.overall);
    },
    async getPlayerOfMonth() {
      const cards = await cardsSince(monthAgo());
      const score = (c: PlayerCard) => c.stats.goals * 3 + c.stats.assists * 2 + c.stats.mvps * 4 + c.stats.wins;
      return cards.sort((a, b) => score(b) - score(a))[0] ?? null;
    },

    async listTournaments() {
      const { data, error } = await sb.from('tournament_cards').select('*').order('starts_on', { ascending: false });
      fail(error);
      return (data ?? []) as Tournament[];
    },
    async getTournament(id): Promise<TournamentDetail | null> {
      const { data: t, error } = await sb.from('tournament_cards').select('*').eq('id', id).maybeSingle();
      fail(error);
      if (!t) return null;
      const [teams, fixtures, scorers] = await Promise.all([
        sb.from('tournament_teams').select('id, name, group_name, captain_id').eq('tournament_id', id).order('created_at'),
        sb.from('tournament_fixtures').select('id, stage, group_name, home_id, away_id, home_score, away_score, starts_at').eq('tournament_id', id).order('starts_at'),
        sb.from('tournament_scorers').select(`goals, assists, yellow_cards, red_cards, profile:profiles(${PROFILE_COLS})`).eq('tournament_id', id).order('goals', { ascending: false }).limit(50),
      ]);
      fail(teams.error);
      fail(fixtures.error);
      fail(scorers.error);
      return {
        ...(t as Tournament),
        teams: teams.data ?? [],
        fixtures: fixtures.data ?? [],
        scorers: (scorers.data ?? []).filter((r: any) => r.goals > 0).map((r: any) => ({ profile: mapProfile(r.profile), value: r.goals })),
        player_stats: (scorers.data ?? []).map((r: any) => ({ profile: mapProfile(r.profile), goals: r.goals, assists: r.assists, yellow: r.yellow_cards, red: r.red_cards })),
      };
    },
    async registerTeam(tournamentId, teamName) {
      const { error } = await sb.rpc('register_team', { p_tournament_id: tournamentId, p_name: teamName });
      fail(error);
    },

    async listTrials() {
      const { data, error } = await sb.rpc('list_trials', { p_id: null });
      fail(error);
      return (data ?? []).map(mapTrial);
    },
    async getTrial(id) {
      const { data, error } = await sb.rpc('list_trials', { p_id: id });
      fail(error);
      return data?.[0] ? mapTrial(data[0]) : null;
    },
    async applyToTrial(id) {
      const { error } = await sb.rpc('apply_to_trial', { p_trial_id: id });
      fail(error);
    },
    async getTrialAlert() {
      const me = await uid();
      if (!me) return false;
      const { data } = await sb.from('trial_alerts').select('player_id').eq('player_id', me).maybeSingle();
      return !!data;
    },
    async setTrialAlert(on) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const { error } = on ? await sb.from('trial_alerts').upsert({ player_id: me }) : await sb.from('trial_alerts').delete().eq('player_id', me);
      fail(error);
    },

    async listPosts(category) {
      const { data, error } = await sb.from('posts').select('*').eq('category', category).order('created_at', { ascending: false }).limit(50);
      fail(error);
      return (data ?? []).map(mapPost);
    },
    async getPost(id) {
      const { data, error } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
      fail(error);
      return data ? mapPost(data) : null;
    },

    async listChannels(): Promise<ChatChannel[]> {
      const me = await uid();
      const last = async (k: ChannelKind) => {
        let q = sb.from('chat_messages').select('body, created_at, sender:profiles(full_name, role)').eq('channel', k).order('created_at', { ascending: false }).limit(1);
        if (k === 'support' && me) q = q.eq('thread_owner', me);
        const { data } = await q;
        const m: any = data?.[0];
        return m ? { sender_name: m.sender?.role === 'admin' ? 'إدارة بالملعب' : m.sender?.full_name ?? '', body: m.body, created_at: m.created_at } : null;
      };
      const [g, a, sp] = await Promise.all([last('general'), last('announcements'), last('support')]);
      return [
        { id: 'general', title: 'المحادثة العامة', subtitle: 'نقاشات اللاعبين', last_message: g, important: false, can_post: true },
        { id: 'announcements', title: 'التبليغات', subtitle: 'إعلانات رسمية من الإدارة', last_message: a, important: true, can_post: false },
        { id: 'support', title: 'محادثة الإدارة', subtitle: 'تواصل خاص ومباشر مع الإدارة', last_message: sp, important: false, can_post: true },
      ];
    },
    async listMessages(channel): Promise<ChatMessage[]> {
      const me = await uid();
      let q = sb.from('chat_messages').select('id, channel, sender_id, body, created_at, sender:profiles(full_name, role)').eq('channel', channel).order('created_at', { ascending: false }).limit(100);
      if (channel === 'support' && me) q = q.eq('thread_owner', me);
      const { data, error } = await q;
      fail(error);
      return (data ?? []).reverse().map((m: any) => ({
        id: String(m.id), channel: m.channel, sender_id: m.sender_id, body: m.body, created_at: m.created_at,
        is_admin: m.sender?.role === 'admin', sender_name: m.sender?.role === 'admin' ? 'إدارة بالملعب' : m.sender?.full_name ?? '',
      }));
    },
    async sendMessage(channel, body) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const text = body.trim();
      if (!text) return;
      const { error } = await sb.from('chat_messages').insert({ channel, sender_id: me, body: text.slice(0, 1000), thread_owner: channel === 'support' ? me : null });
      fail(error);
    },

    // ---------- فريقي ----------
    async findPlayerByPublicId(code) {
      const id = normalizePublicId(code);
      if (!id) return null;
      const { data, error } = await sb.rpc('find_player_by_public_id', { p_code: id });
      fail(error);
      const row = (data as any[] | null)?.[0];
      return row ? mapProfile(row) : null;
    },
    async listMyTeams() {
      const me = await uid();
      if (!me) return [];
      const { data: mine, error } = await sb.from('team_members').select('team_id').eq('player_id', me);
      fail(error);
      return loadTeams(me, (mine ?? []).map((r: any) => r.team_id));
    },
    async getTeam(id) {
      const me = await uid();
      if (!me) return null;
      return (await loadTeams(me, [id]))[0] ?? null;
    },
    async createTeam(name) {
      const { data, error } = await sb.rpc('create_team', { p_name: name });
      fail(error);
      return data as string;
    },
    async inviteToTeam(teamId, playerId) {
      const { error } = await sb.rpc('invite_to_team', { p_team: teamId, p_player: playerId });
      fail(error);
    },
    async listTeamInvites() {
      const me = await uid();
      if (!me) return [];
      const { data, error } = await sb
        .from('team_invites')
        .select('id, team_id, created_at, team:teams(name, captain:profiles!teams_captain_id_fkey(full_name), members:team_members(count))')
        .eq('player_id', me)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      fail(error);
      return (data ?? []).map((r: any): TeamInvite => ({
        id: r.id, team_id: r.team_id, team_name: r.team?.name ?? '', captain_name: r.team?.captain?.full_name ?? '',
        members_count: r.team?.members?.[0]?.count ?? 0, created_at: r.created_at,
      }));
    },
    async respondTeamInvite(inviteId, accept) {
      const { error } = await sb.rpc('respond_team_invite', { p_invite: inviteId, p_accept: accept });
      fail(error);
    },
    async leaveTeam(teamId) {
      const { error } = await sb.rpc('leave_team', { p_team: teamId });
      fail(error);
    },
    async removeTeamMember(teamId, playerId) {
      const { error } = await sb.rpc('remove_team_member', { p_team: teamId, p_player: playerId });
      fail(error);
    },
    async joinMatchWithTeam(matchId, teamId) {
      const { data, error } = await sb.rpc('join_match_with_team', { p_match: matchId, p_team: teamId });
      fail(error);
      return data as number;
    },
    async suggestTeamMatch(teamId, input) {
      if (!input.venue_id && !input.venue_text?.trim()) throw new Error('اختار ملعب أو اكتب اسمه');
      const { error } = await sb.rpc('suggest_team_match', {
        p_team: teamId, p_venue_id: input.venue_id, p_venue_text: input.venue_text, p_day: input.day, p_hour: input.hour,
        p_players_per_side: input.players_per_side, p_note: input.note,
      });
      fail(error);
    },

    async getWallet(): Promise<Wallet> {
      const { data, error } = await sb.from('wallet_transactions').select('id, kind, amount, note, created_at').order('created_at', { ascending: false }).limit(100);
      fail(error);
      const transactions = (data ?? []).map((t: any) => ({ ...t, id: String(t.id) }));
      return { balance: transactions.reduce((s, t) => s + t.amount, 0), transactions };
    },
    async listPlayers(query) {
      let q = sb.from('profiles').select(PROFILE_COLS).not('city', 'is', null).is('deleted_at', null).order('skill_rating', { ascending: false }).limit(100);
      if (query.trim()) q = q.ilike('full_name', `%${query.trim()}%`);
      const { data, error } = await q;
      fail(error);
      return (data ?? []).map(mapProfile);
    },
    async uploadAvatar(localUri) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const url = await uploadImage(sb, 'avatars', `${me}/${Date.now()}.jpg`, localUri);
      const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', me);
      fail(error);
      return url;
    },

    async suggestMatch(input) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      if (!input.venue_id && !input.venue_text?.trim()) throw new Error('اختار ملعب أو اكتب اسمه');
      const { error } = await sb.from('match_suggestions').insert({ ...input, player_id: me });
      fail(error);
    },
    async listMySuggestions() {
      const me = await uid();
      if (!me) return [];
      const { data, error } = await sb.from('match_suggestions').select('*, venue:venues(name), player:profiles!match_suggestions_player_id_fkey(full_name), team:teams(name, members:team_members(count))').eq('player_id', me).order('created_at', { ascending: false });
      fail(error);
      return (data ?? []).map(mapSuggestion);
    },

    async listNotifications() {
      const { data, error } = await sb.from('notifications').select('id, kind, title, body, match_id, read_at, created_at').order('created_at', { ascending: false }).limit(50);
      fail(error);
      return (data ?? []).map((n: any) => ({ id: String(n.id), kind: n.kind, title: n.title, body: n.body, match_id: n.match_id, read: !!n.read_at, created_at: n.created_at }));
    },
    async markNotificationsRead() {
      const me = await uid();
      if (!me) return;
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null);
      fail(error);
    },
    async savePushToken(token, platform) {
      const me = await uid();
      if (!me) return;
      const { error } = await sb.from('push_tokens').upsert({ user_id: me, token, platform });
      fail(error);
    },

    async isAdmin() {
      const me = await uid();
      if (!me) return false;
      const { data } = await sb.from('profiles').select('role').eq('id', me).maybeSingle();
      return data?.role === 'admin';
    },
    async myRole() {
      const me = await uid();
      if (!me) return 'player';
      const { data } = await sb.from('profiles').select('role').eq('id', me).maybeSingle();
      return (data?.role as UserRole | undefined) ?? 'player';
    },
    async setRegistrationAlert(matchId, on) {
      const me = await uid();
      if (!me) return;
      const { error } = on
        ? await sb.from('registration_alerts').upsert({ match_id: matchId, player_id: me })
        : await sb.from('registration_alerts').delete().eq('match_id', matchId).eq('player_id', me);
      fail(error);
    },
    async staffListMatches() {
      const from = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await sb.from('match_cards').select('*').gte('starts_at', from).order('starts_at').limit(300);
      fail(error);
      return withMyStatus(data ?? []);
    },
    async staffCancelMatch(matchId, reason) {
      const { error } = await sb.rpc('staff_cancel_match', { p_match: matchId, p_reason: reason ?? null });
      fail(error);
    },
    async adminListStaff() {
      const { data, error } = await sb.rpc('admin_list_staff');
      fail(error);
      return (data ?? []) as StaffMember[];
    },
    async adminSetStaff(publicId, on) {
      const { data, error } = await sb.rpc('admin_set_staff', { p_public_id: publicId, p_on: on });
      fail(error);
      return data as string;
    },
    async adminCreateMatch(input) {
      const { data, error } = await sb.rpc('admin_create_match', {
        p_field_id: input.field_id,
        p_starts_at: input.starts_at,
        p_hours: input.hours,
        p_players_per_side: input.players_per_side,
        p_skill_level: input.skill_level,
        p_visibility: input.visibility,
        p_title: input.title || null,
        p_registration_opens_at: input.registration_opens_at,
        p_suggestion_id: input.suggestion_id ?? null,
      });
      fail(error);
      return data as string;
    },
    async adminListSuggestions() {
      const { data, error } = await sb.from('match_suggestions').select('*, venue:venues(name), player:profiles!match_suggestions_player_id_fkey(full_name), team:teams(name, members:team_members(count))').order('created_at', { ascending: false }).limit(100);
      fail(error);
      return (data ?? []).map(mapSuggestion);
    },
    async adminSetSuggestionStatus(id, status) {
      const { error } = await sb.from('match_suggestions').update({ status }).eq('id', id);
      fail(error);
    },
    async adminUploadVenuePhoto(venueId, localUri) {
      const url = await uploadImage(sb, 'venue-photos', `${venueId}/${Date.now()}.jpg`, localUri);
      const { error } = await sb.from('venues').update({ photos: [url] }).eq('id', venueId);
      fail(error);
      return url;
    },
    async adminSetVenueLocation(venueId, lat, lng) {
      const { error } = await sb.from('venues').update({ lat, lng }).eq('id', venueId);
      fail(error);
    },

    async requestAccountDeletion() {
      const { error } = await sb.rpc('request_account_deletion');
      fail(error);
      await sb.auth.signOut();
    },
    async cancelMyDeletionRequest() {
      const { data, error } = await sb.rpc('cancel_my_deletion_request');
      fail(error);
      return data === true;
    },
    async adminListDeletionRequests() {
      const { data, error } = await sb
        .from('account_deletion_requests')
        .select('id, player_id, player_name, public_id, requested_at, due_at, status')
        .order('due_at')
        .limit(200);
      fail(error);
      return (data ?? []).map((r: any) => ({
        id: r.id, player_id: r.player_id, player_name: r.player_name ?? '', public_id: r.public_id ?? null,
        requested_at: r.requested_at, due_at: r.due_at, status: r.status,
      }));
    },
    async adminCompleteDeletion(requestId) {
      const { error } = await sb.rpc('admin_complete_account_deletion', { p_request: requestId });
      fail(error);
    },

    async listAds() {
      const id = await uid();
      const [{ data, error }, me] = await Promise.all([
        sb.from('ads').select(AD_COLS).eq('active', true).limit(50),
        id ? sb.from('profiles').select('city').eq('id', id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      fail(error);
      return liveAdsFor((data ?? []).map(mapAd), (me.data as { city?: string | null } | null)?.city ?? null);
    },
    async adminListAds() {
      const { data, error } = await sb.from('ads').select(AD_COLS).order('sort').order('created_at').limit(200);
      fail(error);
      return (data ?? []).map(mapAd);
    },
    async adminSaveAd(input) {
      const err = adError(input);
      if (err) throw new Error(err);
      const { id, ...row } = input;
      const q = id ? sb.from('ads').update(row).eq('id', id) : sb.from('ads').insert(row);
      const { data, error } = await q.select(AD_COLS).single();
      fail(error);
      return mapAd(data);
    },
    async adminDeleteAd(id) {
      const { error } = await sb.from('ads').delete().eq('id', id);
      fail(error);
    },
    // ---------- المكافآت ----------
    async getSettings() {
      const { data, error } = await sb.from('app_settings').select('motm_reward, referral_reward, referral_needed').eq('id', 1).maybeSingle();
      fail(error);
      return data ?? { motm_reward: 10000, referral_reward: 5000, referral_needed: 3 };
    },
    async adminSaveSettings(st) {
      const { error } = await sb.from('app_settings').update(st).eq('id', 1);
      fail(error);
    },
    async getReferrals() {
      const me = await uid();
      if (!me) return { code: null, friends: [], referred_by: null, can_claim: false };
      const [{ data: prof }, { data: rows, error }] = await Promise.all([
        sb.from('profiles').select('public_id, created_at').eq('id', me).maybeSingle(),
        sb.from('referrals').select('referred_id, referrer_id, created_at, qualified_at, rewarded_at, referred:profiles!referrals_referred_id_fkey(full_name), referrer:profiles!referrals_referrer_id_fkey(full_name)').or(`referrer_id.eq.${me},referred_id.eq.${me}`),
      ]);
      fail(error);
      const list = (rows ?? []) as any[];
      const by = list.find((r) => r.referred_id === me);
      const fresh = prof?.created_at ? Date.now() - new Date(prof.created_at).getTime() < 14 * 86400000 : false;
      return {
        code: prof?.public_id ?? null,
        friends: list
          .filter((r) => r.referrer_id === me)
          .map((r) => ({ name: r.referred?.full_name ?? 'لاعب', status: r.rewarded_at ? 'rewarded' : r.qualified_at ? 'played' : 'joined', created_at: r.created_at }) as const),
        referred_by: by ? by.referrer?.full_name ?? 'لاعب' : null,
        can_claim: !by && fresh,
      };
    },
    async claimReferral(code) {
      const { data, error } = await sb.rpc('claim_referral', { p_code: normalizePublicId(code) });
      fail(error);
      return String(data ?? '');
    },
    async adminSetMatchDiscount(matchId, pct) {
      const { error } = await sb.rpc('admin_set_match_discount', { p_match: matchId, p_pct: pct });
      fail(error);
    },

    // ---------- بعد المباراة ----------
    async getMotmVotes(matchId) {
      const { data, error } = await sb.from('match_mvp_votes').select('player_id').eq('match_id', matchId);
      fail(error);
      const votes = new Map<string, number>();
      for (const r of (data ?? []) as { player_id: string }[]) votes.set(r.player_id, (votes.get(r.player_id) ?? 0) + 1);
      return [...votes.entries()].map(([player_id, n]) => ({ player_id, votes: n })).sort((a, b) => b.votes - a.votes);
    },
    async closeMatch(matchId, input) {
      const { data, error } = await sb.rpc('close_match', { p_match: matchId, p_attendance: input.attendance, p_motm: input.motm_player_id });
      fail(error);
      const r = (data ?? {}) as { charged?: number; motm_reward?: number };
      return { charged: r.charged ?? 0, motm_reward: r.motm_reward ?? 0 };
    },

    // ---------- التنبيهات ----------
    async watchMatch(matchId, on) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const { error } = on
        ? await sb.from('match_watchers').upsert({ match_id: matchId, player_id: me })
        : await sb.from('match_watchers').delete().eq('match_id', matchId).eq('player_id', me);
      fail(error);
    },
    async isWatching(matchId) {
      const me = await uid();
      if (!me) return false;
      const { data } = await sb.from('match_watchers').select('match_id').eq('match_id', matchId).eq('player_id', me).maybeSingle();
      return !!data;
    },
    async getFavDays() {
      const me = await uid();
      if (!me) return [];
      const { data } = await sb.from('profiles').select('fav_days').eq('id', me).maybeSingle();
      return (data?.fav_days as number[] | null) ?? [];
    },
    async setFavDays(days) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const { error } = await sb.from('profiles').update({ fav_days: [...new Set(days)].filter((x) => x >= 0 && x <= 6) }).eq('id', me);
      fail(error);
    },

    // ---------- محادثة المباراة ----------
    async listMatchMessages(matchId) {
      const { data, error } = await sb.from('match_messages').select('id, sender_id, body, created_at, sender:profiles(full_name, role)').eq('match_id', matchId).order('created_at', { ascending: false }).limit(200);
      fail(error);
      return ((data ?? []) as any[]).reverse().map((m) => ({
        id: String(m.id), sender_id: m.sender_id, body: m.body, created_at: m.created_at,
        sender_name: m.sender?.role === 'admin' ? 'إدارة بالملعب' : m.sender?.full_name ?? '',
      }));
    },
    async sendMatchMessage(matchId, body) {
      const me = await uid();
      if (!me) throw new Error('لازم تسجّل دخول');
      const text = body.trim().slice(0, 1000);
      if (!text) return;
      const { error } = await sb.from('match_messages').insert({ match_id: matchId, sender_id: me, body: text });
      fail(error);
    },

    // ---------- الأعطال ----------
    async reportCrash(input) {
      // ما نرمي خطأ من مسجّل الأعطال نفسه
      await sb.from('crash_reports').insert(input).then(() => {}, () => {});
    },
    async adminListCrashes() {
      const { data, error } = await sb.from('crash_reports').select('id, message, stack, platform, app_version, screen, created_at, user:profiles(full_name)').order('created_at', { ascending: false }).limit(200);
      fail(error);
      return ((data ?? []) as any[]).map((r) => ({
        id: String(r.id), message: r.message, stack: r.stack, platform: r.platform, app_version: r.app_version, screen: r.screen,
        created_at: r.created_at, user_name: r.user?.full_name ?? null,
      }));
    },
    async adminClearCrashes() {
      const { error } = await sb.from('crash_reports').delete().gte('id', 0);
      fail(error);
    },

    // ---------- الأرباح وأصحاب الملاعب ----------
    async adminListMatches(fromIso, toIso) {
      const { data, error } = await sb.from('match_cards').select('*').gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at').limit(2000);
      fail(error);
      return (data ?? []) as Match[];
    },
    async listOwnedVenues() {
      const me = await uid();
      if (!me) return [];
      const { data: prof } = await sb.from('profiles').select('role').eq('id', me).maybeSingle();
      let q = sb.from('venues').select(VENUE_COLS).order('name');
      if (prof?.role !== 'admin') q = q.eq('owner_id', me);
      const { data, error } = await q;
      fail(error);
      return (data ?? []).map(mapVenue);
    },
    async ownerListMatches(fromIso, toIso) {
      const venues = await this.listOwnedVenues();
      const ids = venues.map((v) => v.id);
      if (!ids.length) return [];
      const { data, error } = await sb.from('match_cards').select('*').in('venue_id', ids).gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at').limit(2000);
      fail(error);
      return (data ?? []) as Match[];
    },
    async listBlocks(venueIds) {
      if (!venueIds.length) return [];
      const { data, error } = await sb
        .from('field_blackouts')
        .select('id, field_id, during, reason, field:fields!inner(name, venue_id, venue:venues(name))')
        .in('field.venue_id', venueIds);
      fail(error);
      const now = Date.now();
      return ((data ?? []) as any[])
        .map((b): FieldBlock => {
          const [from, to] = parseRange(b.during);
          return { id: b.id, field_id: b.field_id, field_name: b.field?.name ?? '', venue_name: b.field?.venue?.name ?? '', starts_at: from, ends_at: to, reason: b.reason };
        })
        .filter((b) => new Date(b.ends_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    async addBlock(fieldId, startsIso, endsIso, reason) {
      if (endsIso <= startsIso) throw new Error('وقت النهاية لازم بعد البداية');
      const { error } = await sb.from('field_blackouts').insert({ field_id: fieldId, during: `[${startsIso},${endsIso})`, reason: reason?.trim() || null });
      fail(error);
    },
    async removeBlock(id) {
      const { error } = await sb.from('field_blackouts').delete().eq('id', id);
      fail(error);
    },
    async adminSetVenueOwner(venueId, publicId) {
      const { data, error } = await sb.rpc('admin_set_venue_owner', { p_venue: venueId, p_public_id: normalizePublicId(publicId) });
      fail(error);
      return String(data ?? '');
    },

    async adminUploadAdImage(localUri) {
      // نفس مخزن صور الملاعب (الكتابة للإدارة فقط)
      return uploadImage(sb, 'venue-photos', `ads/${Date.now()}.jpg`, localUri);
    },
  };
}

function mapTrial(t: any): Trial {
  return {
    id: t.id, club_name: t.club_name, title: t.title, description: t.description, age_min: t.age_min, age_max: t.age_max,
    positions: t.positions ?? [], venue_name: t.venue_name, trial_date: t.trial_date, status: t.status, is_free: t.is_free,
    verified_club: t.verified_club, applicants: t.applicants ?? 0,
    my_application: t.my_status ? { status: t.my_status, scout_note: t.my_note ?? null } : null,
  };
}

function mapPost(p: any): Post {
  return {
    id: p.id, category: p.category, title: p.title, body: p.body, venue_name: p.venue_name, cover_color: p.cover_color,
    media_count: (p.media_urls ?? []).length, created_at: p.created_at,
  };
}

/** يرفع صورة من مسار محلي (أو data URL على الويب) إلى Supabase Storage ويعيد رابطها العام */
async function uploadImage(sb: SupabaseClient, bucket: string, path: string, localUri: string): Promise<string> {
  const res = await fetch(localUri);
  const bytes = await res.arrayBuffer();
  const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** نطاق Postgres مثل ["2026-11-20 18:00:00+00","2026-11-20 20:00:00+00") → [بداية، نهاية] ISO */
function parseRange(r: string): [string, string] {
  const m = /^[[(]"?([^",]+)"?,"?([^")]+)"?[\])]$/.exec(String(r ?? ''));
  const iso = (x: string) => new Date(x.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).toISOString();
  return m ? [iso(m[1]), iso(m[2])] : [new Date(0).toISOString(), new Date(0).toISOString()];
}

const AD_COLS = 'id, template, eyebrow, title, body, cta, link, badge, countdown_to, rating, image_url, city, starts_at, ends_at, active, sort, created_at';

function mapAd(r: any): Ad {
  return {
    id: r.id, template: r.template, eyebrow: r.eyebrow ?? '', title: r.title, body: r.body ?? '', cta: r.cta, link: r.link, badge: r.badge,
    countdown_to: r.countdown_to, rating: r.rating === null || r.rating === undefined ? null : Number(r.rating), image_url: r.image_url, city: r.city,
    starts_at: r.starts_at, ends_at: r.ends_at, active: r.active, sort: r.sort ?? 0, created_at: r.created_at,
  };
}

function mapSuggestion(r: any): MatchSuggestion {
  return {
    id: r.id, player_id: r.player_id, player_name: r.player?.full_name ?? '', venue_id: r.venue_id, venue_text: r.venue_text,
    venue_name: r.venue?.name ?? r.venue_text, day: r.day, hour: r.hour, players_per_side: r.players_per_side, note: r.note,
    status: r.status, created_at: r.created_at,
    team_id: r.team_id ?? null, team_name: r.team?.name ?? null, team_size: r.team?.members?.[0]?.count ?? null,
  };
}
