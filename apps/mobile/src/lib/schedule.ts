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
/** تأكيد الحجز يوصل بعد نص ساعة من الانضمام */
export const CONFIRM_DELAY_MS = 30 * 60_000;
/** والتذكير قبل المباراة بساعة */
export const REMIND_BEFORE_MS = 60 * 60_000;

/**
 * مواعيد إشعارات الحجز:
 * - «تم الحجز» بعد نص ساعة من الانضمام، ويّاه «تعال قبل ربع ساعة».
 * - إذا المباراة أقرب من نص ساعة: التأكيد يوصل فوراً (`soon`) وما نحتاج تذكير.
 * - تذكير قبل المباراة بساعة، بس إذا يجي بعد التأكيد بوقت كافي (5 دقايق).
 */
export function joinAlertPlan(startsAt: string, now: number): { confirmAt: number; reminderAt: number | null; soon: boolean } | null {
  const start = new Date(startsAt).getTime();
  if (!(start > now)) return null;
  if (start - now <= CONFIRM_DELAY_MS) return { confirmAt: now, reminderAt: null, soon: true };
  const confirmAt = now + CONFIRM_DELAY_MS;
  const remind = start - REMIND_BEFORE_MS;
  return { confirmAt, reminderAt: remind > confirmAt + 5 * 60_000 ? remind : null, soon: false };
}

export function reminderAt(m: Pick<Match, 'starts_at'>, now: number, hoursBefore = 2): Date | null {
  const at = new Date(m.starts_at).getTime() - hoursBefore * 3600_000;
  return at > now ? new Date(at) : null;
}
