/** الإعلانات اللي سكّرها اللاعب: ما ترجع تطلع لحد باجر (محفوظة على الجهاز) */
export type Dismissed = Record<string, string>;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** سكّرته اليوم؟ */
export const isDismissedToday = (map: Dismissed, adId: string, now = new Date()) => map[adId] === dayKey(now);

/** يسجّل إنه انسكّر اليوم، ويشيل القديم */
export function dismissToday(map: Dismissed, adId: string, now = new Date()): Dismissed {
  const today = dayKey(now);
  const next: Dismissed = {};
  for (const [k, v] of Object.entries(map)) if (v === today) next[k] = v;
  next[adId] = today;
  return next;
}

/** أول إعلان ما انسكّر اليوم */
export function firstVisible<T extends { id: string }>(ads: T[], map: Dismissed, now = new Date()): T | null {
  return ads.find((a) => !isDismissedToday(map, a.id, now)) ?? null;
}
