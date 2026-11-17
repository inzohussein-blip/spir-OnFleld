import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

export type Palette = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
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
  teamA: string;
  teamB: string;
  header: string;
  onPrimary: string;
  /** خلفية شريط العنوان الملوّن */
  bandBg: string;
  /** نفس الخلفية بتدرّج */
  bandGradient: string;
  /** تدرّج البرتقالي للمساحات الكبيرة (بطاقة اللاعب، شريط الحجز) */
  primaryGradient: string;
};

/** لون نص العنوان على شريط الرأس: كحلي على الأبيض */
export const headerText = (c: Palette) => (c.header === '#FFFFFF' ? '#0B1F5C' : '#FFFFFF');

/**
 * ألوان «بالملعب»: برتقالي للأزرار والمختار، وكحلي (أزرق غامق) بتدرّج للرؤوس.
 */
export const light: Palette = {
  primary: '#EA580C',
  primaryDark: '#C2410C',
  primarySoft: '#FFEDD5',
  accent: '#F5B700',
  accentSoft: '#FFF4CC',
  bg: '#F5F6FA',
  card: '#FFFFFF',
  cardAlt: '#EEF0F6',
  text: '#0B1226',
  muted: '#5B6577',
  border: '#E2E5EE',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF4CC',
  warnText: '#7A5B00',
  teamA: '#1E3FA0',
  teamB: '#EA580C',
  header: '#FFFFFF',
  onPrimary: '#FFFFFF',
  bandBg: '#0B1F5C',
  bandGradient: 'linear-gradient(160deg, #081640 0%, #0B1F5C 55%, #16307C 100%)',
  primaryGradient: 'linear-gradient(135deg, #FB923C 0%, #EA580C 55%, #C2410C 100%)',
};

export const dark: Palette = {
  primary: '#F26A21',
  primaryDark: '#EA580C',
  primarySoft: '#3A1D0C',
  accent: '#F5C431',
  accentSoft: '#3A3010',
  bg: '#060D24',
  card: '#0E1838',
  cardAlt: '#152349',
  text: '#EEF2FB',
  muted: '#9AA6C4',
  border: '#22305A',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1F',
  warnSoft: '#3A3010',
  warnText: '#F5D77A',
  teamA: '#7FA2FF',
  teamB: '#FF9A4D',
  header: '#0B1640',
  onPrimary: '#FFFFFF',
  bandBg: '#0B1A4D',
  bandGradient: 'linear-gradient(160deg, #050B22 0%, #0B1A4D 60%, #13286E 100%)',
  primaryGradient: 'linear-gradient(135deg, #FB8A3C 0%, #F26A21 55%, #C2410C 100%)',
};

export const fonts = {
  regular: 'Cairo_400Regular',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
};

export const radius = 14;

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
