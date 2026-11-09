// يضيف مسار الاستضافة (مثلاً /spir-OnFleld على GitHub Pages) عند البناء
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    typedRoutes: false,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
