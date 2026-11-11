import type { Position, SkillLevel, TournamentStatus } from './types';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

/** تحويل الأرقام العربية-الهندية (٠١٢…) والفارسية (۰۱۲…) إلى 0-9 */
export function toWesternDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) & 0xf));
}

/** فاصل الآلاف بدون الاعتماد على لغة الجهاز — الأرقام دائماً 1,2,3 */
export const formatNumber = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const formatIQD = (n: number) => `${formatNumber(n)} د.ع`;

/** مبلغ بإشارة (+/−) معزول باتجاه LTR حتى لا تنقلب الإشارة داخل النص العربي */
export const formatSigned = (n: number) => `\u2066${n >= 0 ? '+' : '−'}${formatNumber(Math.abs(n))}\u2069 د.ع`;

export function formatHour(h: number) {
  const hh = h % 24;
  const suffix = hh < 12 ? 'ص' : 'م';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12} ${suffix}`;
}

export function formatDay(d: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'اليوم';
  if (same(d, tomorrow)) return 'غداً';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDay(d)} · ${formatHour(d.getHours())}`;
}

export const POSITION_LABEL: Record<Position, string> = {
  goalkeeper: 'حارس',
  defender: 'دفاع',
  midfielder: 'وسط',
  forward: 'هجوم',
  any: 'أي مركز',
};

export const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'محترف',
  open: 'مفتوح للجميع',
};

export const formatFormat = (perSide: number) => `${perSide} × ${perSide}`;

export const stars = (r: number) => `★ ${r.toFixed(1)}`;

export const TOURNAMENT_STATUS: Record<TournamentStatus, { label: string; tone: 'green' | 'yellow' | 'gray' }> = {
  registration: { label: 'التسجيل مفتوح', tone: 'green' },
  ongoing: { label: 'البطولة بدأت', tone: 'yellow' },
  finished: { label: 'انتهت', tone: 'gray' },
};

export const TRIAL_STATUS: Record<'upcoming' | 'open' | 'closed', { label: string; tone: 'green' | 'yellow' | 'gray' }> = {
  open: { label: 'التقديم مفتوح', tone: 'green' },
  upcoming: { label: 'قريباً', tone: 'yellow' },
  closed: { label: 'مغلق', tone: 'gray' },
};

/** «منذ ساعتين» / «أمس» / التاريخ */
export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'الآن';
  if (diff < 60) return `قبل ${Math.round(diff)} د`;
  if (diff < 60 * 24) return `قبل ${Math.round(diff / 60)} س`;
  if (diff < 60 * 48) return 'أمس';
  return formatDay(new Date(iso));
}

export const APP_LABEL = { pending: 'بانتظار الكشّاف', accepted: 'مقبول 🎉', rejected: 'لم تُقبل هذه المرة' } as const;
