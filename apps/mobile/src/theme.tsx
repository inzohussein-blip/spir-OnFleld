import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

export const light: Palette = {
  primary: '#0F7A3E',
  primaryDark: '#0A5A2D',
  primarySoft: '#E3F2E8',
  accent: '#F2B705',
  accentSoft: '#FFF4CC',
  bg: '#F4F7F5',
  card: '#FFFFFF',
  cardAlt: '#ECEFED',
  text: '#13201A',
  muted: '#5E6E66',
  border: '#DDE6E0',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
  warnSoft: '#FFF4CC',
  warnText: '#7A5B00',
  teamA: '#1565C0',
  teamB: '#E65100',
  header: '#0F7A3E',
  onPrimary: '#FFFFFF',
};

export const dark: Palette = {
  primary: '#2DBE6C',
  primaryDark: '#1E9B55',
  primarySoft: '#14301F',
  accent: '#F5C431',
  accentSoft: '#3A3010',
  bg: '#0C1410',
  card: '#15201A',
  cardAlt: '#1E2B24',
  text: '#E8F1EC',
  muted: '#93A69C',
  border: '#26352D',
  danger: '#FF6B6B',
  dangerSoft: '#3A1A1A',
  warnSoft: '#3A3010',
  warnText: '#F5D77A',
  teamA: '#64A8FF',
  teamB: '#FF9A4D',
  header: '#0F1B15',
  onPrimary: '#06140C',
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
const Ctx = createContext<ThemeState>({ mode: 'system', scheme: 'light', colors: light, setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(() => ({ mode, scheme, colors: scheme === 'dark' ? dark : light, setMode }), [mode, scheme, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
export const useColors = () => useContext(Ctx).colors;

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
