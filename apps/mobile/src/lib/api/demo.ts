import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Api, ProfileInput } from './types';
import type { BusyRange } from '../slots';
import { toWesternDigits } from '../format';
import { attributesFromRating, overallOf, pickTeamOfWeek } from '../stats';
import type {
  Attributes,
  Fixture,
  LeaderKind,
  LeaderRow,
  Match,
  MatchDetail,
  MatchEvent,
  NewMatchInput,
  PlayerCard,
  PlayerStats,
  Position,
  Profile,
  RatingInput,
  RosterEntry,
  RosterStatus,
  Team,
  Tournament,
  TournamentDetail,
  TournamentTeam,
  Venue,
  Trial,
  ApplicationStatus,
  Post,
  ChatMessage,
  ChannelKind,
  ChatChannel,
  Wallet,
} from '../types';

/**
 * وضع تجريبي: بيانات وهمية محفوظة على الجهاز، حتى يمكن تجربة التطبيق
 * كاملاً قبل ربطه بـ Supabase. رمز التحقق في هذا الوضع: 1234
 */

const KEY = 'balmalaab-demo-v3';
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
  score_a: number | null;
  score_b: number | null;
  events: MatchEvent[];
  mvpVotes: { voter_id: string; player_id: string }[];
}

interface StoredTournament extends Omit<Tournament, 'registered_teams'> {
  teams: TournamentTeam[];
  fixtures: Fixture[];
  stats: { player_id: string; goals: number; assists: number; yellow: number; red: number }[];
}

type StoredTrial = Omit<Trial, 'my_application'>;

interface DB {
  signedIn: boolean;
  profiles: Profile[];
  attributes: Record<string, Attributes>;
  venues: Venue[];
  matches: StoredMatch[];
  ratings: { match_id: string; rater_id: string; ratee_id: string; score: number }[];
  tournaments: StoredTournament[];
  trials: StoredTrial[];
  applications: { trial_id: string; status: ApplicationStatus; scout_note: string | null }[];
  trialAlert: boolean;
  posts: Post[];
  messages: ChatMessage[];
  wallet: Wallet;
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
  ['باقر رعد', 'defender', 4.2],
  ['مرتضى نزار', 'midfielder', 4.3],
  ['منتظر صباح', 'forward', 3.7],
  ['أمير هشام', 'defender', 3.1],
  ['رضا فؤاد', 'midfielder', 3.5],
];

/** مولّد أرقام شبه عشوائية ثابت، حتى تكون البيانات التجريبية نفسها في كل مرة */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function at(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seed(): DB {
  const rand = rng(42);
  const profiles: Profile[] = NAMES.map(([full_name, preferred_position, skill_rating], i) => ({
    id: `p${i}`,
    full_name,
    city: i % 5 === 4 ? 'البصرة' : 'بغداد',
    preferred_position,
    skill_rating,
    reliability_score: 80 + Math.round(rand() * 20),
    matches_played: 0,
  }));
  const attributes: Record<string, Attributes> = {};
  for (const p of profiles) {
    const base = attributesFromRating(p.skill_rating, p.preferred_position);
    const jitter = (n: number) => Math.max(20, Math.min(99, n + Math.round((rand() - 0.5) * 10)));
    attributes[p.id] = {
      pace: jitter(base.pace), shooting: jitter(base.shooting), passing: jitter(base.passing),
      dribbling: jitter(base.dribbling), defending: jitter(base.defending), physical: jitter(base.physical),
    };
  }

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
      id: 'v4', name: 'ملعب الرافدين', city: 'بغداد', address: 'زيونة', amenities: ['ملعب كامل', 'مدرجات', 'إنارة ليلية'], is_verified: true,
      fields: [{ id: 'f5', venue_id: 'v4', name: 'الملعب الكبير', players_per_side: 11, surface: 'عشب طبيعي', is_indoor: false, default_price: 150000, open_hour: 15, close_hour: 23 }],
    },
    {
      id: 'v3', name: 'ملعب الشباب', city: 'البصرة', address: 'العشار', amenities: ['إنارة ليلية'], is_verified: false,
      fields: [{ id: 'f4', venue_id: 'v3', name: 'الملعب الرئيسي', players_per_side: 6, surface: 'عشب صناعي', is_indoor: false, default_price: 35000, open_hour: 17, close_hour: 23 }],
    },
  ];

  const roster = (ids: number[], team = false) =>
    ids.map((i, k) => ({ player_id: `p${i}`, status: 'joined' as RosterStatus, team: team ? ((k % 2 ? 'B' : 'A') as Team) : null, joined_at: at(-1, 10 + k) }));
  const base = { reserves: 2, ratedBy: [], score_a: null, score_b: null, events: [], mvpVotes: [] };

  const matches: StoredMatch[] = [
    { ...base, id: 'm1', field_id: 'f1', organizer_id: 'p0', title: 'خماسي الخميس', players_per_side: 5, skill_level: 'intermediate', visibility: 'public', starts_at: at(1, 21), ends_at: at(1, 22), price: 40000, roster: roster([0, 1, 2, 3, 4, 5, 6]) },
    { ...base, id: 'm2', field_id: 'f2', organizer_id: 'p4', title: 'سباعي الجمعة', players_per_side: 7, skill_level: 'open', visibility: 'public', starts_at: at(2, 20), ends_at: at(2, 22), price: 120000, roster: roster([4, 7, 8, 9, 10]) },
    { ...base, id: 'm3', field_id: 'f3', organizer_id: 'p2', title: 'صالة الليل', players_per_side: 5, skill_level: 'advanced', visibility: 'public', starts_at: at(0, 23), ends_at: at(1, 0), price: 50000, roster: roster([2, 1, 0, 8, 4, 6, 3, 10, 9]) },
    { ...base, id: 'm4', field_id: 'f5', organizer_id: 'p11', title: 'ملعب كامل — السبت', players_per_side: 11, skill_level: 'open', visibility: 'public', starts_at: at(3, 18), ends_at: at(3, 20), price: 300000, roster: roster([11, 12, 13, 14, 15, 0, 2, 5, 7, 9, 10, 3, 6, 8]) },
  ];

  // مباريات منتهية بنتائج — تغذّي الإحصائيات والمتصدرين
  for (let k = 0; k < 6; k++) {
    const ids = Array.from({ length: 16 }, (_, i) => i).sort(() => rand() - 0.5).slice(0, 10);
    const r = roster(ids, true);
    const sa = Math.floor(rand() * 7);
    const sb = Math.floor(rand() * 7);
    const events: MatchEvent[] = [];
    const scorerFrom = (team: Team, n: number) => {
      const side = r.filter((x) => x.team === team).map((x) => x.player_id);
      const weighted = side.sort((a, b) => (profiles.find((p) => p.id === b)!.preferred_position === 'forward' ? 1 : 0) - (profiles.find((p) => p.id === a)!.preferred_position === 'forward' ? 1 : 0));
      for (let g = 0; g < n; g++) {
        const scorer = weighted[Math.floor(rand() * rand() * weighted.length)];
        events.push({ player_id: scorer, kind: 'goal' });
        const others = side.filter((x) => x !== scorer);
        if (rand() > 0.3) events.push({ player_id: others[Math.floor(rand() * others.length)], kind: 'assist' });
      }
    };
    scorerFrom('A', sa);
    scorerFrom('B', sb);
    const top = events.filter((e) => e.kind === 'goal').map((e) => e.player_id)[0] ?? r[0].player_id;
    matches.push({
      ...base, id: `h${k}`, field_id: k % 2 ? 'f1' : 'f3', organizer_id: r[0].player_id, title: `مباراة ${k + 1} من الشهر`, players_per_side: 5,
      skill_level: 'open', visibility: 'public', starts_at: at(-(k * 3 + 2), 21), ends_at: at(-(k * 3 + 2), 22), price: 40000, roster: r,
      score_a: sa, score_b: sb, events, mvpVotes: r.slice(0, 4).map((x) => ({ voter_id: x.player_id, player_id: top })),
    });
  }
  // مباراة منتهية شاركتَ فيها أنت ونظّمتها — لتجربة التقييم وتسجيل النتيجة
  matches.push({
    ...base, id: 'm0', field_id: 'f1', organizer_id: ME, title: 'مباراة الأمس', players_per_side: 3, reserves: 0, skill_level: 'open', visibility: 'private',
    starts_at: at(0, -3), ends_at: at(0, -2), price: 40000, roster: [...roster([0, 1, 3, 5, 9], true), { player_id: ME, status: 'joined', team: 'B', joined_at: at(-2, 9) }],
  });

  // ---------- البطولات ----------
  const teamNames = ['النسور', 'الصقور', 'الرافدين', 'دجلة', 'الفرات', 'النخيل', 'بابل', 'سومر'];
  const t1Teams: TournamentTeam[] = teamNames.map((name, i) => ({ id: `t1-${i}`, name, group_name: i < 4 ? 'أ' : 'ب', captain_id: `p${i}` }));
  const t1Fixtures: Fixture[] = [];
  let n = 0;
  for (const g of ['أ', 'ب']) {
    const ts = t1Teams.filter((t) => t.group_name === g);
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++) {
        const played = n < 8;
        t1Fixtures.push({
          id: `t1-f${n}`, stage: 'group', group_name: g, home_id: ts[i].id, away_id: ts[j].id,
          home_score: played ? Math.floor(rand() * 5) : null, away_score: played ? Math.floor(rand() * 5) : null,
          starts_at: at(played ? -10 + n : n - 6, 20),
        });
        n++;
      }
  }
  for (const [stage, count] of [['semi', 2], ['final', 1]] as const)
    for (let i = 0; i < count; i++)
      t1Fixtures.push({ id: `t1-${stage}${i}`, stage, group_name: null, home_id: null, away_id: null, home_score: null, away_score: null, starts_at: at(stage === 'semi' ? 8 : 12, 20) });

  const tournaments: StoredTournament[] = [
    {
      id: 't1', name: 'دوري بالملعب — الموسم الأول', venue_name: 'ملاعب النخيل', players_per_side: 5, team_count: 8,
      team_fee: 25000, player_fee: 2500, prize: 'كأس + 500,000 د.ع', status: 'ongoing', starts_on: at(-10, 20), format: 'مجموعتان ثم نصف النهائي',
      teams: t1Teams, fixtures: t1Fixtures,
      stats: [0, 4, 12, 13, 8, 1, 6, 11, 3].map((i, k) => ({ player_id: `p${i}`, goals: Math.max(0, 7 - k), assists: (k * 3) % 5, yellow: k % 3 === 0 ? 1 : 0, red: k === 6 ? 1 : 0 })),
    },
    {
      id: 't2', name: 'بطولة الملعب الكامل', venue_name: 'ملعب الرافدين', players_per_side: 11, team_count: 16,
      team_fee: 100000, player_fee: 5000, prize: 'كأس + ميداليات', status: 'registration', starts_on: at(14, 17), format: '4 مجموعات ثم إقصائي',
      teams: ['الأبطال', 'المستقبل', 'الأمل', 'الزوراء'].map((name, i) => ({ id: `t2-${i}`, name, group_name: null, captain_id: `p${i + 10}` })),
      fixtures: [], stats: [],
    },
  ];

  // ---------- اختبارات الأندية ----------
  const trials: StoredTrial[] = [
    {
      id: 'tr1', club_name: 'أكاديمية النجوم', title: 'اختبارات الناشئين 2026', verified_club: true, is_free: true,
      description: 'الأكاديمية تبحث عن مواهب بأعمار 14–18. الكشّافون يراجعون بطاقتك وإحصائياتك قبل الاختبار، وبعده تستلم النتيجة وملاحظات الكشّاف.',
      age_min: 14, age_max: 18, positions: ['forward', 'midfielder'], venue_name: 'ملعب الرافدين', trial_date: at(9, 16), status: 'open', applicants: 37,
    },
    {
      id: 'tr2', club_name: 'نادي الشباب الرياضي', title: 'اختبار حراس المرمى', verified_club: true, is_free: true,
      description: 'اختبار مخصص لحراس المرمى بأعمار 16–21 مع مدرب الحراس في النادي.',
      age_min: 16, age_max: 21, positions: ['goalkeeper'], venue_name: 'ملاعب النخيل', trial_date: at(16, 10), status: 'upcoming', applicants: 0,
    },
    {
      id: 'tr3', club_name: 'أكاديمية دجلة', title: 'اختبارات المدافعين', verified_club: false, is_free: false,
      description: 'اختبار لمراكز الدفاع. رسوم رمزية 5,000 د.ع تشمل التصوير وتقرير الأداء.',
      age_min: 15, age_max: 20, positions: ['defender'], venue_name: 'الصالة الذهبية', trial_date: at(-5, 17), status: 'closed', applicants: 52,
    },
  ];

  // ---------- المنشورات ----------
  const posts: Post[] = [
    { id: 'po1', category: 'full', title: 'صور وفيديوهات مباراة الملعب الكامل — ملعب الرافدين', body: 'لقطات من مباراة السبت الماضي على ملعب الرافدين: 4 أهداف، وحارس الفريق الأزرق كان نجم المباراة. شوف الصور واحفظ لقطاتك.', venue_name: 'ملعب الرافدين', cover_color: '#1E4FD8', media_count: 24, created_at: at(-1, 22) },
    { id: 'po2', category: 'full', title: 'ملخص الجولة الثالثة من دوري بالملعب', body: 'النسور تتصدر المجموعة أ بفارق الأهداف، والفرات يحسم صدارة المجموعة ب. الجولة القادمة الأسبوع الجاي.', venue_name: 'ملاعب النخيل', cover_color: '#163CA8', media_count: 12, created_at: at(-3, 21) },
    { id: 'po3', category: 'full', title: 'صور مباراة الجمعة — ملاعب النخيل', body: 'مباراة قوية انتهت 3-3. شكراً لكل اللاعبين على الروح الرياضية.', venue_name: 'ملاعب النخيل', cover_color: '#0F2E7A', media_count: 18, created_at: at(-6, 20) },
    { id: 'po4', category: 'small', title: 'أسرع هدف هذا الشهر بالخماسي ⚡', body: 'هدف بعد 9 ثواني من صافرة البداية في الصالة الذهبية — مقطع الفيديو بالمنشور.', venue_name: 'الصالة الذهبية', cover_color: '#E65100', media_count: 1, created_at: at(-2, 23) },
  ];

  // ---------- المحادثات ----------
  const msg = (id: string, channel: ChannelKind, sender: string, body: string, ago: number, isAdmin = false): ChatMessage => {
    const p = profiles.find((x) => x.id === sender);
    return { id, channel, sender_id: sender, sender_name: isAdmin ? 'إدارة بالملعب' : p?.full_name ?? 'لاعب', is_admin: isAdmin, body, created_at: new Date(Date.now() - ago * 60000).toISOString() };
  };
  const messages: ChatMessage[] = [
    msg('c1', 'general', 'p0', 'شباب منو جاي خماسي الخميس؟ باقي 3 لاعبين', 180),
    msg('c2', 'general', 'p4', 'آني جاي إن شاء الله 💪', 170),
    msg('c3', 'general', 'p12', 'شنو أخبار البطولة؟ متى القرعة؟', 40),
    msg('c4', 'announcements', 'admin', 'شباب هذه هي مبارياتكم: تابعوا جدول دوري بالملعب من قسم البطولات، والقرعة الجاية يوم السبت.', 60 * 20, true),
    msg('c5', 'announcements', 'admin', 'تم فتح التسجيل لبطولة الملعب الكامل — عدد الفرق محدود.', 60 * 2, true),
    msg('c6', 'support', 'admin', 'أهلاً بك! هنا تكدر تتواصل مع الإدارة مباشرة لأي استفسار أو مشكلة.', 60 * 24 * 2, true),
  ];

  const wallet: Wallet = {
    balance: 7500,
    transactions: [
      { id: 'w1', kind: 'reward', amount: 5000, note: 'مكافأة رجل المباراة', created_at: at(-4, 22) },
      { id: 'w2', kind: 'topup', amount: 10000, note: 'شحن رصيد', created_at: at(-8, 12) },
      { id: 'w3', kind: 'payment', amount: -7500, note: 'حصتك من حجز ملاعب النخيل', created_at: at(-8, 20) },
    ],
  };

  return { signedIn: false, profiles, attributes, venues, matches, ratings: [], tournaments, trials, applications: [], trialAlert: false, posts, messages, wallet };
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

function statsOf(d: DB, playerId: string): PlayerStats {
  const s: PlayerStats = { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0 };
  for (const m of d.matches) {
    if (m.score_a == null || m.score_b == null) continue;
    const r = m.roster.find((x) => x.player_id === playerId && x.status === 'joined');
    if (!r) continue;
    s.matches++;
    if (r.team) {
      const mine = r.team === 'A' ? m.score_a : m.score_b;
      const theirs = r.team === 'A' ? m.score_b : m.score_a;
      if (mine > theirs) s.wins++;
      else if (mine < theirs) s.losses++;
      else s.draws++;
    }
    s.goals += m.events.filter((e) => e.player_id === playerId && e.kind === 'goal').length;
    s.assists += m.events.filter((e) => e.player_id === playerId && e.kind === 'assist').length;
    const votes = new Map<string, number>();
    for (const v of m.mvpVotes) votes.set(v.player_id, (votes.get(v.player_id) ?? 0) + 1);
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[0] === playerId) s.mvps++;
  }
  return s;
}

function cardOf(d: DB, p: Profile): PlayerCard {
  const attributes = d.attributes[p.id] ?? attributesFromRating(p.skill_rating, p.preferred_position);
  const stats = statsOf(d, p.id);
  return { profile: { ...p, matches_played: stats.matches }, attributes, overall: overallOf(attributes, p.preferred_position), stats };
}

const delay = () => new Promise((r) => setTimeout(r, 120));

export const demoApi: Api = {
  isDemo: true,
  async currentUserId() {
    return (await db()).signedIn ? ME : null;
  },
  async sendOtp(phone) {
    await delay();
    if (toWesternDigits(phone).replace(/\D/g, '').length < 10) throw new Error('رقم الهاتف غير صحيح');
  },
  async verifyOtp(_phone, code) {
    await delay();
    if (toWesternDigits(code).trim() !== '1234') throw new Error('رمز التحقق غير صحيح (في الوضع التجريبي الرمز هو 1234)');
    (await db()).signedIn = true;
    await save();
  },
  async signOut() {
    (await db()).signedIn = false;
    await save();
  },
  async getMyProfile() {
    const d = await db();
    const p = d.profiles.find((x) => x.id === ME);
    return p ? { ...p, matches_played: statsOf(d, ME).matches } : null;
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
      roster: [{ player_id: ME, status: 'joined', team: null, joined_at: new Date().toISOString() }],
      ratedBy: [], score_a: null, score_b: null, events: [], mvpVotes: [],
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
    return { ...toMatch(d, m), roster, score_a: m.score_a, score_b: m.score_b, events: m.events };
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
  async submitRatings(matchId, ratings: RatingInput[], mvpId) {
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
        p.skill_rating = Math.round(((p.skill_rating * 5 + all.reduce((a, b) => a + b, 0)) / (5 + all.length)) * 100) / 100;
      }
    }
    if (mvpId) m.mvpVotes.push({ voter_id: ME, player_id: mvpId });
    m.ratedBy.push(ME);
    await save();
  },
  async submitResult(matchId, input) {
    const d = await db();
    const m = d.matches.find((x) => x.id === matchId);
    if (!m) throw new Error('المباراة غير موجودة');
    if (m.organizer_id !== ME) throw new Error('فقط منظّم المباراة يسجّل النتيجة');
    const goals = (t: Team) => input.events.filter((e) => e.kind === 'goal' && m.roster.find((r) => r.player_id === e.player_id)?.team === t).length;
    if (goals('A') > input.score_a || goals('B') > input.score_b) throw new Error('عدد الهدّافين أكبر من نتيجة الفريق');
    m.score_a = input.score_a;
    m.score_b = input.score_b;
    m.events = input.events;
    await save();
  },

  async getPlayerCard(playerId) {
    const d = await db();
    const p = d.profiles.find((x) => x.id === playerId);
    return p ? cardOf(d, p) : null;
  },
  async getLeaderboard(kind: LeaderKind, limit = 10): Promise<LeaderRow[]> {
    const d = await db();
    const rows = d.profiles.map((p) => {
      const s = statsOf(d, p.id);
      const value = kind === 'goals' ? s.goals : kind === 'assists' ? s.assists : kind === 'mvps' ? s.mvps : p.skill_rating;
      return { profile: p, value };
    });
    return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, limit);
  },
  async getTeamOfWeek() {
    const d = await db();
    return pickTeamOfWeek(d.profiles.filter((p) => p.id !== ME).map((p) => cardOf(d, p)));
  },
  async getPlayerOfMonth() {
    const d = await db();
    const cards = d.profiles.map((p) => cardOf(d, p));
    const score = (c: PlayerCard) => c.stats.goals * 3 + c.stats.assists * 2 + c.stats.mvps * 4 + c.stats.wins;
    return cards.sort((a, b) => score(b) - score(a))[0] ?? null;
  },

  async listTournaments() {
    await delay();
    const d = await db();
    return d.tournaments.map(({ teams, fixtures: _f, stats: _s, ...t }) => ({ ...t, registered_teams: teams.length }));
  },
  async getTournament(id): Promise<TournamentDetail | null> {
    const d = await db();
    const t = d.tournaments.find((x) => x.id === id);
    if (!t) return null;
    const { stats, ...rest } = t;
    const player_stats = stats
      .map((g) => ({ profile: d.profiles.find((p) => p.id === g.player_id)!, goals: g.goals, assists: g.assists, yellow: g.yellow, red: g.red }))
      .filter((r) => r.profile);
    const scorers = player_stats.filter((r) => r.goals > 0).map((r) => ({ profile: r.profile, value: r.goals })).sort((a, b) => b.value - a.value);
    return { ...rest, registered_teams: t.teams.length, scorers, player_stats };
  },
  async registerTeam(tournamentId, teamName) {
    const d = await db();
    const t = d.tournaments.find((x) => x.id === tournamentId);
    if (!t) throw new Error('البطولة غير موجودة');
    if (t.status !== 'registration') throw new Error('التسجيل مغلق لهذه البطولة');
    if (t.teams.length >= t.team_count) throw new Error('اكتمل عدد الفرق');
    if (t.teams.some((x) => x.captain_id === ME)) throw new Error('سجّلت فريقاً في هذه البطولة مسبقاً');
    if (teamName.trim().length < 2) throw new Error('اكتب اسم الفريق');
    t.teams.push({ id: `${t.id}-${Date.now()}`, name: teamName.trim(), group_name: null, captain_id: ME });
    await save();
  },

  async listTrials() {
    await delay();
    const d = await db();
    return d.trials.map((t) => ({ ...t, my_application: d.applications.find((a) => a.trial_id === t.id) ?? null }));
  },
  async getTrial(id) {
    const d = await db();
    const t = d.trials.find((x) => x.id === id);
    return t ? { ...t, my_application: d.applications.find((a) => a.trial_id === t.id) ?? null } : null;
  },
  async applyToTrial(id) {
    const d = await db();
    const t = d.trials.find((x) => x.id === id);
    if (!t) throw new Error('الاختبار غير موجود');
    if (t.status !== 'open') throw new Error('التقديم غير متاح لهذا الاختبار');
    if (d.applications.some((a) => a.trial_id === id)) throw new Error('قدّمت على هذا الاختبار مسبقاً');
    d.applications.push({ trial_id: id, status: 'pending', scout_note: null });
    t.applicants++;
    await save();
  },
  async getTrialAlert() {
    return (await db()).trialAlert;
  },
  async setTrialAlert(on) {
    (await db()).trialAlert = on;
    await save();
  },

  async listPosts(category) {
    await delay();
    return (await db()).posts.filter((p) => p.category === category).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async getPost(id) {
    return (await db()).posts.find((p) => p.id === id) ?? null;
  },

  async listChannels(): Promise<ChatChannel[]> {
    const d = await db();
    const last = (k: ChannelKind) => {
      const m = d.messages.filter((x) => x.channel === k).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return m ? { sender_name: m.sender_name, body: m.body, created_at: m.created_at } : null;
    };
    return [
      { id: 'general', title: 'المحادثة العامة', subtitle: 'نقاشات اللاعبين', last_message: last('general'), important: false, can_post: true },
      { id: 'announcements', title: 'التبليغات', subtitle: 'إعلانات رسمية من الإدارة', last_message: last('announcements'), important: true, can_post: false },
      { id: 'support', title: 'محادثة الإدارة', subtitle: 'تواصل خاص ومباشر مع الإدارة', last_message: last('support'), important: false, can_post: true },
    ];
  },
  async listMessages(channel) {
    const d = await db();
    return d.messages.filter((m) => m.channel === channel && (channel !== 'support' || m.sender_id === ME || m.is_admin)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async sendMessage(channel, body) {
    const d = await db();
    if (channel === 'announcements') throw new Error('التبليغات للإدارة فقط');
    const text = body.trim();
    if (!text) return;
    const me = d.profiles.find((p) => p.id === ME);
    d.messages.push({ id: `c${Date.now()}`, channel, sender_id: ME, sender_name: me?.full_name ?? 'أنا', is_admin: false, body: text.slice(0, 1000), created_at: new Date().toISOString() });
    await save();
  },

  async getWallet() {
    return (await db()).wallet;
  },
  async listPlayers(query) {
    const q = query.trim();
    return (await db()).profiles.filter((p) => p.id !== ME && (!q || p.full_name.includes(q))).sort((a, b) => b.skill_rating - a.skill_rating);
  },
  async deleteAccount() {
    cache = seed();
    await save();
  },
};

export async function resetDemo() {
  cache = seed();
  await save();
}
