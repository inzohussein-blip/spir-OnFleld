-- ════════════════════════════════════════════════════════════════════
-- 0007 — «فريقي»: رقم اللاعب (ID)، الفرق، دعوات الانضمام، مباريات الفريق
--   • كل لاعب عنده رقم عام (public_id) يبحث بيه أصدقاءه
--   • اللاعب يكدر يكون بـ 5 فرق كحد أقصى
--   • القائد يضيف اللاعبين (دعوة) واللاعب يوافق أو يرفض
--   • القائد يطلب مباراة للفريق كامل، أو يدخل الفريق كامل لمباراة موجودة،
--     وهو المسؤول عن دفع مبلغ أي لاعب من الفريق ما يحضر
-- ════════════════════════════════════════════════════════════════════

-- ---------- رقم اللاعب ----------
create or replace function gen_public_id() returns text
language plpgsql volatile set search_path = public as $$
declare v text;
begin
  loop
    v := (1000000 + floor(random() * 9000000))::int::text;
    exit when not exists (select 1 from profiles where public_id = v);
  end loop;
  return v;
end $$;

alter table profiles add column if not exists public_id text;
update profiles set public_id = gen_public_id() where public_id is null;
alter table profiles alter column public_id set default gen_public_id();
alter table profiles alter column public_id set not null;
create unique index if not exists profiles_public_id on profiles (public_id);

-- البحث بالرقم بالضبط (ما يكشف كل اللاعبين)
create or replace function find_player_by_public_id(p_code text)
returns setof profiles
language sql stable security definer set search_path = public as $$
  select * from profiles
   where public_id = regexp_replace(coalesce(p_code, ''), '\D', '', 'g')
     and deleted_at is null
   limit 1;
$$;

-- ---------- الفرق ----------
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 30),
  captain_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id   uuid not null references teams(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, player_id)
);
create index if not exists team_members_player on team_members (player_id);

create table if not exists team_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  player_id  uuid not null references profiles(id) on delete cascade,
  invited_by uuid not null references profiles(id),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create unique index if not exists team_invites_one_pending on team_invites (team_id, player_id) where status = 'pending';

-- مين دخّل اللاعب ويّا فريقه (القائد يتحمّل مبلغه إذا ما حضر)
alter table match_players add column if not exists team_id uuid references teams(id) on delete set null;
alter table match_players add column if not exists paid_by uuid references profiles(id);

-- طلب مباراة لفريق كامل
alter table match_suggestions add column if not exists team_id uuid references teams(id) on delete set null;

create or replace function is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = p_team and player_id = auth.uid());
$$;

alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
create policy "teams_read"   on teams        for select using (is_team_member(id) or captain_id = auth.uid() or is_admin()
  or exists (select 1 from team_invites i where i.team_id = teams.id and i.player_id = auth.uid() and i.status = 'pending'));
create policy "tm_read"      on team_members for select using (is_team_member(team_id) or is_admin());
create policy "inv_read"     on team_invites for select using (player_id = auth.uid() or is_team_member(team_id) or is_admin());
-- كل الكتابة تمر من الدوال تحت (حتى تنفرض القواعد)

create or replace function my_team_count(p_player uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from team_members where player_id = p_player;
$$;

create or replace function create_team(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'لازم تسجّل دخول'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'اسم الفريق قصير'; end if;
  if my_team_count(auth.uid()) >= 5 then raise exception 'وصلت الحد: تكدر تكون بـ 5 فرق بس'; end if;
  insert into teams (name, captain_id) values (trim(p_name), auth.uid()) returning id into v_team;
  insert into team_members (team_id, player_id) values (v_team, auth.uid());
  return v_team;
end $$;

create or replace function invite_to_team(p_team uuid, p_player uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype; v_id uuid;
begin
  select * into v_team from teams where id = p_team;
  if not found then raise exception 'الفريق مو موجود'; end if;
  if v_team.captain_id <> auth.uid() then raise exception 'بس قائد الفريق يكدر يضيف لاعبين'; end if;
  if p_player = auth.uid() then raise exception 'إنت بالفريق من قبل'; end if;
  if exists (select 1 from team_members where team_id = p_team and player_id = p_player) then
    raise exception 'اللاعب بالفريق من قبل';
  end if;
  if exists (select 1 from team_invites where team_id = p_team and player_id = p_player and status = 'pending') then
    raise exception 'دزّيت له طلب من قبل، بانتظار موافقته';
  end if;
  if (select count(*) from team_members where team_id = p_team) >= 22 then raise exception 'الفريق مكتمل (22 لاعب)'; end if;
  if my_team_count(p_player) >= 5 then raise exception 'اللاعب وصل الحد: 5 فرق'; end if;

  insert into team_invites (team_id, player_id, invited_by) values (p_team, p_player, auth.uid()) returning id into v_id;
  insert into notifications (user_id, kind, title, body)
  values (p_player, 'general', 'طلب انضمام لفريق 👥', 'فريق «' || v_team.name || '» يريدك وياهم. وافق أو ارفض من «حسابي ← فريقي».');
  return v_id;
end $$;

create or replace function respond_team_invite(p_invite uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_inv team_invites%rowtype;
begin
  select * into v_inv from team_invites where id = p_invite and player_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'الطلب مو موجود'; end if;
  if p_accept then
    if my_team_count(auth.uid()) >= 5 then raise exception 'وصلت الحد: تكدر تكون بـ 5 فرق بس. اطلع من فريق أول'; end if;
    insert into team_members (team_id, player_id) values (v_inv.team_id, auth.uid()) on conflict do nothing;
    update team_invites set status = 'accepted' where id = p_invite;
  else
    update team_invites set status = 'rejected' where id = p_invite;
  end if;
end $$;

create or replace function leave_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_next uuid;
begin
  delete from team_members where team_id = p_team and player_id = auth.uid();
  if not found then return; end if;
  if (select captain_id from teams where id = p_team) = auth.uid() then
    select player_id into v_next from team_members where team_id = p_team order by joined_at limit 1;
    if v_next is null then delete from teams where id = p_team;
    else update teams set captain_id = v_next where id = p_team;
    end if;
  end if;
end $$;

create or replace function remove_team_member(p_team uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select captain_id from teams where id = p_team) is distinct from auth.uid() then
    raise exception 'بس قائد الفريق يكدر يشيل لاعبين';
  end if;
  if p_player = auth.uid() then raise exception 'استعمل «اطلع من الفريق»'; end if;
  delete from team_members where team_id = p_team and player_id = p_player;
  update team_invites set status = 'rejected' where team_id = p_team and player_id = p_player and status = 'pending';
end $$;

-- القائد يدخّل كل الفريق لمباراة (لازم يكفي المكان للكل)
create or replace function join_match_with_team(p_match uuid, p_team uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_match  matches%rowtype;
  v_joined int;
  v_add    int;
  v_player uuid;
begin
  if (select captain_id from teams where id = p_team) is distinct from auth.uid() then
    raise exception 'بس قائد الفريق يكدر يدخّل الفريق';
  end if;
  select * into v_match from matches where id = p_match for update;
  if not found then raise exception 'المباراة مو موجودة'; end if;
  if v_match.status not in ('open', 'full') or v_match.starts_at < now() then raise exception 'ما تكدر تنضم لهاي المباراة'; end if;
  if v_match.registration_opens_at is not null and v_match.registration_opens_at > now() then
    raise exception 'التسجيل لم يُفتح بعد لهذه المباراة';
  end if;

  select count(*) into v_joined from match_players where match_id = p_match and status = 'joined';
  select count(*) into v_add from team_members tm
   where tm.team_id = p_team
     and not exists (select 1 from match_players mp where mp.match_id = p_match and mp.player_id = tm.player_id and mp.status = 'joined');
  if v_add = 0 then raise exception 'كل أعضاء الفريق منضمين لهاي المباراة من قبل'; end if;
  if v_add > v_match.max_players - v_joined then
    raise exception 'ماكو مكان كافي: باقي % والفريق يحتاج %', greatest(v_match.max_players - v_joined, 0), v_add;
  end if;

  for v_player in
    select tm.player_id from team_members tm
     where tm.team_id = p_team
       and not exists (select 1 from match_players mp where mp.match_id = p_match and mp.player_id = tm.player_id and mp.status = 'joined')
  loop
    insert into match_players (match_id, player_id, status, team_id, paid_by)
    values (p_match, v_player, 'joined', p_team, auth.uid())
    on conflict (match_id, player_id) do update
      set status = 'joined', team = null, joined_at = now(), team_id = p_team, paid_by = auth.uid();
    if v_player <> auth.uid() then
      insert into notifications (user_id, kind, title, body, match_id)
      values (v_player, 'general', 'قائد فريقك دخّلك مباراة ⚽', 'انضميت ويّا فريقك. إذا ما تكدر تحضر انسحب أو بلّغ القائد.', p_match);
    end if;
  end loop;

  if v_joined + v_add >= v_match.max_players then update matches set status = 'full' where id = p_match; end if;
  return v_add;
end $$;

-- طلب مباراة للفريق كامل (يوصل للإدارة مثل باقي الاقتراحات)
create or replace function suggest_team_match(
  p_team uuid, p_venue_id uuid, p_venue_text text, p_day date, p_hour int, p_players_per_side int, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_size int;
begin
  if (select captain_id from teams where id = p_team) is distinct from auth.uid() then
    raise exception 'بس قائد الفريق يكدر يطلب مباراة للفريق';
  end if;
  select count(*) into v_size from team_members where team_id = p_team;
  if v_size > p_players_per_side * 2 then raise exception 'حجم المباراة أصغر من فريقك (% لاعب)', v_size; end if;
  insert into match_suggestions (player_id, venue_id, venue_text, day, hour, players_per_side, note, team_id)
  values (auth.uid(), p_venue_id, p_venue_text, p_day, p_hour, p_players_per_side, p_note, p_team)
  returning id into v_id;
  return v_id;
end $$;

-- لما الإدارة تنزّل مباراة من طلب فريق: كل أعضاء الفريق ينضافون والقائد هو المسؤول عن الدفع
create or replace function trg_team_suggestion_scheduled() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_captain uuid; v_max int; v_player uuid; v_n int := 0;
begin
  if new.status = 'scheduled' and old.status is distinct from 'scheduled' and new.team_id is not null and new.match_id is not null then
    select captain_id into v_captain from teams where id = new.team_id;
    select max_players into v_max from matches where id = new.match_id;
    for v_player in select player_id from team_members where team_id = new.team_id order by joined_at loop
      exit when v_n >= v_max;
      insert into match_players (match_id, player_id, status, team_id, paid_by)
      values (new.match_id, v_player, 'joined', new.team_id, v_captain)
      on conflict (match_id, player_id) do nothing;
      v_n := v_n + 1;
      if v_player <> new.player_id then
        insert into notifications (user_id, kind, title, body, match_id)
        values (v_player, 'match_created', 'مباراة لفريقك ⚽', 'الإدارة نزّلت المباراة اللي طلبها قائد فريقك، وانضفت لها.', new.match_id);
      end if;
    end loop;
    if v_n >= v_max then update matches set status = 'full' where id = new.match_id; end if;
  end if;
  return new;
end $$;
drop trigger if exists team_suggestion_scheduled on match_suggestions;
create trigger team_suggestion_scheduled after update on match_suggestions
  for each row execute function trg_team_suggestion_scheduled();

grant execute on function find_player_by_public_id(text), create_team(text), invite_to_team(uuid, uuid),
  respond_team_invite(uuid, boolean), leave_team(uuid), remove_team_member(uuid, uuid),
  join_match_with_team(uuid, uuid), suggest_team_match(uuid, uuid, text, date, int, int, text), my_team_count(uuid)
  to authenticated;
