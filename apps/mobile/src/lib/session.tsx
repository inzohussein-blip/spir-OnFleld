import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Profile } from './types';

interface SessionState {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

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

  return <SessionContext value={{ ready, userId, profile, refresh, signOut }}>{children}</SessionContext>;
}

export function useSession() {
  const s = use(SessionContext);
  if (!s) throw new Error('useSession خارج SessionProvider');
  return s;
}

/** تحميل بيانات غير متزامنة مع حالة تحميل وخطأ */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  // آخر نسخة من الدالة، وتسلسل الطلبات حتى لا يكتب ردّ قديم فوق ردّ أحدث
  const fnRef = useRef(fn);
  const seqRef = useRef(0);
  useEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);

  const run = useCallback(async (k: string) => {
    const mine = ++seqRef.current;
    try {
      const result = await fnRef.current();
      if (mine === seqRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mine === seqRef.current) setError(errMsg(e));
    } finally {
      if (mine === seqRef.current) setDoneKey(k);
    }
  }, []);

  useEffect(() => {
    void run(key);
  }, [key, run]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      await run(key);
    } finally {
      setReloading(false);
    }
  }, [key, run]);

  return { data, error, loading: doneKey !== key || reloading, reload, setData };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** الوقت الحالي (ms) كقيمة حالة تتحدث دورياً — بدل استدعاء Date أثناء الرسم */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
