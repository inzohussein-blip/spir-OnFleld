import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Profile } from './types';

interface SessionState {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    try {
      const id = await api.currentUserId();
      setUserId(id);
      setProfile(id ? await api.getMyProfile() : null);
    } finally {
      setReady(true);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUserId(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ready, userId, profile, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession خارج SessionProvider');
  return s;
}

/** تحميل بيانات غير متزامنة مع حالة تحميل وخطأ */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
