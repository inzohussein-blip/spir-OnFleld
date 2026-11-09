import type { Position, SkillLevel } from './types';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

export const formatIQD = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;

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
