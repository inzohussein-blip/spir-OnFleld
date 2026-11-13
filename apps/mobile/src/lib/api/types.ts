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

  getWallet(): Promise<Wallet>;
  listPlayers(query: string): Promise<Profile[]>;
  deleteAccount(): Promise<void>;
}
