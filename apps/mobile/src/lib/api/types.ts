import type { BusyRange } from '../slots';
import type {
  LeaderKind,
  LeaderRow,
  Match,
  MatchDetail,
  MatchResultInput,
  NewMatchInput,
  PlayerCard,
  Position,
  Profile,
  RatingInput,
  RosterStatus,
  Team,
  TeamOfWeekEntry,
  Tournament,
  TournamentDetail,
  Venue,
  Trial,
  Post,
  PostCategory,
  ChatChannel,
  ChatMessage,
  ChannelKind,
  Wallet,
  RankingRow,
  SuggestionInput,
  MatchSuggestion,
  SuggestionStatus,
  AppNotification,
  AdminMatchInput,
  PlayerTeam,
  AccountDeletionRequest,
  TeamInvite,
  Ad,
  AdInput,
  AppSettings,
  ReferralSummary,
  CloseMatchInput,
  MotmVote,
  CrashInput,
  CrashReport,
  MatchMessage,
  FieldBlock,
} from '../types';

export interface ProfileInput {
  full_name: string;
  city: string;
  preferred_position: Position;
}

/** واجهة موحّدة للبيانات: تنفيذ تجريبي محلي، وتنفيذ حقيقي عبر Supabase. */
export interface Api {
  readonly isDemo: boolean;
  currentUserId(): Promise<string | null>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  getMyProfile(): Promise<Profile | null>;
  saveProfile(input: ProfileInput): Promise<void>;

  listVenues(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | null>;
  getBusy(fieldId: string, day: Date): Promise<BusyRange[]>;

  createMatch(input: NewMatchInput): Promise<string>;
  listOpenMatches(): Promise<Match[]>;
  listMyMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<MatchDetail | null>;
  joinMatch(id: string): Promise<RosterStatus>;
  leaveMatch(id: string): Promise<void>;
  saveTeams(id: string, assignments: Record<string, Team>): Promise<void>;
  submitRatings(matchId: string, ratings: RatingInput[], mvpId: string | null): Promise<void>;
  /** المنظّم يسجّل النتيجة والأهداف والتمريرات الحاسمة بعد المباراة */
  submitResult(matchId: string, input: MatchResultInput): Promise<void>;

  getPlayerCard(playerId: string): Promise<PlayerCard | null>;
  getLeaderboard(kind: LeaderKind, limit?: number): Promise<LeaderRow[]>;
  getTeamOfWeek(): Promise<TeamOfWeekEntry[]>;
  getPlayerOfMonth(): Promise<PlayerCard | null>;
  /** تصنيف اللاعبين حسب النقاط لشهر معيّن (0 = الحالي) */
  getRankings(monthOffset: number): Promise<RankingRow[]>;

  listTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<TournamentDetail | null>;
  registerTeam(tournamentId: string, teamName: string): Promise<void>;

  listTrials(): Promise<Trial[]>;
  getTrial(id: string): Promise<Trial | null>;
  applyToTrial(id: string): Promise<void>;
  /** تنبيه عند فتح اختبارات جديدة */
  getTrialAlert(): Promise<boolean>;
  setTrialAlert(on: boolean): Promise<void>;

  listPosts(category: PostCategory): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;

  listChannels(): Promise<ChatChannel[]>;
  listMessages(channel: ChannelKind): Promise<ChatMessage[]>;
  sendMessage(channel: ChannelKind, body: string): Promise<void>;

  /** رفع صورة اللاعب — يعيد الرابط النهائي */
  uploadAvatar(localUri: string): Promise<string>;

  /** اقتراح مباراة من اللاعب */
  suggestMatch(input: SuggestionInput): Promise<void>;
  listMySuggestions(): Promise<MatchSuggestion[]>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;
  savePushToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<void>;

  // ---------- لوحة التحكم (المدير فقط) ----------
  isAdmin(): Promise<boolean>;
  adminCreateMatch(input: AdminMatchInput): Promise<string>;
  adminListSuggestions(): Promise<MatchSuggestion[]>;
  adminSetSuggestionStatus(id: string, status: SuggestionStatus): Promise<void>;
  adminUploadVenuePhoto(venueId: string, localUri: string): Promise<string>;
  adminSetVenueLocation(venueId: string, lat: number, lng: number): Promise<void>;

  // ---------- فريقي ----------
  findPlayerByPublicId(code: string): Promise<Profile | null>;
  listMyTeams(): Promise<PlayerTeam[]>;
  getTeam(id: string): Promise<PlayerTeam | null>;
  createTeam(name: string): Promise<string>;
  inviteToTeam(teamId: string, playerId: string): Promise<void>;
  listTeamInvites(): Promise<TeamInvite[]>;
  respondTeamInvite(inviteId: string, accept: boolean): Promise<void>;
  leaveTeam(teamId: string): Promise<void>;
  removeTeamMember(teamId: string, playerId: string): Promise<void>;
  /** القائد يدخّل كل الفريق لمباراة — يرجّع عدد اللي انضافوا */
  joinMatchWithTeam(matchId: string, teamId: string): Promise<number>;
  /** القائد يطلب من الإدارة مباراة للفريق كامل */
  suggestTeamMatch(teamId: string, input: SuggestionInput): Promise<void>;

  getWallet(): Promise<Wallet>;
  listPlayers(query: string): Promise<Profile[]>;
  /** طلب حذف الحساب: يوصل للوحة التحكم وينحذف خلال 30 يوم (ويطلّع من الحساب) */
  requestAccountDeletion(): Promise<void>;
  /** يُستدعى لما اللاعب يكون داخل لحسابه: يلغي أي طلب حذف معلّق — يرجّع true إذا ألغى طلب */
  cancelMyDeletionRequest(): Promise<boolean>;
  adminListDeletionRequests(): Promise<AccountDeletionRequest[]>;
  adminCompleteDeletion(requestId: string): Promise<void>;

  // الإعلانات: اللاعب يشوف الفعّالة لمدينته، والإدارة تدير كل الإعلانات
  listAds(): Promise<Ad[]>;
  adminListAds(): Promise<Ad[]>;
  adminSaveAd(input: AdInput): Promise<Ad>;
  adminDeleteAd(id: string): Promise<void>;
  adminUploadAdImage(localUri: string): Promise<string>;

  // ---------- المكافآت ----------
  getSettings(): Promise<AppSettings>;
  adminSaveSettings(s: AppSettings): Promise<void>;
  getReferrals(): Promise<ReferralSummary>;
  /** يرجّع اسم الصديق */
  claimReferral(code: string): Promise<string>;
  adminSetMatchDiscount(matchId: string, pct: number): Promise<void>;

  // ---------- بعد المباراة ----------
  getMotmVotes(matchId: string): Promise<MotmVote[]>;
  closeMatch(matchId: string, input: CloseMatchInput): Promise<{ charged: number; motm_reward: number }>;

  // ---------- التنبيهات ----------
  watchMatch(matchId: string, on: boolean): Promise<void>;
  isWatching(matchId: string): Promise<boolean>;
  getFavDays(): Promise<number[]>;
  setFavDays(days: number[]): Promise<void>;

  // ---------- محادثة المباراة ----------
  listMatchMessages(matchId: string): Promise<MatchMessage[]>;
  sendMatchMessage(matchId: string, body: string): Promise<void>;

  // ---------- الأعطال ----------
  reportCrash(input: CrashInput): Promise<void>;
  adminListCrashes(): Promise<CrashReport[]>;
  adminClearCrashes(): Promise<void>;

  // ---------- الأرباح وأصحاب الملاعب ----------
  /** المباريات بين تاريخين (للإدارة: الكل، لصاحب الملعب: ملاعبه) */
  adminListMatches(fromIso: string, toIso: string): Promise<Match[]>;
  /** ملاعبي (صاحب الملعب) — أو كل الملاعب للإدارة */
  listOwnedVenues(): Promise<Venue[]>;
  ownerListMatches(fromIso: string, toIso: string): Promise<Match[]>;
  listBlocks(venueIds: string[]): Promise<FieldBlock[]>;
  addBlock(fieldId: string, startsIso: string, endsIso: string, reason: string | null): Promise<void>;
  removeBlock(id: string): Promise<void>;
  /** يرجّع اسم صاحب الملعب */
  adminSetVenueOwner(venueId: string, publicId: string): Promise<string>;
}
