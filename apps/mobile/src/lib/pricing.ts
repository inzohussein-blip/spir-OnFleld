import type { Match } from './types';

/** سعر اللاعب بعد خصم الأوقات الهادئة (نفس حساب قاعدة البيانات) */
export function finalPrice(m: Pick<Match, 'cost_per_player' | 'discount_pct'>): number | null {
  if (m.cost_per_player == null) return null;
  const pct = Math.min(90, Math.max(0, m.discount_pct ?? 0));
  return Math.round((m.cost_per_player * (100 - pct)) / 100);
}

/** الأوقات الهادئة: قبل الساعة 5 العصر — نقترح خصم 25% */
export const OFF_PEAK_END_HOUR = 17;
export const suggestedDiscount = (hour: number) => (hour < OFF_PEAK_END_HOUR ? 25 : 0);

export const DISCOUNT_OPTIONS = [0, 10, 15, 20, 25, 30, 50];
