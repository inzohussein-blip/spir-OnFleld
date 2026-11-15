import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** الملاعب المفضلة (محفوظة على الجهاز) — نفس القائمة بكل الشاشات */
const KEY = 'balmalaab-fav-venues';
let favs: Set<string> | null = null;
const listeners = new Set<(s: Set<string>) => void>();

async function load(): Promise<Set<string>> {
  if (favs) return favs;
  try {
    favs = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as string[]);
  } catch {
    favs = new Set();
  }
  return favs;
}

export async function toggleFavoriteVenue(id: string) {
  const s = new Set(await load());
  if (s.has(id)) s.delete(id);
  else s.add(id);
  favs = s;
  for (const l of listeners) l(s);
  await AsyncStorage.setItem(KEY, JSON.stringify([...s])).catch(() => {});
}

export function useFavoriteVenues(): Set<string> {
  const [state, setState] = useState<Set<string>>(() => favs ?? new Set());
  useEffect(() => {
    let alive = true;
    void load().then((s) => alive && setState(s));
    listeners.add(setState);
    return () => {
      alive = false;
      listeners.delete(setState);
    };
  }, []);
  return state;
}
