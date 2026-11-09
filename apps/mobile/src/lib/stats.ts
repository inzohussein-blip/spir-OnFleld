import type { Attributes, Fixture, PitchSlot, PlayerCard, Position, TournamentTeam } from './types';

// ---------- جدول ترتيب المجموعات ----------
export interface StandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** يحسب الترتيب من مباريات دور المجموعات: النقاط ← فارق الأهداف ← الأهداف المسجلة ← الاسم */
export function computeStandings(teams: TournamentTeam[], fixtures: Fixture[]): Record<string, StandingRow[]> {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) rows.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });

  for (const f of fixtures) {
    if (f.stage !== 'group' || f.home_score == null || f.away_score == null || !f.home_id || !f.away_id) continue;
    const h = rows.get(f.home_id);
    const a = rows.get(f.away_id);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += f.home_score; h.ga += f.away_score;
    a.gf += f.away_score; a.ga += f.home_score;
    if (f.home_score > f.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (f.home_score < f.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  const groups: Record<string, StandingRow[]> = {};
  for (const r of rows.values()) {
    r.gd = r.gf - r.ga;
    const g = r.team.group_name ?? '-';
    (groups[g] ??= []).push(r);
  }
  for (const g of Object.keys(groups)) {
    groups[g].sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name, 'ar'));
  }
  return groups;
}

// ---------- التقييم العام للبطاقة ----------
const WEIGHTS: Record<Position, Attributes> = {
  goalkeeper: { pace: 0.1, shooting: 0.05, passing: 0.15, dribbling: 0.05, defending: 0.4, physical: 0.25 },
  defender: { pace: 0.15, shooting: 0.05, passing: 0.15, dribbling: 0.1, defending: 0.35, physical: 0.2 },
  midfielder: { pace: 0.15, shooting: 0.15, passing: 0.3, dribbling: 0.2, defending: 0.1, physical: 0.1 },
  forward: { pace: 0.25, shooting: 0.35, passing: 0.1, dribbling: 0.2, defending: 0.02, physical: 0.08 },
  any: { pace: 1 / 6, shooting: 1 / 6, passing: 1 / 6, dribbling: 1 / 6, defending: 1 / 6, physical: 1 / 6 },
};

export function overallOf(a: Attributes, position: Position): number {
  const w = WEIGHTS[position];
  const total = (Object.keys(w) as (keyof Attributes)[]).reduce((s, k) => s + a[k] * w[k], 0);
  return Math.round(Math.max(1, Math.min(99, total)));
}

/** خصائص افتراضية مشتقة من مستوى اللاعب (1-5) عندما لا توجد تقييمات تفصيلية */
export function attributesFromRating(rating: number, position: Position): Attributes {
  const base = Math.round(40 + (rating - 1) * 12.5); // 1 → 40 ، 5 → 90
  const bump = (n: number) => Math.max(20, Math.min(99, base + n));
  switch (position) {
    case 'goalkeeper':
      return { pace: bump(-12), shooting: bump(-20), passing: bump(-6), dribbling: bump(-15), defending: bump(6), physical: bump(4) };
    case 'defender':
      return { pace: bump(-3), shooting: bump(-12), passing: bump(-3), dribbling: bump(-8), defending: bump(7), physical: bump(5) };
    case 'midfielder':
      return { pace: bump(0), shooting: bump(-2), passing: bump(6), dribbling: bump(4), defending: bump(-6), physical: bump(-2) };
    case 'forward':
      return { pace: bump(5), shooting: bump(7), passing: bump(-3), dribbling: bump(4), defending: bump(-18), physical: bump(-2) };
    default:
      return { pace: base, shooting: base, passing: base, dribbling: base, defending: base, physical: base };
  }
}

export type CardTier = 'bronze' | 'silver' | 'gold' | 'elite';
export const tierOf = (overall: number): CardTier => (overall >= 85 ? 'elite' : overall >= 75 ? 'gold' : overall >= 65 ? 'silver' : 'bronze');

export const POSITION_CODE: Record<Position, string> = { goalkeeper: 'حارس', defender: 'دفاع', midfielder: 'وسط', forward: 'هجوم', any: 'متعدد' };

// ---------- تشكيلة الأسبوع (4-3-3) ----------
const SLOTS: { slot: PitchSlot; pos: Position }[] = [
  { slot: 'GK', pos: 'goalkeeper' },
  { slot: 'LB', pos: 'defender' }, { slot: 'CB1', pos: 'defender' }, { slot: 'CB2', pos: 'defender' }, { slot: 'RB', pos: 'defender' },
  { slot: 'CM1', pos: 'midfielder' }, { slot: 'CM2', pos: 'midfielder' }, { slot: 'CM3', pos: 'midfielder' },
  { slot: 'LW', pos: 'forward' }, { slot: 'ST', pos: 'forward' }, { slot: 'RW', pos: 'forward' },
];

/** يختار أفضل لاعب لكل مركز؛ إن نقص مركز يُكمل بأفضل المتبقين */
export function pickTeamOfWeek(cards: PlayerCard[]): { slot: PitchSlot; card: PlayerCard }[] {
  const score = (c: PlayerCard) => c.overall + c.stats.goals * 2 + c.stats.assists * 1.5 + c.stats.mvps * 3;
  const pool = [...cards].sort((a, b) => score(b) - score(a));
  const used = new Set<string>();
  const out: { slot: PitchSlot; card: PlayerCard }[] = [];
  for (const s of SLOTS) {
    const pick = pool.find((c) => !used.has(c.profile.id) && c.profile.preferred_position === s.pos);
    if (pick) { used.add(pick.profile.id); out.push({ slot: s.slot, card: pick }); }
  }
  for (const s of SLOTS) {
    if (out.some((o) => o.slot === s.slot)) continue;
    const pick = pool.find((c) => !used.has(c.profile.id) && (s.pos !== 'goalkeeper'));
    if (pick) { used.add(pick.profile.id); out.push({ slot: s.slot, card: pick }); }
  }
  return out;
}
