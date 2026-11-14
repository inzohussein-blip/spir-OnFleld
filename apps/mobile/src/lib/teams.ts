// قواعد «فريقي» — نفس القواعد مطبّقة بقاعدة البيانات (supabase/migrations/0007_teams.sql)

/** أقصى عدد فرق للاعب الواحد */
export const MAX_TEAMS = 5;
/** أقصى عدد لاعبين بالفريق */
export const MAX_TEAM_MEMBERS = 22;

export function teamNameError(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return 'اسم الفريق قصير';
  if (n.length > 30) return 'اسم الفريق طويل (30 حرف كحد أقصى)';
  return null;
}

/** رقم اللاعب: أرقام بس (يقبل أرقام عربية-هندية ويحوّلها) */
export function normalizePublicId(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/** يكدر اللاعب يدخل فريق جديد؟ */
export const canJoinAnotherTeam = (teamsCount: number) => teamsCount < MAX_TEAMS;

/** إذا طلع القائد: القيادة تروح لأقدم عضو، وإذا ماكو أحد الفريق ينحذف */
export function nextCaptain<T extends { player_id: string; joined_at: string }>(members: T[], leaving: string): string | null {
  const rest = members.filter((m) => m.player_id !== leaving).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return rest[0]?.player_id ?? null;
}

/** دخول الفريق كامل لمباراة: لازم يكفي المكان لكل اللي بعدهم مو منضمين */
export function teamJoinError(freeSpots: number, toAdd: number): string | null {
  if (toAdd <= 0) return 'كل أعضاء الفريق منضمين لهاي المباراة من قبل';
  if (toAdd > freeSpots) return freeSpots <= 0 ? 'المباراة مكتملة' : `ماكو مكان كافي: باقي ${freeSpots} والفريق يحتاج ${toAdd}`;
  return null;
}

/** أصغر حجم مباراة يكفي كل الفريق (لاعبين بكل جهة) */
export function smallestSizeFor(members: number, sizes: number[] = [5, 6, 7, 8, 11]): number {
  return sizes.find((n) => n * 2 >= members) ?? sizes[sizes.length - 1];
}
