import type { Match } from './types';

export type SpotsTone = 'ok' | 'few' | 'full';

/** «باقي 3» بلون حسب الإلحاح: أخضر كثير، برتقالي قليل، أحمر مكتملة */
export function spotsInfo(m: Pick<Match, 'joined_count' | 'max_players'>): { left: number; label: string; tone: SpotsTone } {
  const left = Math.max(0, m.max_players - m.joined_count);
  if (left === 0) return { left, label: 'مكتملة', tone: 'full' };
  const label = left === 1 ? 'باقي مكان واحد' : left === 2 ? 'باقي مكانين' : `باقي ${left}`;
  const few = left <= Math.max(2, Math.floor(m.max_players * 0.2));
  return { left, label, tone: few ? 'few' : 'ok' };
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** عدد المباريات بكل يوم من أيام الشريط */
export function dayCounts(matches: Pick<Match, 'starts_at'>[], days: Date[]): number[] {
  return days.map((d) => matches.filter((m) => sameDay(new Date(m.starts_at), d)).length);
}

/** أول يوم بيه مباريات (حتى تنفتح الرئيسية على يوم مفيد) — وإلا اليوم الأول */
export function firstDayWithMatches(counts: number[]): number {
  const i = counts.findIndex((n) => n > 0);
  return i === -1 ? 0 : i;
}

/** موعد تذكير اللاعب: قبل المباراة بساعتين (null إذا فات) */
export function reminderAt(m: Pick<Match, 'starts_at'>, now: number, hoursBefore = 2): Date | null {
  const at = new Date(m.starts_at).getTime() - hoursBefore * 3600_000;
  return at > now ? new Date(at) : null;
}
