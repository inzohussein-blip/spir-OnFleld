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

/** لون نص العنوان على شريط الرأس: أسود على الأبيض */
export const headerText = (c: Palette) => (c.header === '#FFFFFF' ? '#121212' : '#FFFFFF');

/**
 * ألوان «بالملعب» (أسود + غروب): أسود وأبيض للأساس، وتدرّج الغروب (برتقالي ← وردي أحمر)
 * للمهم بس: الأزرار، المختار، والتبويب.
 */
export const SUNSET = 'linear-gradient(120deg, #FF6A00 0%, #E8173B 100%)';

export const light: Palette = {
  primary: '#F2402E',
  primaryDark: '#E8173B',
  primarySoft: '#FFEAE6',
  accent: '#F5B700',
  accentSoft: '#FFF4CC',
  bg: '#F6F5F5',
  card: '#FFFFFF',
  cardAlt: '#F0EEEE',
  text: '#121212',
  muted: '#76716F',
  border: '#ECE8E8',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF4CC',
  warnText: '#7A5B00',
  teamA: '#2563EB',
  teamB: '#FF6A00',
  header: '#FFFFFF',
  onPrimary: '#FFFFFF',
  bandBg: '#121212',
  bandGradient: 'linear-gradient(160deg, #0B0A0B 0%, #1A1617 65%, #2A1219 100%)',
  primaryGradient: SUNSET,
};

export const dark: Palette = {
  primary: '#FF5A3C',
  primaryDark: '#E8173B',
  primarySoft: '#2A1619',
  accent: '#F5C431',
  accentSoft: '#3A3010',
  bg: '#0B0A0B',
  card: '#171516',
  cardAlt: '#211E1F',
  text: '#FAF7F8',
  muted: '#8F8A8C',
  border: '#2A2628',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1F',
  warnSoft: '#3A3010',
  warnText: '#F5D77A',
  teamA: '#6F9BFF',
  teamB: '#FF9A4D',
  header: '#121011',
  onPrimary: '#FFFFFF',
  bandBg: '#000000',
  bandGradient: 'linear-gradient(160deg, #000000 0%, #141112 65%, #24121A 100%)',
  primaryGradient: SUNSET,
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
