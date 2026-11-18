-- =====================================================================
-- 0011: سدّ ثغرات الصلاحيات
--   1) اللاعب ما يكدر يغيّر دوره (admin/owner) ولا تقييمه ولا عدّاداته
--      ولا رقمه العام من ملفه الشخصي — بس الاسم والمدينة والمركز والصورة
--      والأيام المفضلة.
--   2) الملاعب: إضافة وحذف الملاعب للإدارة بس، وصاحب الملعب يعدّل ملعبه
--      بدون ما يغيّر «موثّق» أو المالك.
--   3) المباريات: الإنشاء والتعديل المباشر للإدارة بس (الباقي عبر الدوال).
--      المنظّم يعدّل الفريق والمركز بقائمة اللاعبين بس، مو الدفع أو الحضور.
--   4) التقييمات: وزن التقييم ينحسب بالخادم (3 للمقيّم المعتمد، 1 للباقي)
--      بدل ما يرسله اللاعب.
--   5) دوال داخلية ما لازم ينادونها من التطبيق.
--
-- الحماية تشتغل بس على طلبات التطبيق (الدورين anon و authenticated) ومن
-- غير الإدارة. دوال الخادم (security definer) والإدارة ما تتأثر.
-- =====================================================================

-- طلب جاي من التطبيق ومن مو أدمن؟
create or replace function is_client_non_admin() returns boolean
language sql stable set search_path = public as $$
  select current_user in ('anon', 'authenticated') and not is_admin();
$$;

-- ---------- 1) الملف الشخصي ----------
create or replace function trg_profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not is_client_non_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role               := 'player';
    new.is_certified_rater := false;
    new.skill_rating       := 3.00;
    new.reliability_score  := 100;
    new.matches_played     := 0;
    new.attributes         := null;
    new.deleted_at         := null;
    new.public_id          := gen_public_id();
    new.created_at         := now();
  else
    new.id                 := old.id;
    new.role               := old.role;
    new.is_certified_rater := old.is_certified_rater;
    new.skill_rating       := old.skill_rating;
    new.reliability_score  := old.reliability_score;
    new.matches_played     := old.matches_played;
    new.attributes         := old.attributes;
    new.deleted_at         := old.deleted_at;
    new.public_id          := old.public_id;
    new.created_at         := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before insert or update on profiles
for each row execute function trg_profiles_guard();

-- ---------- 2) الملاعب ----------
drop policy if exists "venues_owner" on venues;
drop policy if exists "venues_owner_update" on venues;
create policy "venues_owner_update" on venues for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "venues_admin_insert" on venues;
create policy "venues_admin_insert" on venues for insert with check (is_admin());
drop policy if exists "venues_admin_delete" on venues;
create policy "venues_admin_delete" on venues for delete using (is_admin());

create or replace function trg_venues_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_client_non_admin() then
    new.id          := old.id;
    new.owner_id    := old.owner_id;
    new.is_verified := old.is_verified;
  end if;
  return new;
end $$;

drop trigger if exists venues_guard on venues;
create trigger venues_guard before update on venues
for each row execute function trg_venues_guard();

-- ---------- 3) المباريات وقائمة اللاعبين ----------
drop policy if exists "matches_insert" on matches;
drop policy if exists "matches_update" on matches;
drop policy if exists "matches_admin_write" on matches;
create policy "matches_admin_write" on matches for all using (is_admin()) with check (is_admin());

-- المنظّم يوزّع الفرق بس؛ الدفع والحضور والحالة تتغيّر عبر الدوال
revoke update on match_players from anon, authenticated;
grant update (team, position) on match_players to authenticated;

-- ---------- 4) وزن التقييم ----------
create or replace function trg_ratings_weight() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.weight := case
    when (select is_certified_rater from profiles where id = new.rater_id) then 3
    else 1
  end;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists ratings_weight on player_ratings;
create trigger ratings_weight before insert on player_ratings
for each row execute function trg_ratings_weight();

-- ما يتعدّل التقييم بعد ما ينكتب
revoke update on player_ratings from anon, authenticated;

-- ---------- 5) دوال داخلية ----------
-- إعادة حساب التقييم تصير من التريغر بصلاحية الخادم، مو من اللاعب
create or replace function trg_after_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalc_player_rating(new.ratee_id);
  return new;
end $$;

revoke execute on function recalc_player_rating(uuid) from public, anon, authenticated;
revoke execute on function my_team_count(uuid) from public, anon, authenticated;
revoke execute on function trg_ratings_weight() from public, anon, authenticated;
revoke execute on function trg_after_rating() from public, anon, authenticated;

-- البحث برقم اللاعب لازم تسجيل دخول
revoke execute on function find_player_by_public_id(text) from public, anon;
grant execute on function find_player_by_public_id(text) to authenticated;
