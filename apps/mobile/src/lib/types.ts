export type Position = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'any';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'open';
export type RosterStatus = 'joined' | 'waitlist' | 'left' | 'no_show' | 'attended';
export type Team = 'A' | 'B';

export interface Profile {
  id: string;
  full_name: string;
  city: string | null;
  preferred_position: Position;
  skill_rating: number;
  reliability_score: number;
  matches_played: number;
  /** صورة اللاعب (اختيارية) */
  avatar_url?: string | null;
  role?: 'player' | 'owner' | 'staff' | 'admin';
  /** رقم اللاعب العام (ID) — يبحث بيه أصدقاءه حتى يضيفوه لفرقهم */
  public_id?: string | null;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  amenities: string[];
  is_verified: boolean;
  fields: Field[];
  /** صورة الملعب الرئيسية (يرفعها المدير من لوحة التحكم) */
  photo_url?: string | null;
  /** إحداثيات الملعب على الخريطة (يحددها المدير من لوحة التحكم) */
  lat?: number | null;
  lng?: number | null;
}

export interface Field {
  id: string;
  venue_id: string;
  name: string;
  players_per_side: number;
  surface: string | null;
  is_indoor: boolean;
  default_price: number;
  open_hour: number; // ساعة الافتتاح (0-23)
  close_hour: number; // ساعة الإغلاق (1-24)
}

export interface Booking {
  id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
  price: number;
}

export interface Match {
  id: string;
  booking_id: string | null;
  organizer_id: string;
  title: string | null;
  players_per_side: number;
  max_players: number;
  reserves: number;
  skill_level: SkillLevel;
  visibility: 'public' | 'private';
  status: 'open' | 'full' | 'in_progress' | 'finished' | 'cancelled';
  starts_at: string;
  ends_at: string;
  cost_per_player: number | null;
  venue_name: string | null;
  field_name: string | null;
  joined_count: number;
  /** موعد فتح التسجيل (null = مفتوح الآن) */
  registration_opens_at: string | null;
  venue_address: string | null;
  /** حالتي في المباراة (null = لست منضماً) */
  my_status: RosterStatus | null;
  venue_id?: string | null;
  venue_photo?: string | null;
  venue_city?: string | null;
  /** خصم الأوقات الهادئة (0–90) */
  discount_pct?: number;
  motm_player_id?: string | null;
  motm_name?: string | null;
  /** المنظّم سكّر المباراة (سجّل الحضور ورجل المباراة) */
  closed_at?: string | null;
  attended_count?: number;
  no_show_count?: number;
}

export interface RosterEntry {
  player_id: string;
  status: RosterStatus;
  attendance?: Attendance | null;
  /** القائد اللي دخّله ويّا الفريق (يتحمّل دفع غيابه) */
  paid_by?: string | null;
  team: Team | null;
  position: Position | null;
  joined_at: string;
  profile: Profile;
}

export interface MatchDetail extends Match {
  roster: RosterEntry[];
  score_a: number | null;
  score_b: number | null;
  events: MatchEvent[];
}

export interface RatingInput {
  ratee_id: string;
  skill: number;
  teamwork: number;
  sportsmanship: number;
}

export interface NewMatchInput {
  field_id: string;
  starts_at: string; // ISO
  hours: number;
  players_per_side: number;
  skill_level: SkillLevel;
  visibility: 'public' | 'private';
  title?: string;
}

// ---------- بطاقة اللاعب والإحصائيات ----------
export interface Attributes {
  pace: number; // السرعة
  shooting: number; // التسديد
  passing: number; // التمرير
  dribbling: number; // المراوغة
  defending: number; // الدفاع
  physical: number; // البدنية
}

export interface PlayerStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvps: number;
  /** البطاقات الصفراء */
  yellow: number;
  /** البطاقات الحمراء */
  red: number;
}

export interface PlayerCard {
  profile: Profile;
  overall: number;
  attributes: Attributes;
  stats: PlayerStats;
}

export type LeaderKind = 'goals' | 'assists' | 'mvps' | 'rating';
export interface LeaderRow {
  profile: Profile;
  value: number;
}

export type PitchSlot = 'GK' | 'LB' | 'CB1' | 'CB2' | 'RB' | 'CM1' | 'CM2' | 'CM3' | 'LW' | 'ST' | 'RW' | 'SUB1' | 'SUB2';
export interface TeamOfWeekEntry {
  slot: PitchSlot;
  card: PlayerCard;
}

// ---------- نتيجة المباراة ----------
export interface MatchEvent {
  player_id: string;
  kind: 'goal' | 'assist' | 'yellow' | 'red';
}
export interface MatchResultInput {
  score_a: number;
  score_b: number;
  events: MatchEvent[];
}

// ---------- البطولات ----------
export type TournamentStatus = 'registration' | 'ongoing' | 'finished';
export interface Tournament {
  id: string;
  name: string;
  venue_name: string;
  players_per_side: number;
  team_count: number;
  registered_teams: number;
  team_fee: number;
  player_fee: number;
  prize: string | null;
  status: TournamentStatus;
  starts_on: string;
  format: string; // مثلاً: مجموعات + إقصائي
}

export interface TournamentTeam {
  id: string;
  name: string;
  group_name: string | null;
  captain_id: string | null;
}

export interface Fixture {
  id: string;
  stage: string; // 'group' | 'quarter' | 'semi' | 'final'
  group_name: string | null;
  home_id: string | null;
  away_id: string | null;
  home_score: number | null;
  away_score: number | null;
  starts_at: string | null;
}

export interface TournamentDetail extends Tournament {
  teams: TournamentTeam[];
  fixtures: Fixture[];
  scorers: LeaderRow[];
  player_stats: TournamentPlayerStat[];
}

// ---------- اختبارات الأندية (الكشافة) ----------
export type TrialStatus = 'upcoming' | 'open' | 'closed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
export interface Trial {
  id: string;
  club_name: string;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  positions: Position[];
  venue_name: string;
  trial_date: string;
  status: TrialStatus;
  is_free: boolean;
  verified_club: boolean;
  applicants: number;
  my_application: { status: ApplicationStatus; scout_note: string | null } | null;
}

// ---------- المنشورات ----------
export type PostCategory = 'full' | 'small';
export interface Post {
  id: string;
  category: PostCategory;
  title: string;
  body: string;
  venue_name: string | null;
  cover_color: string;
  media_count: number;
  created_at: string;
}

// ---------- المحادثات ----------
export type ChannelKind = 'general' | 'announcements' | 'support';
export interface ChatChannel {
  id: ChannelKind;
  title: string;
  subtitle: string;
  last_message: { sender_name: string; body: string; created_at: string } | null;
  important: boolean;
  can_post: boolean;
}
export interface ChatMessage {
  id: string;
  channel: ChannelKind;
  sender_id: string;
  sender_name: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

// ---------- المحفظة ----------
export interface WalletTx {
  id: string;
  kind: 'topup' | 'payment' | 'reward' | 'refund';
  amount: number; // موجب = إضافة، سالب = خصم
  note: string;
  created_at: string;
}
export interface Wallet {
  balance: number;
  transactions: WalletTx[];
}

// ---------- إحصائيات البطولة ----------
export interface TournamentPlayerStat {
  profile: Profile;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
}

// ---------- التصنيفات الشهرية ----------
export interface RankingRow {
  profile: Profile;
  points: number;
  overall: number;
  stats: PlayerStats;
}

// ---------- اقتراح مباراة (من اللاعبين للإدارة) ----------
export type SuggestionStatus = 'pending' | 'scheduled' | 'rejected';
export interface SuggestionInput {
  venue_id: string | null;
  venue_text: string | null;
  day: string; // YYYY-MM-DD
  hour: number; // 0-23
  players_per_side: number;
  note: string | null;
}
export interface MatchSuggestion extends SuggestionInput {
  id: string;
  player_id: string;
  player_name: string;
  venue_name: string | null;
  status: SuggestionStatus;
  created_at: string;
  /** طلب مباراة لفريق كامل (القائد يتحمّل مبلغ اللي ما يحضر) */
  team_id?: string | null;
  team_name?: string | null;
  team_size?: number | null;
}

// ---------- الفرق (فريقي) ----------
export type TeamRole = 'captain' | 'member';
export interface TeamMember {
  player_id: string;
  full_name: string;
  avatar_url?: string | null;
  preferred_position: Position;
  role: TeamRole;
}
export interface PlayerTeam {
  id: string;
  name: string;
  captain_id: string;
  created_at: string;
  members: TeamMember[];
  /** دعوات بانتظار موافقة اللاعب (تبين للقائد) */
  pending: { invite_id: string; player_id: string; full_name: string }[];
  is_captain: boolean;
}
export interface TeamInvite {
  id: string;
  team_id: string;
  team_name: string;
  captain_name: string;
  members_count: number;
  created_at: string;
}

// ---------- الإشعارات داخل التطبيق ----------
export type NotificationKind = 'promoted' | 'registration_open' | 'match_created' | 'suggestion' | 'reminder' | 'general' | 'spot_opened' | 'fav_day' | 'motm' | 'referral' | 'no_show';
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  match_id: string | null;
  read: boolean;
  created_at: string;
}

// ---------- إنشاء مباراة من لوحة التحكم ----------
export interface AdminMatchInput extends NewMatchInput {
  /** موعد فتح التسجيل (null = فوراً) */
  registration_opens_at: string | null;
  suggestion_id?: string | null;
}

// ---------- طلبات حذف الحساب ----------
/** الحذف يصير خلال 30 يوم من الطلب، وإذا اللاعب دخل لحسابه قبلها ينلغي الطلب تلقائياً */
export const DELETION_GRACE_DAYS = 30;
export interface AccountDeletionRequest {
  id: string;
  player_id: string;
  player_name: string;
  public_id: string | null;
  requested_at: string;
  due_at: string;
  status: 'pending' | 'cancelled' | 'done';
}

// ---------- الإعلانات ----------
/** قوالب الإعلانات الستة (التصميم ثابت، والنصوص والأرقام تتعدل من لوحة التحكم) */
export type AdTemplate = 'services' | 'league' | 'motm' | 'offpeak' | 'invite' | 'partner';
export interface Ad {
  id: string;
  template: AdTemplate;
  /** الكلمة الصغيرة فوق العنوان */
  eyebrow: string;
  title: string;
  body: string;
  /** نص الزر (فارغ = بدون زر) */
  cta: string | null;
  /** وين يودي: مسار داخل التطبيق مثل /tournaments، أو share:invite */
  link: string | null;
  /** رقم بارز حسب القالب: نسبة الخصم، أو رقم بطاقة اللاعب */
  badge: string | null;
  /** للبطولات: العد التنازلي لهذا الوقت */
  countdown_to: string | null;
  /** للملعب الشريك: التقييم */
  rating: number | null;
  /** للملعب الشريك: صورة الملعب */
  image_url: string | null;
  /** null = كل المدن */
  city: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  sort: number;
  created_at: string;
}
export type AdInput = Omit<Ad, 'id' | 'created_at'> & { id?: string };

// ---------- المكافآت ----------
export interface AppSettings {
  motm_reward: number;
  referral_reward: number;
  /** كم صديق لازم يلعب حتى تنحسب مكافأة */
  referral_needed: number;
}
export interface ReferralFriend {
  name: string;
  /** joined = سجّل، played = لعب أول مباراة، rewarded = انحسب بمكافأة */
  status: 'joined' | 'played' | 'rewarded';
  created_at: string;
}
export interface ReferralSummary {
  code: string | null;
  friends: ReferralFriend[];
  /** اسم الصديق اللي دعاني (إذا سجّلت رقمه) */
  referred_by: string | null;
  /** أكدر أسجّل رقم صديق؟ (أول 14 يوم ومرة وحدة) */
  can_claim: boolean;
}

// ---------- إغلاق المباراة ----------
export type Attendance = 'attended' | 'no_show';
export interface CloseMatchInput {
  attendance: Record<string, Attendance>;
  motm_player_id: string | null;
}
export interface MotmVote {
  player_id: string;
  votes: number;
}

// ---------- تقارير الأعطال ----------
export interface CrashInput {
  message: string;
  stack: string | null;
  platform: 'android' | 'ios' | 'web';
  app_version: string | null;
  screen: string | null;
}
export interface CrashReport extends CrashInput {
  id: string;
  user_name: string | null;
  created_at: string;
}

// ---------- محادثة المباراة ----------
export interface MatchMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

// ---------- أوقات محجوبة (صاحب الملعب) ----------
export interface FieldBlock {
  id: string;
  field_id: string;
  field_name: string;
  venue_name: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}
