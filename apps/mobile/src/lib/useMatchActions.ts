import { useState } from 'react';
import { useToast } from '../components/feedback';
import { api } from './api';
import { cancelMatchReminder, scheduleMatchReminder } from './notifications';
import { errMsg } from './session';
import type { Match } from './types';

/**
 * الانضمام والانسحاب بضغطة وحدة، مع رسالة «تراجع» لبضع ثوانٍ،
 * وتذكير تلقائي قبل المباراة لمن انضم.
 */
export function useMatchActions(onChanged: () => Promise<void> | void) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  function join(m: Match): Promise<void> {
    return run(m.id, async () => {
      const status = await api.joinMatch(m.id);
      if (status === 'joined') await scheduleMatchReminder(m);
      toast(status === 'joined' ? 'انضميت للمباراة ✓' : 'انحطيت بقائمة الانتظار', { actionLabel: 'تراجع', onAction: () => void leave(m) });
    });
  }

  function leave(m: Match): Promise<void> {
    return run(m.id, async () => {
      await api.leaveMatch(m.id);
      await cancelMatchReminder(m.id);
      toast('انسحبت من المباراة', { actionLabel: 'تراجع', onAction: () => void join(m) });
    });
  }

  return { join, leave, busyId, error };
}
