import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Api, ProfileInput } from './types';
import type { BusyRange } from '../slots';
import type { Match, MatchDetail, NewMatchInput, Position, Profile, RatingInput, RosterEntry, RosterStatus, Team, Venue } from '../types';

/**
 * وضع تجريبي: بيانات وهمية محفوظة على الجهاز، حتى يمكن تجربة التطبيق
 * كاملاً قبل ربطه بـ Supabase. رمز التحقق في هذا الوضع: 1234
 */

const KEY = 'balmalaab-demo-v1';
const ME = 'me';

interface StoredMatch {
  id: string;
  field_id: string;
  organizer_id: string;
  title: string | null;
  players_per_side: number;
  reserves: number;
  skill_level: Match['skill_level'];
  visibility: Match['visibility'];
  starts_at: string;
  ends_at: string;
  price: number;
  roster: { player_id: string; status: RosterStatus; team: Team | null; joined_at: string }[];
  ratedBy: string[];
}

interface DB {
  signedIn: boolean;
  profiles: Profile[];
  venues: Venue[];
  matches: StoredMatch[];
  ratings: { match_id: string; rater_id: string; ratee_id: string; score: number }[];
}

const NAMES: [string, Position, number][] = [
  ['علي حسين', 'forward', 4.4],
  ['مصطفى كريم', 'midfielder', 3.9],
  ['حيدر عباس', 'goalkeeper', 4.1],
  ['محمد جاسم', 'defender', 3.5],
  ['سجاد فاضل', 'forward', 4.7],
  ['أحمد قاسم', 'midfielder', 3.2],
  ['حسن علاء', 'defender', 3.8],
  ['زيد ناصر', 'goalkeeper', 3.4],
  ['كرار مهدي', 'midfielder', 4.0],
  ['يوسف سلام', 'forward', 2.9],
  ['عمر خالد', 'defender', 3.6],
];

function at(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seed(): DB {
  const profiles: Profile[] = NAMES.map(([full_name, preferred_position, skill_rating], i) => ({
    id: `p${i}`,
    full_name,
    city: 'بغداد',
    preferred_position,
    skill_rating,
    reliability_score: 85 + ((i * 7) % 15),
    matches_played: 10 + i * 3,
  }));
  const venues: Venue[] = [
    {
      id: 'v1', name: 'ملاعب النخيل', city: 'بغداد', address: 'المنصور، قرب ساحة الرواد', amenities: ['موقف سيارات', 'مشروبات', 'إنارة ليلية'], is_verified: true,
      fields: [
        { id: 'f1', venue_id: 'v1', name: 'ساحة 1', players_per_side: 5, surface: 'عشب صناعي', is_indoor: false, default_price: 40000, open_hour: 16, close_hour: 24 },
        { id: 'f2', venue_id: 'v1', name: 'ساحة 2', players_per_side: 7, surface: 'عشب صناعي', is_indoor: false, default_price: 60000, open_hour: 16, close_hour: 24 },
      ],
    },
    {
      id: 'v2', name: 'الصالة الذهبية', city: 'بغداد', address: 'الكرادة داخل', amenities: ['مغطاة', 'تبريد', 'غرف تبديل'], is_verified: true,
      fields: [{ id: 'f3', venue_id: 'v2', name: 'الصالة', players_per_side: 5, surface: 'باركيه', is_indoor: true, default_price: 50000, open_hour: 14, close_hour: 24 }],
    },
    {
      id: 'v3', name: 'ملعب الشباب', city: 'البصرة', address: 'العشار', amenities: ['إنارة ليلية'], is_verified: false,
      fields: [{ id: 'f4', venue_id: 'v3', name: 'الملعب الرئيسي', players_per_side: 6, surface: 'عشب صناعي', is_indoor: false, default_price: 35000, open_hour: 17, close_hour: 23 }],
    },
  ];
  const roster = (ids: number[], team = false) =>
    ids.map((i, k) => ({ player_id: `p${i}`, status: 'joined' as RosterStatus, team: team ? ((k % 2 ? 'B' : 'A') as Team) : null, joined_at: at(-1, 10 + k) }));
  const matches: StoredMatch[] = [
    { id: 'm1', field_id: 'f1', organizer_id: 'p0', title: 'خماسي الخميس', players_per_side: 5, reserves: 2, skill_level: 'intermediate', visibility: 'public', starts_at: at(1, 21), ends_at: at(1, 22), price: 40000, roster: roster([0, 1, 2, 3, 4, 5, 6]), ratedBy: [] },
    { id: 'm2', field_id: 'f2', organizer_id: 'p4', title: 'سباعي الجمعة', players_per_side: 7, reserves: 2, skill_level: 'open', visibility: 'public', starts_at: at(2, 20), ends_at: at(2, 22), price: 120000, roster: roster([4, 7, 8, 9, 10]), ratedBy: [] },
    { id: 'm3', field_id: 'f3', organizer_id: 'p2', title: 'صالة الليل', players_per_side: 5, reserves: 1, skill_level: 'advanced', visibility: 'public', starts_at: at(0, 23), ends_at: at(1, 0), price: 50000, roster: roster([2, 1, 0, 8, 4, 6, 3, 10, 9]), ratedBy: [] },
    // مباراة منتهية شاركتَ فيها — لتجربة التقييم
    { id: 'm0', field_id: 'f1', organizer_id: ME, title: 'مباراة الأمس', players_per_side: 3, reserves: 0, skill_level: 'open', visibility: 'private', starts_at: at(0, -3), ends_at: at(0, -2), price: 40000, roster: [...roster([0, 1, 3, 5, 9], true), { player_id: ME, status: 'joined', team: 'B', joined_at: at(-2, 9) }], ratedBy: [] },
  ];
  return { signedIn: false, profiles, venues, matches, ratings: [] };
}

let cache: DB | null = null;
async function db(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DB) : seed();
  } catch {
    cache = seed();
  }
  return cache;
}
async function save() {
  try {
    if (cache) await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* التخزين غير متاح — نكمل من الذاكرة */
  }
}

const fieldOf = (d: DB, fieldId: string) => {
  for (const v of d.venues) for (const f of v.fields) if (f.id === fieldId) return { venue: v, field: f };
  return null;
};

function toMatch(d: DB, m: StoredMatch): Match {
  const loc = fieldOf(d, m.field_id);
  const joined = m.roster.filter((r) => r.status === 'joined').length;
  const max = m.players_per_side * 2;
  const ended = new Date(m.ends_at) < new Date();
  return {
    id: m.id, booking_id: null, organizer_id: m.organizer_id, title: m.title, players_per_side: m.players_per_side, max_players: max,
    reserves: m.reserves, skill_level: m.skill_level, visibility: m.visibility,
    status: ended ? 'finished' : joined >= max ? 'full' : 'open',
    starts_at: m.starts_at, ends_at: m.ends_at, cost_per_player: Math.ceil(m.price / max / 250) * 250,
    venue_name: loc?.venue.name ?? null, field_name: loc?.field.name ?? null, joined_count: joined,
  };
}

const delay = () => new Promise((r) => setTimeout(r, 150));

export const demoApi: Api = {
  isDemo: true,
  async currentUserId() {
    return (await db()).signedIn ? ME : null;
  },
  async sendOtp(phone) {
    await delay();
    if (phone.replace(/\D/g, '').length < 10) throw new Error('رقم الهاتف غير صحيح');
  },
  async verifyOtp(_phone, code) {
    await delay();
    if (code !== '1234') throw new Error('رمز التحقق غير صحيح (في الوضع التجريبي الرمز هو 1234)');
    (await db()).signedIn = true;
    await save();
  },
  async signOut() {
    (await db()).signedIn = false;
    await save();
  },
  async getMyProfile() {
    return (await db()).profiles.find((p) => p.id === ME) ?? null;
  },
  async saveProfile(input: ProfileInput) {
    const d = await db();
    const existing = d.profiles.find((p) => p.id === ME);
    if (existing) Object.assign(existing, input);
    else d.profiles.push({ id: ME, ...input, skill_rating: 3, reliability_score: 100, matches_played: 0 });
    await save();
  },
  async listVenues() {
    await delay();
    return (await db()).venues;
  },
  async getVenue(id) {
    return (await db()).venues.find((v) => v.id === id) ?? null;
  },
  async getBusy(fieldId, day): Promise<BusyRange[]> {
    const d = await db();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return d.matches
      .filter((m) => m.field_id === fieldId && new Date(m.starts_at) < end && new Date(m.ends_at) > start)
      .map((m) => ({ starts_at: m.starts_at, ends_at: m.ends_at }));
  },
  async createMatch(input: NewMatchInput) {
    const d = await db();
    const loc = fieldOf(d, input.field_id);
    if (!loc) throw new Error('الملعب غير موجود');
    const starts = new Date(input.starts_at);
    const ends = new Date(starts);
    ends.setHours(ends.getHours() + input.hours);
    const clash = d.matches.some((m) => m.field_id === input.field_id && new Date(m.starts_at) < ends && new Date(m.ends_at) > starts);
    if (clash) throw new Error('هذا الوقت محجوز مسبقاً');
    const id = `m${Date.now()}`;
    d.matches.push({
      id, field_id: input.field_id, organizer_id: ME, title: input.title || null, players_per_side: input.players_per_side, reserves: 2,
      skill_level: input.skill_level, visibility: input.visibility, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price: loc.field.default_price * input.hours,
      roster: [{ player_id: ME, status: 'joined', team: null, joined_at: new Date().toISOString() }], ratedBy: [],
    });
    await save();
    return id;
  },
  async listOpenMatches() {
    await delay();
    const d = await db();
    return d.matches
      .filter((m) => m.visibility === 'public' && new Date(m.ends_at) > new Date())
      .map((m) => toMatch(d, m))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  },
  async listMyMatches() {
    const d = await db();
    return d.matches
      .filter((m) => m.roster.some((r) => r.player_id === ME && (r.status === 'joined' || r.status === 'waitlist')))
      .map((m) => toMatch(d, m))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  },
  async getMatch(id): Promise<MatchDetail | null> {
    const d = await db();
    const m = d.matches.find((x) => x.id === id);
    if (!m) return null;
    const roster: RosterEntry[] = m.roster
      .filter((r) => r.status === 'joined' || r.status === 'waitlist')
      .map((r) => {
        const profile = d.profiles.find((p) => p.id === r.player_id)!;
        return { ...r, position: profile?.preferred_position ?? null, profile };
      })
      .filter((r) => r.profile);
    return { ...toMatch(d, m), roster };
  },
  async joinMatch(id) {
    const d = await db();
    const m = d.matches.find((x) => x.id === id);
    if (!m) throw new Error('المباراة غير موجودة');
    if (!d.profiles.some((p) => p.id === ME)) throw new Error('أكمل ملفك الشخصي أولاً');
    const mine = m.roster.find((r) => r.player_id === ME);
    if (mine && (mine.status === 'joined' || mine.status === 'waitlist')) return mine.status;
    const joined = m.roster.filter((r) => r.status === 'joined').length;
    const status: RosterStatus = joined < m.players_per_side * 2 ? 'joined' : 'waitlist';
    if (mine) Object.assign(mine, { status, team: null, joined_at: new Date().toISOString() });
    else m.roster.push({ player_id: ME, status, team: null, joined_at: new Date().toISOString() });
    await save();
    return status;
  },
  async leaveMatch(id) {
    const d = await db();
    const m = d.matches.find((x) => x.id === id);
    const mine = m?.roster.find((r) => r.player_id === ME);
    if (!m || !mine || (mine.status !== 'joined' && mine.status !== 'waitlist')) return;
    const was = mine.status;
    mine.status = 'left';
    mine.team = null;
    if (was === 'joined') {
      const next = m.roster.filter((r) => r.status === 'waitlist').sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
      if (next) next.status = 'joined';
    }
    await save();
  },
  async saveTeams(id, assignments) {
    const m = (await db()).matches.find((x) => x.id === id);
    if (!m) return;
    for (const r of m.roster) r.team = assignments[r.player_id] ?? null;
    await save();
  },
  async submitRatings(matchId, ratings: RatingInput[], _mvpId) {
    const d = await db();
    const m = d.matches.find((x) => x.id === matchId);
    if (!m) throw new Error('المباراة غير موجودة');
    if (m.ratedBy.includes(ME)) throw new Error('لقد قيّمت هذه المباراة مسبقاً');
    for (const r of ratings) {
      const score = (r.skill * 2 + r.teamwork + r.sportsmanship) / 4;
      d.ratings.push({ match_id: matchId, rater_id: ME, ratee_id: r.ratee_id, score });
      const p = d.profiles.find((x) => x.id === r.ratee_id);
      if (p) {
        const all = d.ratings.filter((x) => x.ratee_id === p.id).map((x) => x.score);
        // نمزج المستوى السابق مع التقييمات الجديدة
        p.skill_rating = Math.round(((p.skill_rating * 5 + all.reduce((a, b) => a + b, 0)) / (5 + all.length)) * 100) / 100;
      }
    }
    m.ratedBy.push(ME);
    await save();
  },
};

export async function resetDemo() {
  cache = seed();
  await save();
}
