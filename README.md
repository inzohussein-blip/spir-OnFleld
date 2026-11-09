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

```bash
cd apps/mobile
npm install
npm run web        # في المتصفح
npm run android    # على جهاز/محاكي أندرويد
npm run typecheck && npm test
```
