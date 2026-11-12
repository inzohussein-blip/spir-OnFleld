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
};

/** لون نص العنوان على شريط الرأس */
export const headerText = (c: Palette) => (c.header === '#FFFFFF' ? c.primary : '#FFFFFF');

export const light: Palette = {
  primary: '#1E4FD8',
  primaryDark: '#163CA8',
  primarySoft: '#E6EDFD',
  accent: '#F5B700',
  accentSoft: '#FFF4CC',
  bg: '#F3F6FC',
  card: '#FFFFFF',
  cardAlt: '#EDF1F8',
  text: '#101828',
  muted: '#5B6577',
  border: '#DFE5F0',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF4CC',
  warnText: '#7A5B00',
  teamA: '#1E4FD8',
  teamB: '#E65100',
  header: '#FFFFFF',
  onPrimary: '#FFFFFF',
};

export const dark: Palette = {
  primary: '#4D7CFF',
  primaryDark: '#2F5EE8',
  primarySoft: '#16224A',
  accent: '#F5C431',
  accentSoft: '#3A3010',
  bg: '#0B1226',
  card: '#121B36',
  cardAlt: '#1A2547',
  text: '#E9EEFB',
  muted: '#9AA6C4',
  border: '#22305A',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1F',
  warnSoft: '#3A3010',
  warnText: '#F5D77A',
  teamA: '#6F9BFF',
  teamB: '#FF9A4D',
  header: '#0E1730',
  onPrimary: '#FFFFFF',
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
const ThemeContext = createContext<ThemeState>({ mode: 'system', scheme: 'light', colors: light, setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

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
