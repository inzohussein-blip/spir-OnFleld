import type { Position, Team } from './types';

export interface BalancePlayer {
  id: string;
  rating: number;
  position: Position | null;
}

export interface BalanceResult {
  assignments: Record<string, Team>;
  totalA: number;
  totalB: number;
  diff: number;
}

const sum = (xs: BalancePlayer[]) => xs.reduce((s, p) => s + p.rating, 0);

/**
 * تقسيم اللاعبين على فريقين متقاربين في المستوى.
 * 1) حارس لكل فريق إن وُجد.  2) توزيع «الثعبان» حسب التقييم.
 * 3) تحسين بالتبديل بين الفريقين ما دام الفرق يقلّ (مع الحفاظ على تساوي العدد).
 */
export function balanceTeams(players: BalancePlayer[]): BalanceResult {
  const sorted = [...players].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  const A: BalancePlayer[] = [];
  const B: BalancePlayer[] = [];

  const keepers = sorted.filter((p) => p.position === 'goalkeeper');
  const rest = sorted.filter((p) => p.position !== 'goalkeeper');
  // أقوى حارسين: واحد لكل فريق، والباقون يُعاملون كلاعبين عاديين
  if (keepers[0]) A.push(keepers[0]);
  if (keepers[1]) B.push(keepers[1]);
  const pool = [...keepers.slice(2), ...rest].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));

  for (const p of pool) {
    if (A.length < B.length) A.push(p);
    else if (B.length < A.length) B.push(p);
    else if (sum(A) <= sum(B)) A.push(p);
    else B.push(p);
  }

  // تحسين بالتبديل (لا نبدّل الحراس المثبّتين)
  const locked = new Set([keepers[0]?.id, keepers[1]?.id].filter(Boolean) as string[]);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    const current = Math.abs(sum(A) - sum(B));
    let best: { i: number; j: number; diff: number } | null = null;
    for (let i = 0; i < A.length; i++) {
      if (locked.has(A[i].id)) continue;
      for (let j = 0; j < B.length; j++) {
        if (locked.has(B[j].id)) continue;
        const d = Math.abs(sum(A) - A[i].rating + B[j].rating - (sum(B) - B[j].rating + A[i].rating));
        if (d < current - 1e-9 && (!best || d < best.diff)) best = { i, j, diff: d };
      }
    }
    if (best) {
      const tmp = A[best.i];
      A[best.i] = B[best.j];
      B[best.j] = tmp;
      improved = true;
    }
  }

  const assignments: Record<string, Team> = {};
  A.forEach((p) => (assignments[p.id] = 'A'));
  B.forEach((p) => (assignments[p.id] = 'B'));
  const totalA = sum(A);
  const totalB = sum(B);
  return { assignments, totalA, totalB, diff: Math.abs(totalA - totalB) };
}
