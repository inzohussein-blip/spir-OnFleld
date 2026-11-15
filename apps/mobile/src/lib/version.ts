/** أرقام الإصدارات وفحص التحديث — دوال صافية بدون شبكة حتى تنفحص بسهولة */

/** "v1.2.3" أو "1.2" → [1, 2, 3] / [1, 2, 0]، وأي شي غير هذا → null */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec((v ?? '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** موجب إذا a أحدث من b، سالب إذا أقدم، صفر إذا نفسه (أو واحد منهم مو رقم إصدار) */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** رقم البناء للأندرويد (versionCode) من رقم الإصدار: 1.2.3 → 10203 */
export function versionCodeOf(v: string): number {
  const p = parseVersion(v);
  if (!p) return 1;
  return Math.max(1, p[0] * 10000 + p[1] * 100 + p[2]);
}

/** شكل إصدار GitHub كما يرجع من الـ API (بس الحقول اللي نحتاجها) */
export type GithubRelease = {
  tag_name: string;
  draft?: boolean;
  body?: string | null;
  published_at?: string | null;
  html_url?: string;
  assets?: { name: string; browser_download_url: string }[];
};

export type AvailableUpdate = { version: string; url: string; notes: string | null; publishedAt: string | null };

/** أحدث إصدار فيه ملف APK وأحدث من النسخة الحالية، وإلا null */
export function pickUpdate(releases: GithubRelease[], current: string): AvailableUpdate | null {
  let best: AvailableUpdate | null = null;
  if (!Array.isArray(releases)) return null;
  for (const r of releases) {
    if (r.draft || !parseVersion(r.tag_name)) continue;
    const apk = r.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
    if (!apk) continue;
    const version = r.tag_name.replace(/^v/, '');
    if (compareVersions(version, current) <= 0) continue;
    if (best && compareVersions(version, best.version) <= 0) continue;
    best = { version, url: apk.browser_download_url, notes: r.body?.trim() || null, publishedAt: r.published_at ?? null };
  }
  return best;
}
