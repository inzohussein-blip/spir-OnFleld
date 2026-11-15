import type { Match } from './types';

/** فلاتر الرئيسية: نوع المباراة، الوقت، السعر، المنطقة، والملاعب المفضلة */
export type TimeOfDay = 'morning' | 'afternoon' | 'night';
export interface MatchFilters {
  formats: number[];
  time: TimeOfDay | null;
  maxPrice: number | null;
  area: string | null;
  favOnly: boolean;
}
export const EMPTY_FILTERS: MatchFilters = { formats: [], time: null, maxPrice: null, area: null, favOnly: false };

export const TIME_LABEL: Record<TimeOfDay, string> = { morning: 'الصبح', afternoon: 'العصر', night: 'الليل' };
export const PRICE_CAPS = [3000, 5000, 7000];

/** الصبح قبل 12، العصر لحد 5، وبعدها الليل */
export function timeOfDay(iso: string): TimeOfDay {
  const h = new Date(iso).getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'night';
}

/** المنطقة: أول جزء من عنوان الملعب («المنصور، قرب ساحة الرواد» ← «المنصور») */
export function areaOf(m: Pick<Match, 'venue_address' | 'venue_city'>): string | null {
  const a = (m.venue_address ?? '').split(/[،,]/)[0].trim();
  return a || m.venue_city || null;
}

export function applyFilters<T extends Match>(list: T[], f: MatchFilters, favVenues: Set<string>): T[] {
  return list.filter((m) => {
    if (f.formats.length && !f.formats.includes(m.players_per_side)) return false;
    if (f.time && timeOfDay(m.starts_at) !== f.time) return false;
    if (f.maxPrice !== null) {
      // نفس حساب pricing.finalPrice (نسخة هنا حتى الاختبارات تشتغل بدون استيراد)
      if (m.cost_per_player == null) return false;
      const p = Math.round((m.cost_per_player * (100 - Math.min(90, Math.max(0, m.discount_pct ?? 0)))) / 100);
      if (p > f.maxPrice) return false;
    }
    if (f.area && areaOf(m) !== f.area) return false;
    if (f.favOnly && !favVenues.has(m.venue_id ?? '')) return false;
    return true;
  });
}

export const activeFilterCount = (f: MatchFilters) => (f.formats.length ? 1 : 0) + (f.time ? 1 : 0) + (f.maxPrice !== null ? 1 : 0) + (f.area ? 1 : 0) + (f.favOnly ? 1 : 0);

/** خيارات الفلاتر من المباريات الموجودة (حتى ما نعرض نوع أو منطقة ماكو بيها مباريات) */
export function filterOptions(list: Match[]) {
  return {
    formats: [...new Set(list.map((m) => m.players_per_side))].sort((a, b) => a - b),
    areas: [...new Set(list.map(areaOf).filter((x): x is string => !!x))].sort(),
  };
}
