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
};

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
}

const KEY = 'balmalaab-theme';
const ThemeContext = createContext<ThemeState>({ mode: 'light', scheme: 'light', colors: light, setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // الافتراضي فاتح؛ اللاعب يكدر يختار «حسب الجهاز» أو «داكن» من حسابي
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
      })
      .catch(() => {});
  }, []);

  const changeMode = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(() => ({ mode, scheme, colors: scheme === 'dark' ? dark : light, setMode: changeMode }), [mode, scheme, changeMode]);
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
