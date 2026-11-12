# بالملعب ⚽

منصة عربية لحجز ساحات كرة القدم (خماسي / سباعي / أي عدد)، وتنظيم المباريات، وتجهيز الفرق، وتقييم اللاعبين.

- 📱 **تطبيق اللاعبين** (`apps/mobile`): أندرويد + ويب آب (PWA) للآيفون — كود واحد بـ Expo.
- 🗄️ **الخلفية** (`supabase/`): PostgreSQL + مصادقة OTP + صلاحيات RLS.
- 📄 [خطة المشروع الكاملة](docs/PLAN.md)

## تنزيل تطبيق الأندرويد (APK)

يُبنى تلقائياً على GitHub مع كل تحديث:

1. افتح تبويب **Actions** ← **Android APK** ← آخر تشغيل ناجح.
2. نزّل **balmalaab-android** من أسفل الصفحة (ملف zip فيه الـ APK).
3. انقله للهاتف وثبّته (اسمح بالتثبيت من مصادر غير معروفة).

لإصدار رسمي في تبويب Releases: أنشئ وسماً مثل `v0.1.0` وادفعه.

## نسخة الآيفون (ويب آب)

1. في إعدادات المستودع: **Settings ← Pages ← Source: GitHub Actions** (مرة واحدة).
2. بعد الدمج في فرع `main` يُنشر التطبيق على `https://<اسم-المستخدم>.github.io/spir-OnFleld/`.
3. على الآيفون: افتح الرابط في Safari ← زر المشاركة ← **إضافة إلى الشاشة الرئيسية**.

## الوضع التجريبي وربط Supabase

بدون إعداد، يعمل التطبيق **بوضع تجريبي** ببيانات وهمية على الجهاز (رمز الدخول: `1234`).

للربط بقاعدة بيانات حقيقية:

1. أنشئ مشروعاً على [supabase.com](https://supabase.com) ونفّذ ملفات `supabase/migrations` بالترتيب.
2. فعّل الدخول برقم الهاتف (Authentication ← Providers ← Phone) واربطه بمزوّد SMS.
3. أضف في **Settings ← Secrets and variables ← Actions**:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## التطوير محلياً

يتطلب Node.js 22.18 أو أحدث (يُبنى على GitHub بـ Node 26 LTS).

```bash
cd apps/mobile
npm install
npm run web        # في المتصفح
npm run android    # على جهاز/محاكي أندرويد
npm run typecheck && npm run lint && npm test   # TypeScript 7 + ESLint 10 + الاختبارات
```

## الإصدارات

كل المكتبات بأحدث إصدار متاح:

| المكوّن | الإصدار |
|--------|---------|
| Expo SDK | 58 (أحدث إصدار) |
| React / React DOM | 19.3.1 |
| React Native | 0.88.1 |
| AsyncStorage | 3.1.1 |
| TypeScript (فحص الأنواع) | 7.0.2 |
| ESLint | 10 — مع typescript-eslint و @eslint-react و import-x و react-hooks |
| Supabase JS | 2.119 |
| Node.js في GitHub Actions | 26 LTS |

ملاحظة: حزمة `typescript` 6.0 موجودة أيضاً لأن أداة `typescript-eslint` (أحدث إصدار) تدعم حتى TypeScript 6.0 فقط؛ فحص الأنواع نفسه (`npm run typecheck`) يعمل بـ TypeScript 7.

## الأرقام

كل الأرقام تُعرض بالصيغة 1، 2، 3 على كل الأجهزة. وإذا كتب المستخدم أرقاماً عربية-هندية (٠١٢…) في أي حقل، تتحول تلقائياً إلى 0-9.
