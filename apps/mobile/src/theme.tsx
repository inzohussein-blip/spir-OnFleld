import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';

/**
 * نظام التصميم «ملكي»: أزرق ملكي وأصفر بلون القمصان، وكحلي للكتابة.
 * الأزرق للرأس والشريط والعناوين، والأصفر للفعل الأساسي (انضم، اليوم المختار…)
 * ويّا ظل كحلي حاد تحته، ونقاط مثل قماش القمصان بالرأس.
 */
export type Palette = {
  /** الأزرق الملكي: الأيقونات، الروابط، العناوين الملوّنة */
  primary: string;
  /** الكحلي: الظل الحاد تحت الأزرار، ولوحة النتيجة */
  primaryDark: string;
  primarySoft: string;
  onPrimary: string;
  /** الأصفر: الزر الأساسي والمختار */
  cta: string;
  /** لون الكتابة فوق الأصفر */
  onCta: string;
  accent: string;
  accentSoft: string;
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  dangerSoft: string;
  warnSoft: string;
  warnText: string;
  success: string;
  successSoft: string;
  teamA: string;
  teamB: string;
  /** خلفية رأس الصفحات الداخلية */
  header: string;
  /** خلفية رأس الأقسام والشريط السفلي (الأزرق الملكي) */
  bandBg: string;
  bandGradient: string;
  primaryGradient: string;
  /** لون أرضية الملعب بصور الملاعب الافتراضية */
  pitch: string;
  // ---------- الرأس والشريط السفلي (يتغيّرون حسب الثيم) ----------
  /** خلفية رأس الصفحات */
  headerBg: string;
  /** زخرفة الرأس (backgroundImage) — فارغ = بدون */
  headerImage: string;
  /** الكتابة فوق الرأس */
  onHeader: string;
  onHeaderMuted: string;
  /** نقاط القمصان فوق الرأس */
  headerDots: string;
  /** خلفية الشريط السفلي، والقسم النشط وغير النشط */
  tabBg: string;
  tabActive: string;
  tabInactive: string;
  /** عمود الوقت ببطاقة المباراة */
  timeBg: string;
  onTime: string;
  onTimeSub: string;
  /** سماء صفحة المباراة */
  heroSky: string;
  /** الشريط المايل الرفيع (الثاني) بالرأس */
  stripeAlt: string;
  /** زوايا الشريط السفلي من فوك، وخط تحت القسم النشط */
  tabRound: number;
  tabUnderline: boolean;
  /** زر «✓ منضم» */
  doneBg: string;
  doneFg: string;
  /** خلفية الإعلانات الزرقاء (فارغ = ألوان القالب نفسه) */
  adSky: string;
};

/** الثيمات: الأزرق (ملكي)، الأسود، برشلونة، ريال مدريد */
export type ThemeName = 'royal' | 'black' | 'barca' | 'madrid';
export const THEMES: { id: ThemeName; label: string; swatch: [string, string] }[] = [
  { id: 'royal', label: 'الأزرق', swatch: ['#1A23C9', '#FFD60A'] },
  { id: 'black', label: 'الأسود', swatch: ['#121D33', '#FFCC03'] },
  { id: 'barca', label: 'برشلونة', swatch: ['#004D98', '#A50044'] },
  { id: 'madrid', label: 'ريال مدريد', swatch: ['#00529F', '#FEBE10'] },
];

const ROYAL = '#1A23C9';
const NAVY = '#0B1033';
const YELLOW = '#FFD60A';
/** تدرّج بلون واحد — للعناصر اللي تستعمل backgroundImage */
const flat = (c: string) => `linear-gradient(0deg, ${c} 0%, ${c} 100%)`;

export const light: Palette = {
  primary: ROYAL,
  primaryDark: NAVY,
  primarySoft: '#E3E6FF',
  onPrimary: '#FFFFFF',
  cta: YELLOW,
  onCta: NAVY,
  accent: '#E0A800',
  accentSoft: '#FFF6C2',
  bg: '#EEF0FF',
  card: '#FFFFFF',
  cardAlt: '#E6E9FB',
  text: NAVY,
  muted: '#4A5185',
  border: '#C9CEF5',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF6C2',
  warnText: '#6B5300',
  success: '#167A43',
  successSoft: '#E5F6EC',
  teamA: ROYAL,
  teamB: '#E8590C',
  header: ROYAL,
  bandBg: ROYAL,
  bandGradient: flat(ROYAL),
  primaryGradient: flat(ROYAL),
  pitch: '#1C8B4A',
  headerBg: ROYAL,
  headerImage: '',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.8)',
  headerDots: 'rgba(255,255,255,0.16)',
  tabBg: ROYAL,
  tabActive: YELLOW,
  tabInactive: '#C9CEF5',
  timeBg: ROYAL,
  onTime: '#FFFFFF',
  onTimeSub: YELLOW,
  heroSky: 'radial-gradient(120% 90% at 50% 0%, #2B3BFF 0%, #141C8F 55%, #0B1033 100%)',
  stripeAlt: YELLOW,
  tabRound: 0,
  tabUnderline: false,
  doneBg: '#E3E6FF',
  doneFg: ROYAL,
  adSky: '',
};

export const dark: Palette = {
  primary: '#8A93FF',
  primaryDark: '#000000',
  primarySoft: '#1B2160',
  onPrimary: '#FFFFFF',
  cta: YELLOW,
  onCta: NAVY,
  accent: YELLOW,
  accentSoft: '#3A3010',
  bg: '#070A24',
  card: '#10153D',
  cardAlt: '#171D4F',
  text: '#EEF0FF',
  muted: '#A3A9D9',
  border: '#252C6B',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1F',
  warnSoft: '#3A3010',
  warnText: '#F5D77A',
  success: '#34C38F',
  successSoft: '#13261F',
  teamA: '#8A93FF',
  teamB: '#FF9A4D',
  header: ROYAL,
  bandBg: ROYAL,
  bandGradient: flat(ROYAL),
  primaryGradient: flat(ROYAL),
  pitch: '#1C8B4A',
  headerBg: ROYAL,
  headerImage: '',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.8)',
  headerDots: 'rgba(255,255,255,0.16)',
  tabBg: ROYAL,
  tabActive: YELLOW,
  tabInactive: '#C9CEF5',
  timeBg: ROYAL,
  onTime: '#FFFFFF',
  onTimeSub: YELLOW,
  heroSky: 'radial-gradient(120% 90% at 50% 0%, #2B3BFF 0%, #141C8F 55%, #0B1033 100%)',
  stripeAlt: YELLOW,
  tabRound: 0,
  tabUnderline: false,
  doneBg: '#1B2160',
  doneFg: '#C9CEF5',
  adSky: '',
};

// ---------- الأسود: كحلي غامق وأصفر (مثل الصورة المرجعية) ----------
const B_NAVY = '#121D33';
const B_YELLOW = '#FFCC03';
const FLOODLIGHTS = 'radial-gradient(60% 55% at 70% 0%, rgba(255,255,235,0.38) 0%, rgba(255,255,235,0) 60%), radial-gradient(40% 40% at 25% 5%, rgba(255,255,235,0.25) 0%, rgba(255,255,235,0) 60%), linear-gradient(180deg, #2A3A5E 0%, #121D33 100%)';
const blackBase = {
  cta: B_YELLOW,
  onCta: B_NAVY,
  bandBg: B_NAVY,
  header: B_NAVY,
  bandGradient: flat(B_NAVY),
  primaryGradient: flat(B_NAVY),
  headerBg: B_NAVY,
  headerImage: FLOODLIGHTS,
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.8)',
  headerDots: 'rgba(255,255,255,0.14)',
  tabBg: B_NAVY,
  tabActive: B_YELLOW,
  tabInactive: '#AEB4C4',
  timeBg: B_YELLOW,
  onTime: B_NAVY,
  onTimeSub: B_NAVY,
  heroSky: 'radial-gradient(120% 90% at 50% 0%, #3A4C78 0%, #1B2A4A 55%, #0B1222 100%)',
  stripeAlt: B_YELLOW,
  tabRound: 22,
  tabUnderline: true,
  // إعلان بمشهد ملعب ليلي بالعشب والكشافات (مثل البطاقة بالصورة)
  adSky: 'radial-gradient(18% 30% at 30% 8%, rgba(255,255,240,0.95) 0%, rgba(255,255,240,0) 70%), radial-gradient(14% 24% at 55% 5%, rgba(255,255,240,0.8) 0%, rgba(255,255,240,0) 70%), radial-gradient(14% 24% at 80% 10%, rgba(255,255,240,0.7) 0%, rgba(255,255,240,0) 70%), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 26px, transparent 26px, transparent 52px), linear-gradient(180deg, #1D2A44 0%, #24375A 34%, #2F4A3A 52%, #2E8B3E 64%, #1F7A33 100%)',
};
const blackLight: Palette = {
  ...light,
  ...blackBase,
  primary: B_NAVY,
  primaryDark: '#0B1222',
  primarySoft: '#EEF0F4',
  accent: '#E0A800',
  bg: '#FDFDFD',
  cardAlt: '#E7E7E9',
  text: B_NAVY,
  muted: '#5E6478',
  border: '#E2E2EA',
  success: '#0D8025',
  successSoft: '#E3ECE0',
  teamA: B_NAVY,
  doneBg: '#E3ECE0',
  doneFg: '#0D8025',
};
const blackDark: Palette = {
  ...dark,
  ...blackBase,
  primary: '#C9D2E6',
  primaryDark: '#000000',
  primarySoft: '#1C273F',
  accent: B_YELLOW,
  bg: '#070B14',
  card: '#111A2C',
  cardAlt: '#18233A',
  text: '#EEF1F6',
  muted: '#A3ABBE',
  border: '#24304A',
  teamA: '#C9D2E6',
  doneBg: '#13261F',
  doneFg: '#34C38F',
};

// ---------- برشلونة: هوية النادي — أزرق #004D98، عنّابي #A50044، ذهبي #EDBB00 (وأحمر السنييرا #DB0030) ----------
const BL = '#004D98';
const GR = '#A50044';
const GOLD_B = '#EDBB00';
const BARCA_NAVY = '#0A1234';
// خطوط القميص العمودية (بلاوغرانا) ويّا ظل كحلي من تحت حتى الكتابة تنقرى
const BLAUGRANA = `linear-gradient(180deg, rgba(10,18,52,0.05) 0%, rgba(10,18,52,0.55) 100%), repeating-linear-gradient(90deg, ${BL} 0px, ${BL} 36px, ${GR} 36px, ${GR} 72px)`;
const BARCA_SKY = `linear-gradient(135deg, ${BL} 0%, #1B2F7A 50%, ${GR} 100%)`;
const barcaBase = {
  cta: GOLD_B,
  onCta: BARCA_NAVY,
  bandBg: BL,
  header: BL,
  bandGradient: flat(BL),
  primaryGradient: BARCA_SKY,
  headerBg: BL,
  headerImage: BLAUGRANA,
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.88)',
  headerDots: 'rgba(255,255,255,0.12)',
  tabBg: BARCA_NAVY,
  tabActive: GOLD_B,
  tabInactive: '#A9BCDB',
  timeBg: GR,
  onTime: '#FFFFFF',
  onTimeSub: GOLD_B,
  heroSky: `radial-gradient(120% 90% at 50% 0%, #1A6FC4 0%, ${BL} 45%, #3A0A2E 100%)`,
  stripeAlt: '#DB0030',
  tabRound: 22,
  tabUnderline: true,
  adSky: BARCA_SKY,
};
const barcaLight: Palette = {
  ...light,
  ...barcaBase,
  primary: BL,
  primaryDark: BARCA_NAVY,
  primarySoft: '#E3ECF8',
  accent: '#C99A00',
  bg: '#F3F5FA',
  cardAlt: '#E5ECF6',
  text: BARCA_NAVY,
  muted: '#4A5B78',
  border: '#D3DCEB',
  danger: '#DB0030',
  teamA: BL,
  teamB: GR,
  doneBg: '#E3ECF8',
  doneFg: BL,
};
const barcaDark: Palette = {
  ...dark,
  ...barcaBase,
  primary: '#7FB2EA',
  primaryDark: '#000000',
  primarySoft: '#0E2650',
  accent: GOLD_B,
  bg: '#050E22',
  card: '#0B1A38',
  cardAlt: '#112449',
  text: '#EEF3FB',
  muted: '#9FB1CF',
  border: '#1C3463',
  teamA: '#7FB2EA',
  teamB: '#FF5C9A',
  doneBg: '#0E2650',
  doneFg: '#7FB2EA',
};

// ---------- ريال مدريد: هوية النادي — أبيض، أزرق الشعار #00529F، ذهبي #FEBE10 ----------
const RM_BLUE = '#00529F';
const RM_GOLD = '#FEBE10';
const RM_INK = '#0A1A3D';
const RM_SKY = `linear-gradient(160deg, ${RM_BLUE} 0%, #063A78 55%, ${RM_INK} 100%)`;
const madridBase = {
  cta: RM_GOLD,
  onCta: RM_INK,
  bandBg: RM_BLUE,
  bandGradient: flat(RM_BLUE),
  primaryGradient: RM_SKY,
  timeBg: RM_BLUE,
  onTime: '#FFFFFF',
  onTimeSub: RM_GOLD,
  heroSky: `radial-gradient(120% 90% at 50% 0%, #2E7BD0 0%, ${RM_BLUE} 50%, ${RM_INK} 100%)`,
  // الشريط العريض ذهبي والرفيع أزرق — مثل الشريط المايل بالشعار
  stripeAlt: RM_BLUE,
  tabRound: 0,
  tabUnderline: true,
  adSky: RM_SKY,
};
const madridLight: Palette = {
  ...light,
  ...madridBase,
  primary: RM_BLUE,
  primaryDark: RM_INK,
  primarySoft: '#E6EEF8',
  accent: '#C48F00',
  bg: '#F6F8FC',
  cardAlt: '#EDF1F7',
  text: RM_INK,
  muted: '#5A6A86',
  border: '#DCE3EE',
  teamA: RM_BLUE,
  doneBg: '#E6EEF8',
  doneFg: RM_BLUE,
  // الرأس والشريط أبيض بكتابة كحلية — مثل قميص الريال
  header: '#FFFFFF',
  headerBg: '#FFFFFF',
  headerImage: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F9 100%)',
  onHeader: RM_INK,
  onHeaderMuted: '#5A6A86',
  headerDots: 'rgba(0,82,159,0.12)',
  tabBg: '#FFFFFF',
  tabActive: RM_BLUE,
  tabInactive: '#8A97AE',
};
const madridDark: Palette = {
  ...dark,
  ...madridBase,
  primary: '#8DB8E8',
  primaryDark: '#000000',
  primarySoft: '#0F2547',
  accent: RM_GOLD,
  bg: '#060D1D',
  card: '#0D1A33',
  cardAlt: '#132443',
  text: '#F1F5FB',
  muted: '#A2B1CB',
  border: '#1E3358',
  teamA: '#8DB8E8',
  doneBg: '#0F2547',
  doneFg: '#8DB8E8',
  // بالداكن الرأس كحلي (الأبيض يعمي بالليل)
  header: RM_INK,
  headerBg: RM_INK,
  headerImage: '',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.8)',
  headerDots: 'rgba(255,255,255,0.12)',
  tabBg: RM_INK,
  tabActive: RM_GOLD,
  tabInactive: '#93A3BE',
};

const PALETTES: Record<ThemeName, { light: Palette; dark: Palette }> = {
  royal: { light, dark },
  black: { light: blackLight, dark: blackDark },
  barca: { light: barcaLight, dark: barcaDark },
  madrid: { light: madridLight, dark: madridDark },
};

/** لون نص العنوان على رأس الصفحة */
export const headerText = (_c: Palette) => '#FFFFFF';

/** خط العناوين الكوفي مسافته بين الكلمات ضيقة: نوسّعها حتى ما تلتصق الكلمات */
export const wideSpaces = (t: string) => t.replace(/ /g, '\u2002');

/**
 * مكان من اليسار «الحقيقي» للزخارف (الشريطين الأصفر والنقاط):
 * التلفون بالعربي يقلب left لليمين، و end هو اليسار؛ الويب ما يقلب، فـ left هو اليسار.
 */
export const fromLeft = (n: number) => (Platform.OS === 'web' ? { left: n } : { end: n });
/** مسافة داخلية من الجهة اليسرى الحقيقية (حتى ما يغطي شريط الهوية النص) */
export const padLeft = (n: number) => (Platform.OS === 'web' ? { paddingLeft: n } : { paddingEnd: n });

/** ظل الزر الأصفر: خط كحلي حاد تحته مثل أرقام القمصان */
export const ctaShadow = (c: Palette) => `0 3px 0 ${c.primaryDark}`;

export const fonts = {
  regular: 'ReadexPro_400Regular',
  semibold: 'ReadexPro_600SemiBold',
  bold: 'ReadexPro_700Bold',
  /** خط العناوين والأرقام الكبيرة (كوفي) */
  display: 'ReemKufi_700Bold',
};

/** المسافات: كلها من مضاعفات 4 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** الزوايا: 12 للأزرار والحقول، 16 للبطاقات */
export const radius = 10;
export const cardRadius = 16;

/** أحجام الخطوط الموحّدة [الحجم، ارتفاع السطر] */
export const type = {
  largeTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 42 },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30 },
  headline: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 },
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';
interface ThemeState {
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  colors: Palette;
  setMode: (m: ThemeMode) => void;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const KEY = 'balmalaab-theme';
const THEME_KEY = 'balmalaab-theme-name';
const ThemeContext = createContext<ThemeState>({ mode: 'light', scheme: 'light', colors: light, setMode: () => {}, theme: 'royal', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // الافتراضي فاتح؛ اللاعب يكدر يختار «حسب الجهاز» أو «داكن» من حسابي
  const [mode, setMode] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<ThemeName>('royal');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
      })
      .catch(() => {});
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (v && v in PALETTES) setTheme(v as ThemeName);
      })
      .catch(() => {});
  }, []);

  const changeTheme = useCallback((t: ThemeName) => {
    setTheme(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  }, []);

  const changeMode = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(
    () => ({ mode, scheme, colors: PALETTES[theme][scheme], setMode: changeMode, theme, setTheme: changeTheme }),
    [mode, scheme, theme, changeMode, changeTheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export const useTheme = () => use(ThemeContext);
export const useColors = () => use(ThemeContext).colors;

/** أنماط تعتمد على الألوان: تُحسب مرة لكل وضع (فاتح/داكن) */
type StylesInput = Parameters<typeof StyleSheet.create>[0];
export function themed<S extends StylesInput>(factory: (c: Palette) => S & StylesInput) {
  const cache = new Map<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const c = useColors();
    let s = cache.get(c);
    if (!s) {
      s = StyleSheet.create(factory(c)) as Readonly<S>;
      cache.set(c, s);
    }
    return s;
  };
}
