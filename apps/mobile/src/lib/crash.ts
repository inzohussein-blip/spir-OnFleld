import { Platform } from 'react-native';
import { api } from './api';
import { APP_VERSION } from './updateCheck';

/**
 * تقارير الأعطال: أي خطأ ما انمسك (أو شاشة طاحت) يوصل للوحة التحكم
 * ويّا رسالة الخطأ وأول سطور منه ونوع التلفون ورقم النسخة والصفحة.
 * نفس الخطأ ما يتكرر بنفس الجلسة.
 */
const sent = new Set<string>();
let currentScreen: string | null = null;

export function setCrashScreen(path: string) {
  currentScreen = path;
}

/** نص الخطأ مختصر ومقطوع حتى يناسب حدود قاعدة البيانات */
export function crashPayload(error: unknown, screen: string | null) {
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error ?? 'خطأ غير معروف'));
  const message = (`${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message || 'خطأ'}`).slice(0, 500);
  const stack = e.stack ? e.stack.split('\n').slice(0, 25).join('\n').slice(0, 4000) : null;
  return { message, stack, platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', app_version: APP_VERSION, screen: screen?.slice(0, 120) ?? null } as const;
}

export function reportCrash(error: unknown) {
  try {
    const payload = crashPayload(error, currentScreen);
    const key = `${payload.message}|${payload.screen}`;
    if (sent.has(key)) return;
    sent.add(key);
    void api.reportCrash(payload).catch(() => {});
  } catch {
    /* مسجّل الأعطال ما يطيّح التطبيق */
  }
}

let installed = false;
/** يركّب الالتقاط العام: أخطاء JS على التلفون، وأخطاء الصفحة على الويب */
export function installCrashReporter() {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => reportCrash(e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => reportCrash(e.reason));
    return;
  }
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((error, fatal) => {
    reportCrash(error);
    previous(error, fatal);
  });
}
