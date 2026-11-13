import type { Match } from './types';

export type MatchAction =
  | { kind: 'join' }
  | { kind: 'waitlist' }
  | { kind: 'joined' }
  | { kind: 'waiting' }
  | { kind: 'opens_later'; ms: number }
  | { kind: 'finished' };

/** ما الذي يستطيع اللاعب فعله الآن مع هذه المباراة — مصدر واحد للبطاقة وصفحة المباراة */
export function matchAction(m: Pick<Match, 'my_status' | 'registration_opens_at' | 'ends_at' | 'joined_count' | 'max_players'>, now: number): MatchAction {
  if (new Date(m.ends_at).getTime() <= now) return { kind: 'finished' };
  if (m.my_status === 'joined') return { kind: 'joined' };
  if (m.my_status === 'waitlist') return { kind: 'waiting' };
  if (m.registration_opens_at) {
    const ms = new Date(m.registration_opens_at).getTime() - now;
    if (ms > 0) return { kind: 'opens_later', ms };
  }
  return m.joined_count < m.max_players ? { kind: 'join' } : { kind: 'waitlist' };
}
