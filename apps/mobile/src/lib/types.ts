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
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  amenities: string[];
  is_verified: boolean;
  fields: Field[];
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
}

export interface RosterEntry {
  player_id: string;
  status: RosterStatus;
  team: Team | null;
  position: Position | null;
  joined_at: string;
  profile: Profile;
}

export interface MatchDetail extends Match {
  roster: RosterEntry[];
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
