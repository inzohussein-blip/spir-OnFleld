import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/**
 * تحميل بيانات غير متزامنة مع حالة تحميل وخطأ.
 * مع cacheKey: تُعرض آخر بيانات محفوظة فوراً، وتبقى ظاهرة إذا انقطع الاتصال (offline = true).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts?: { cacheKey?: string }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  // آخر نسخة من الدالة، وتسلسل الطلبات حتى لا يكتب ردّ قديم فوق ردّ أحدث
  const fnRef = useRef(fn);
  const seqRef = useRef(0);
  const hasDataRef = useRef(false);
  useEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);
  const storageKey = opts?.cacheKey ? `balmalaab-cache:${opts.cacheKey}:${key}` : null;

  // قراءة النسخة المحفوظة (إن وجدت) بينما الطلب الحقيقي قيد التنفيذ
  useEffect(() => {
    if (!storageKey) return;
    let alive = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (alive && raw && !hasDataRef.current) setData(JSON.parse(raw) as T);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const run = useCallback(
    async (k: string) => {
      const mine = ++seqRef.current;
      try {
        const result = await fnRef.current();
        if (mine === seqRef.current) {
          hasDataRef.current = true;
          setData(result);
          setError(null);
          setOffline(false);
          if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(result)).catch(() => {});
        }
      } catch (e) {
        if (mine === seqRef.current) {
          const cached = storageKey ? await AsyncStorage.getItem(storageKey).catch(() => null) : null;
          if (cached) {
            setData(JSON.parse(cached) as T);
            setOffline(true);
            setError(null);
          } else setError(errMsg(e));
        }
      } finally {
        if (mine === seqRef.current) setDoneKey(k);
      }
    },
    [storageKey],
  );

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

  return { data, error, offline, loading: doneKey !== key || reloading, refreshing: reloading, reload, setData };
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
