import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Api, ProfileInput } from './types';
import { attributesFromRating, overallOf, pickTeamOfWeek } from '../stats';
import type { Attributes, LeaderRow, Match, MatchDetail, MatchEvent, PlayerCard, PlayerStats, Profile, RosterEntry, Tournament, TournamentDetail, Venue } from '../types';

const PROFILE_COLS = 'id, full_name, city, preferred_position, skill_rating, reliability_score, matches_played, attributes';
const EMPTY_STATS: PlayerStats = { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0 };

/** يحوّل الرقم المحلي العراقي (07xxxxxxxxx) إلى الصيغة الدولية */
export function toE164(phone: string) {
  const digits = phone.replace(/\D/g, '');
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
      if (!id) throw new Error('يجب تسجيل الدخول');
      const { error } = await sb.from('profiles').upsert({ id, ...input });
      fail(error);
    },

    async listVenues() {
      const { data, error } = await sb
        .from('venues')
        .select('id, name, city, address, amenities, is_verified, fields(id, venue_id, name, players_per_side, surface, is_indoor, default_price, open_hour, close_hour)')
        .order('is_verified', { ascending: false });
      fail(error);
      return (data ?? []) as Venue[];
    },
    async getVenue(id) {
      const { data, error } = await sb
        .from('venues')
        .select('id, name, city, address, amenities, is_verified, fields(id, venue_id, name, players_per_side, surface, is_indoor, default_price, open_hour, close_hour)')
        .eq('id', id)
        .maybeSingle();
      fail(error);
      return (data as Venue) ?? null;
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

    async createMatch(input) {
      const { data, error } = await sb.rpc('create_match', {
        p_field_id: input.field_id,
        p_starts_at: input.starts_at,
        p_hours: input.hours,
        p_players_per_side: input.players_per_side,
        p_skill_level: input.skill_level,
        p_visibility: input.visibility,
        p_title: input.title || null,
      });
      fail(error);
      return data as string;
    },
    async listOpenMatches() {
      const { data, error } = await sb
        .from('match_cards')
        .select('*')
        .eq('visibility', 'public')
        .gt('ends_at', new Date().toISOString())
        .order('starts_at');
      fail(error);
      return (data ?? []) as Match[];
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
      return (data ?? []) as Match[];
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
      return {
        ...(m as Match),
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
      if (!me) throw new Error('يجب تسجيل الدخول');
      const { error } = await sb.from('player_ratings').insert(ratings.map((r) => ({ match_id: matchId, rater_id: me, ...r })));
      if (error?.code === '23505') throw new Error('لقد قيّمت هذه المباراة مسبقاً');
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
      return pickTeamOfWeek(await cardsSince(new Date(Date.now() - 7 * 24 * 3600 * 1000)));
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
        sb.from('tournament_scorers').select(`goals, profile:profiles(${PROFILE_COLS})`).eq('tournament_id', id).order('goals', { ascending: false }).limit(20),
      ]);
      fail(teams.error);
      fail(fixtures.error);
      fail(scorers.error);
      return {
        ...(t as Tournament),
        teams: teams.data ?? [],
        fixtures: fixtures.data ?? [],
        scorers: (scorers.data ?? []).map((r: any) => ({ profile: mapProfile(r.profile), value: r.goals })),
      };
    },
    async registerTeam(tournamentId, teamName) {
      const { error } = await sb.rpc('register_team', { p_tournament_id: tournamentId, p_name: teamName });
      fail(error);
    },
  };
}
