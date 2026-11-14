// حسابات الموقع وروابط الاتجاهات — بدون مكتبات وبدون مفاتيح
const formatNumber = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export interface LatLng {
  lat: number;
  lng: number;
}

/** مركز الخريطة الافتراضي: بغداد */
export const IRAQ_CENTER: LatLng = { lat: 33.3152, lng: 44.3661 };

/** المسافة بالكيلومتر بين نقطتين (هافرساين) */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** «يبعد 800 م» / «يبعد 3.4 كم» / «يبعد 120 كم» */
export function formatDistance(km: number): string {
  if (km < 1) return `يبعد ${formatNumber(Math.max(50, Math.round((km * 1000) / 50) * 50))} م`;
  if (km < 10) return `يبعد ${(Math.round(km * 10) / 10).toFixed(1).replace(/\.0$/, '')} كم`;
  return `يبعد ${formatNumber(Math.round(km))} كم`;
}

export type DirectionsApp = 'apple' | 'google';

/** رابط الاتجاهات: خرائط آبل على الآيفون، وخرائط كوكل بغيره */
export function directionsUrl(app: DirectionsApp, to: LatLng, label?: string): string {
  const q = label ? `&q=${encodeURIComponent(label)}` : '';
  if (app === 'apple') return `https://maps.apple.com/?daddr=${to.lat},${to.lng}${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`;
}

export const hasCoords = <T extends { lat?: number | null; lng?: number | null }>(v: T): v is T & LatLng =>
  typeof v.lat === 'number' && typeof v.lng === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lng);

/** أكبر تجمّع ملاعب (ضمن نصف قطر) — الخريطة تنفتح عليه بدل ما تبيّن العراق كله والدبابيس فوق بعض */
export function mainCluster<T extends LatLng>(points: T[], radiusKm = 40): T[] {
  let best: T[] = [];
  for (const p of points) {
    const near = points.filter((q) => distanceKm(p, q) <= radiusKm);
    if (near.length > best.length) best = near;
  }
  return best;
}
