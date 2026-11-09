import type { BusyRange } from '../slots';
import type { Match, MatchDetail, NewMatchInput, Position, Profile, RatingInput, RosterStatus, Team, Venue } from '../types';

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
}
