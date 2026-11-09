// بعد `expo export --platform web`: يضيف ملف manifest وأيقونات الآيفون
// حتى يمكن «إضافة التطبيق إلى الشاشة الرئيسية» من Safari كتطبيق مستقل.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
const dist = new URL('../dist/', import.meta.url);

const manifest = {
  name: 'بالملعب',
  short_name: 'بالملعب',
  description: 'احجز ساحتك، كمّل فريقك، والعب',
  lang: 'ar',
  dir: 'rtl',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#1E4FD8',
  theme_color: '#1E4FD8',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
writeFileSync(new URL('manifest.json', dist), JSON.stringify(manifest, null, 2));

const tags = [
  `<link rel="manifest" href="${base}/manifest.json">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="بالملعب">',
].join('\n');

const indexUrl = new URL('index.html', dist);
let html = readFileSync(indexUrl, 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${tags}\n</head>`);
html = html.replace('<html lang="ar">', '<html lang="ar" dir="rtl">');
writeFileSync(indexUrl, html);
// GitHub Pages: أي مسار غير موجود يفتح التطبيق نفسه (توجيه داخلي)
copyFileSync(indexUrl, new URL('404.html', dist));
console.log('PWA: manifest + iOS meta added', base || '/');
