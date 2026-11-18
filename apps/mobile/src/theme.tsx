import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

/**
 * نظام التصميم: لون أساسي واحد (أخضر الملعب) فوق خلفيات محايدة.
 * بدون تدرّجات ولا أشرطة غامقة — الألوان القوية بس للأزرار والمختار والحالة.
 */
export type Palette = {
  /** الأخضر الأساسي: الأزرار، المختار، الروابط */
  primary: string;
  /** خلفية خفيفة للأيقونات والمختار */
  primarySoft: string;
  /** لون الكتابة فوق الأساسي */
  onPrimary: string;
  /** الذهبي: التقييم والمراكز الأولى بس */
  accent: string;
  accentSoft: string;
  /** خلفية الصفحات */
  bg: string;
  /** البطاقات والأشرطة */
  card: string;
  /** حقول ومسارات وخلفيات ثانوية داخل البطاقة */
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
  /** خلفية رأس الصفحات الداخلية (نفس الخلفية حتى يبين الرأس جزء من الصفحة) */
  header: string;
  /** لون أرضية الملعب بصور الملاعب الافتراضية */
  pitch: string;
};

export const light: Palette = {
  primary: '#0B8A5F',
  primarySoft: '#E6F4EE',
  onPrimary: '#FFFFFF',
  accent: '#D99A00',
  accentSoft: '#FFF5D6',
  bg: '#F4F6F5',
  card: '#FFFFFF',
  cardAlt: '#EEF2F0',
  text: '#14191A',
  muted: '#66716E',
  border: '#E2E8E5',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF5D6',
  warnText: '#7A5B00',
  success: '#0B8A5F',
  successSoft: '#E6F4EE',
  teamA: '#2563EB',
  teamB: '#E8590C',
  header: '#F4F6F5',
  pitch: '#1E8A55',
};

export const dark: Palette = {
  primary: '#22A06B',
  primarySoft: '#13261F',
  onPrimary: '#FFFFFF',
  accent: '#F0B429',
  accentSoft: '#33290F',
  bg: '#0D1110',
  card: '#161B1A',
  cardAlt: '#1F2624',
  text: '#F1F4F3',
  muted: '#93A09C',
  border: '#27302D',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1F',
  warnSoft: '#33290F',
  warnText: '#F5D77A',
  success: '#34C38F',
  successSoft: '#13261F',
  teamA: '#6F9BFF',
  teamB: '#FF9A4D',
  header: '#0D1110',
  pitch: '#1A6B45',
};

/** لون نص العنوان على رأس الصفحة */
export const headerText = (c: Palette) => c.text;

export const fonts = {
  regular: 'Cairo_400Regular',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
};

/** المسافات: كلها من مضاعفات 4 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** الزوايا: 12 للأزرار والحقول، 16 للبطاقات */
export const radius = 12;
export const cardRadius = 16;

/** أحجام الخطوط الموحّدة [الحجم، ارتفاع السطر] */
export const type = {
  largeTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 38 },
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
