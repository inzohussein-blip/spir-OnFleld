import type { Ad, AdInput, AdTemplate } from './types';

/** معلومات كل قالب: اسمه، شنو فايدته، شنو الحقول الإضافية، والمحتوى المقترح */
export const AD_TEMPLATES: Record<AdTemplate, {
  label: string;
  hint: string;
  badgeLabel?: string;
  countdown?: boolean;
  rating?: boolean;
  image?: boolean;
  defaults: Pick<AdInput, 'eyebrow' | 'title' | 'body' | 'cta' | 'link' | 'badge' | 'rating'>;
}> = {
  services: {
    label: 'خدمات المباراة',
    hint: 'يبيع الحكم والكرات والمياه والتصوير ويّا الحجز',
    defaults: { eyebrow: 'خدمات المباراة', title: 'حكم، كرات وتصوير', body: 'اطلبها ويّا حجزك، ويّا المياه والإسعافات', cta: 'اطلبها هسه', link: '/chats', badge: null, rating: null },
  },
  league: {
    label: 'البطولات',
    hint: 'كأس ذهبي وعداد تنازلي لنهاية التسجيل',
    countdown: true,
    defaults: { eyebrow: 'التسجيل مفتوح', title: 'دوري بالملعب', body: '8 فرق · ملاعب النخيل · كأس وميداليات', cta: 'سجّل فريقك', link: '/tournaments', badge: null, rating: null },
  },
  motm: {
    label: 'رجل المباراة',
    hint: 'بطاقة لاعب ذهبية تشجّع على اللعب والتقييم',
    badgeLabel: 'رقم البطاقة',
    defaults: { eyebrow: 'رجل المباراة', title: 'العب زين.. واكسب', body: 'أفضل لاعب ياخذ 10,000 د.ع بمحفظته', cta: 'شوف الشروط', link: '/wallet', badge: '88', rating: null },
  },
  offpeak: {
    label: 'عروض الأوقات الهادئة',
    hint: 'يملّي ساعات الصبح والعصر الفارغة',
    badgeLabel: 'نسبة الخصم',
    defaults: { eyebrow: 'عرض العصرية', title: 'خصم 25% قبل الساعة 5', body: 'مباريات الصبح والعصر بسعر أقل', cta: 'شوف المباريات', link: '/venues', badge: '25%', rating: null },
  },
  invite: {
    label: 'ادعُ أصدقاءك',
    hint: 'يكبّر عدد اللاعبين برابط الدعوة',
    defaults: { eyebrow: 'ادعُ أصدقاءك', title: '3 أصدقاء = مباراة ببلاش', body: 'لما يلعبون أول مباراة، حصتك علينا', cta: 'ادعُ هسه', link: '/invite', badge: null, rating: null },
  },
  partner: {
    label: 'ملعب شريك',
    hint: 'إعلان مدفوع لملعب مسجّل بصورته وتقييمه',
    rating: true,
    image: true,
    defaults: { eyebrow: 'المنصور', title: 'ملاعب النخيل', body: 'عشب جديد · إنارة ليلية · موقف سيارات', cta: 'احجز بالنخيل', link: '/venue/v1', badge: null, rating: 4.8 },
  },
};

export const AD_TEMPLATE_ORDER: AdTemplate[] = ['services', 'league', 'motm', 'offpeak', 'invite', 'partner'];

/** وين يودي زر الإعلان (الملعب المحدد يتضاف من قائمة الملاعب) */
export const AD_LINKS: { value: string | null; label: string }[] = [
  { value: null, label: 'بدون رابط' },
  { value: '/venues', label: 'الملاعب' },
  { value: '/tournaments', label: 'البطولات' },
  { value: '/wallet', label: 'المحفظة' },
  { value: '/suggest', label: 'اقترح مباراة' },
  { value: '/teams', label: 'فريقي' },
  { value: '/map', label: 'الخريطة' },
  { value: '/chats', label: 'المحادثات والدعم' },
  { value: '/invite', label: 'صفحة ادعُ أصدقاءك' },
  { value: 'share:invite', label: 'مشاركة رابط الدعوة' },
];

/** إعلان جديد من قالب، بالمحتوى المقترح */
export function adFromTemplate(template: AdTemplate, now = new Date()): AdInput {
  const t = AD_TEMPLATES[template];
  return {
    template,
    ...t.defaults,
    countdown_to: t.countdown ? new Date(now.getTime() + 5 * 86400000).toISOString() : null,
    image_url: null,
    city: null,
    starts_at: null,
    ends_at: null,
    active: true,
    sort: AD_TEMPLATE_ORDER.indexOf(template),
  };
}

export type AdState = 'live' | 'paused' | 'scheduled' | 'ended';

/** حالة الإعلان الآن */
export function adState(ad: Pick<Ad, 'active' | 'starts_at' | 'ends_at'>, now = Date.now()): AdState {
  if (!ad.active) return 'paused';
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return 'scheduled';
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return 'ended';
  return 'live';
}

export const AD_STATE_LABEL: Record<AdState, string> = { live: 'يطلع هسه', paused: 'متوقف', scheduled: 'مجدول', ended: 'انتهى' };

/** الإعلانات اللي تطلع للاعب: فعّالة، ضمن وقتها، ولمدينته أو لكل المدن، مرتبة */
export function liveAdsFor<T extends Pick<Ad, 'active' | 'starts_at' | 'ends_at' | 'city' | 'sort' | 'created_at'>>(ads: T[], city: string | null, now = Date.now()): T[] {
  return ads
    .filter((a) => adState(a, now) === 'live' && (!a.city || !city || a.city === city))
    .sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
}

/** العد التنازلي: [أيام، ساعات، دقائق] — وإذا الوقت فات null */
export function countdownParts(to: string | null, now = Date.now()): [number, number, number] | null {
  if (!to) return null;
  const ms = new Date(to).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  return [Math.floor(mins / 1440), Math.floor((mins % 1440) / 60), mins % 60];
}

/** تاريخ من لوحة التحكم «2026-11-20» أو «2026-11-20 21:30» (توقيت الجهاز) → ISO، والفارغ null، والغلط undefined */
export function parseAdDate(text: string, endOfDay = false): string | null | undefined {
  const s = text.trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(s);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = m[4] !== undefined ? Number(m[4]) : endOfDay ? 23 : 0;
  const mi = m[5] !== undefined ? Number(m[5]) : endOfDay ? 59 : 0;
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || h > 23 || mi > 59) return undefined;
  return date.toISOString();
}

/** عكس parseAdDate لعرض التاريخ بحقل الإدخال */
export function formatAdDate(iso: string | null, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${day} ${p(d.getHours())}:${p(d.getMinutes())}` : day;
}

/** أخطاء الإعلان قبل الحفظ */
export function adError(ad: AdInput): string | null {
  if (ad.title.trim().length < 3) return 'اكتب عنوان للإعلان';
  if (ad.title.trim().length > 40) return 'العنوان طويل — خليه أقل من 40 حرف';
  if (ad.body.trim().length > 70) return 'السطر الثاني طويل — خليه أقل من 70 حرف';
  if (ad.starts_at && ad.ends_at && ad.ends_at < ad.starts_at) return 'تاريخ النهاية قبل البداية';
  if (ad.rating !== null && (ad.rating < 0 || ad.rating > 5)) return 'التقييم من 0 لـ 5';
  return null;
}
