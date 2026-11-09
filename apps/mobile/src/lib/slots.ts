import type { Field } from './types';

export interface Slot {
  hour: number;
  start: Date;
  end: Date;
  available: boolean;
}

export interface BusyRange {
  starts_at: string;
  ends_at: string;
}

/** يحسب الساعات المتاحة لملعب في يوم معيّن، مع استبعاد المحجوز والماضي. */
export function computeSlots(field: Pick<Field, 'open_hour' | 'close_hour'>, day: Date, busy: BusyRange[], now = new Date()): Slot[] {
  const slots: Slot[] = [];
  for (let h = field.open_hour; h < field.close_hour; h++) {
    const start = new Date(day);
    start.setHours(h, 0, 0, 0);
    const end = new Date(start);
    end.setHours(h + 1);
    const overlaps = busy.some((b) => new Date(b.starts_at) < end && new Date(b.ends_at) > start);
    slots.push({ hour: h, start, end, available: !overlaps && start > now });
  }
  return slots;
}

export function nextDays(n: number, from = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}
