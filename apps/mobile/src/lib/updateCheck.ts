import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { pickUpdate, type AvailableUpdate, type GithubRelease } from './version';

/** رقم النسخة المثبّتة (من app.json) */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/** مستودع GitHub اللي تنشر عليه نسخ الأندرويد (من app.json ← extra.releasesRepo) */
const RELEASES_REPO: string | undefined = (Constants.expoConfig?.extra as { releasesRepo?: string } | undefined)?.releasesRepo;

/** رقم بناء نسخة الويب — يتحدد وقت البناء (GitHub Actions يحط رقم الـ commit) */
const WEB_BUILD: string | undefined = process.env.EXPO_PUBLIC_BUILD_ID || undefined;

export type UpdateResult = { kind: 'latest' } | { kind: 'available'; update: AvailableUpdate } | { kind: 'web-reload'; build: string };

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    throw new Error('ما كدرنا نفحص. تأكد من الإنترنت وارجع جرّب.');
  } finally {
    clearTimeout(timer);
  }
}

/** يفحص إذا أكو نسخة أحدث: الأندرويد من إصدارات GitHub، والويب من ملف version.json المنشور ويّا الموقع */
export async function checkForUpdate(): Promise<UpdateResult> {
  if (Platform.OS === 'web') {
    if (!WEB_BUILD || typeof window === 'undefined') return { kind: 'latest' };
    // version.json منشور بنفس مكان manifest.json (يراعي مسار الاستضافة مثل /spir-OnFleld)
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '/manifest.json';
    const live = await getJson<{ build?: string }>(`${manifest.replace(/manifest\.json$/, 'version.json')}?t=${Date.now()}`);
    return live.build && live.build !== WEB_BUILD ? { kind: 'web-reload', build: live.build } : { kind: 'latest' };
  }
  if (!RELEASES_REPO) return { kind: 'latest' };
  const releases = await getJson<GithubRelease[]>(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=20`);
  const update = pickUpdate(releases, APP_VERSION);
  return update ? { kind: 'available', update } : { kind: 'latest' };
}

/** الويب: يفتح الصفحة من جديد بالنسخة الجديدة (رابط مختلف حتى ما ياخذ الصفحة القديمة من الذاكرة) */
export function reloadWeb(build: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('v', build.slice(0, 7));
  window.location.replace(url.toString());
}
