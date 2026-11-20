import type { Position, SkillLevel, TournamentStatus } from './types';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

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

/** نوع المباراة بالاسم: خماسي، سداسي، سباعي… و«11 لاعب» للملعب الكبير */
const FORMAT_NAME: Record<number, string> = { 3: 'ثلاثي', 4: 'رباعي', 5: 'خماسي', 6: 'سداسي', 7: 'سباعي', 8: 'ثماني', 9: 'تساعي', 10: 'عشاري', 11: '11 لاعب' };
export const formatFormat = (perSide: number) => FORMAT_NAME[perSide] ?? `${perSide} × ${perSide}`;

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

/** الساعة والدقيقة بنظام 12 ساعة: «9:15 م» */
export function formatClock(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
}

/** «الجمعة 2026/11/13» */
export function formatFullDate(d: Date) {
  return `${DAYS[d.getDay()]} ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export const weekdayName = (d: Date) => DAYS[d.getDay()];

/** «مباراة / مباراتين / 4 مباريات / 12 مباراة» — وصفر يرجع فارغ */
export function formatMatchCount(n: number) {
  if (n <= 0) return '';
  if (n === 1) return 'مباراة';
  if (n === 2) return 'مباراتين';
  return n <= 10 ? `${n} مباريات` : `${n} مباراة`;
}

/** جمع عربي مبسّط للأعداد: 1 ساعة، 2 ساعتان، 3-10 ساعات، 11+ ساعة */
function plural(n: number, one: string, two: string, few: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${one}`;
}

/** مدة متبقية مقروءة: «يومان و3 ساعات» / «4 ساعات و7 دقائق» / «دقيقة» */
export function formatCountdown(ms: number) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const d = days ? plural(days, 'يوم', 'يومان', 'أيام') : '';
  const h = hours ? plural(hours, 'ساعة', 'ساعتان', 'ساعات') : '';
  const m = mins ? plural(mins, 'دقيقة', 'دقيقتان', 'دقائق') : '';
  const parts = days ? [d, h] : [h, m];
  return parts.filter(Boolean).join(' و');
}

/** مدة مختصرة: «6:00 إلى 7:00 م»، أو «11:00 م إلى 12:30 ص» إذا اختلفت الفترة */
export function formatTimeRange(startIso: string, endIso: string) {
  const a = formatClock(startIso);
  const b = formatClock(endIso);
  const [aTime, aMer] = a.split(' ');
  const [, bMer] = b.split(' ');
  return aMer === bMer ? `${aTime} إلى ${b}` : `${a} إلى ${b}`;
}

/** تحية حسب الوقت: «صباح الخير» من 4 الفجر لـ 12 الظهر، وبعدها «مساء الخير» */
export const greetingFor = (hour: number) => (hour >= 4 && hour < 12 ? 'صباح الخير' : 'مساء الخير');

/** عنوان الرئيسية: الليلة من العصر وطالع */
export const readyHeadline = (hour: number) => (hour >= 15 || hour < 4 ? 'جاهز تلعب الليلة؟' : 'جاهز تلعب اليوم؟');

/** «اليوم / باجر / الأحد» نسبة لليوم الحالي */
export function relativeDay(d: Date, now = new Date()) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'باجر';
  return DAYS[d.getDay()];
}

/** اسم اليوم مختصر بدون «ال»: «الثلاثاء» ← «ثلاثاء» */
export const shortWeekday = (d: Date) => DAYS[d.getDay()].replace(/^ال/, '');
