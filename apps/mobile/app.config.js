// يضيف مسار الاستضافة (مثلاً /spir-OnFleld على GitHub Pages) عند البناء،
// ويحسب رقم بناء الأندرويد من رقم الإصدار (0.2.1 → 201) حتى كل نسخة جديدة تنثبّت فوق القديمة.
function versionCodeOf(v) {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(v ?? ''));
  if (!m) return 1;
  return Math.max(1, Number(m[1]) * 10000 + Number(m[2] ?? 0) * 100 + Number(m[3] ?? 0));
}

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: versionCodeOf(config.version) },
  experiments: {
    ...config.experiments,
    typedRoutes: false,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
