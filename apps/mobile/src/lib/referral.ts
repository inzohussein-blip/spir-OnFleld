import { Platform } from 'react-native';
import { normalizePublicId } from './teams';

/**
 * رابط الدعوة على الويب: https://…/?ref=7310524
 * نحفظ الرقم أول ما تنفتح الصفحة، وشاشة التسجيل تعبّيه تلقائياً.
 */
const KEY = 'balmalaab-ref';

export function captureRefFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const ref = normalizePublicId(new URLSearchParams(window.location.search).get('ref') ?? '');
    if (ref) window.localStorage.setItem(KEY, ref);
  } catch {
    /* التخزين مقفول — عادي */
  }
}

export function pendingRef(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearPendingRef() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* عادي */
  }
}
