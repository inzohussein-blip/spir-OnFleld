import type { Match } from './types';

/**
 * حساب الأرباح والامتلاء من المباريات:
 * - المباراة المسكّرة: يدفع الحاضر والغايب (الغايب ينخصم عليه)
 * - المنتهية بدون إغلاق: نحسب المنضمين
 * - الجاية: ما تنحسب أرباح، بس الامتلاء المتوقع
 */
const priceOf = (m: Pick<Match, 'cost_per_player' | 'discount_pct'>) =>
  m.cost_per_player == null ? 0 : Math.round((m.cost_per_player * (100 - Math.min(90, Math.max(0, m.discount_pct ?? 0)))) / 100);

export function paidPlayers(m: Match): number {
  if (m.closed_at) return (m.attended_count ?? 0) + (m.no_show_count ?? 0);
  return m.joined_count;
}

export const matchRevenue = (m: Match) => paidPlayers(m) * priceOf(m);

export interface RevenueSummary {
  revenue: number;
  matches: number;
  players: number;
  /** متوسط الامتلاء 0–1 */
  fill: number;
  noShows: number;
  noShowFines: number;
  discountGiven: number;
  byVenue: { name: string; revenue: number; matches: number; fill: number }[];
  byDay: { key: string; revenue: number; matches: number }[];
  /** الامتلاء حسب يوم الأسبوع (0=الأحد) والساعة — null إذا ماكو مباريات */
  heat: (number | null)[][];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function summarize(list: Match[], now = Date.now()): RevenueSummary {
  const done = list.filter((m) => new Date(m.ends_at).getTime() <= now && m.status !== 'cancelled');
  const venues = new Map<string, { name: string; revenue: number; matches: number; fillSum: number }>();
  const days = new Map<string, { revenue: number; matches: number }>();
  const heatSum = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const heatN = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let revenue = 0, players = 0, fillSum = 0, noShows = 0, noShowFines = 0, discountGiven = 0;
  for (const m of done) {
    const r = matchRevenue(m);
    const fill = m.max_players ? Math.min(1, m.joined_count / m.max_players) : 0;
    revenue += r;
    players += paidPlayers(m);
    fillSum += fill;
    noShows += m.no_show_count ?? 0;
    noShowFines += (m.no_show_count ?? 0) * priceOf(m);
    discountGiven += paidPlayers(m) * ((m.cost_per_player ?? 0) - priceOf(m));
    const vk = m.venue_name ?? '—';
    const v = venues.get(vk) ?? { name: vk, revenue: 0, matches: 0, fillSum: 0 };
    v.revenue += r;
    v.matches += 1;
    v.fillSum += fill;
    venues.set(vk, v);
    const start = new Date(m.starts_at);
    const dk = dayKey(start);
    const d = days.get(dk) ?? { revenue: 0, matches: 0 };
    d.revenue += r;
    d.matches += 1;
    days.set(dk, d);
    heatSum[start.getDay()][start.getHours()] += fill;
    heatN[start.getDay()][start.getHours()] += 1;
  }
  return {
    revenue,
    matches: done.length,
    players,
    fill: done.length ? fillSum / done.length : 0,
    noShows,
    noShowFines,
    discountGiven,
    byVenue: [...venues.values()].map((v) => ({ name: v.name, revenue: v.revenue, matches: v.matches, fill: v.fillSum / v.matches })).sort((a, b) => b.revenue - a.revenue),
    byDay: [...days.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key)),
    heat: heatSum.map((row, d) => row.map((s, h) => (heatN[d][h] ? s / heatN[d][h] : null))),
  };
}
