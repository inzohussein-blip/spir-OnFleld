-- =====================================================================
-- «بالملعب» — نتائج المباريات، بطاقات اللاعبين، الإحصائيات، البطولات
-- =====================================================================

-- ---------- نتيجة المباراة والأحداث ----------
alter table matches add column if not exists score_a smallint check (score_a >= 0);
alter table matches add column if not exists score_b smallint check (score_b >= 0);

create table if not exists match_events (
  id         bigserial primary key,
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references profiles(id),
  kind       text not null check (kind in ('goal', 'assist')),
  created_at timestamptz not null default now()
);
create index if not exists match_events_player on match_events (player_id, kind);
alter table match_events enable row level security;
create policy "events_read" on match_events for select using (true);

-- خصائص البطاقة (سرعة، تسديد، …) يحدّثها المقيّمون المعتمدون أو الإدارة
alter table profiles add column if not exists attributes jsonb;

-- المنظّم يسجّل النتيجة والأحداث بعد انتهاء المباراة
create or replace function submit_match_result(p_match_id uuid, p_score_a int, p_score_b int, p_events jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match matches%rowtype;
  v_bad   int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'المباراة غير موجودة'; end if;
  if v_match.organizer_id <> auth.uid() then raise exception 'فقط منظّم المباراة يسجّل النتيجة'; end if;
  if v_match.starts_at > now() then raise exception 'لم تبدأ المباراة بعد'; end if;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'نتيجة غير صالحة'; end if;

  -- كل لاعب في الأحداث يجب أن يكون مشاركاً في المباراة
  select count(*) into v_bad
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
   where not exists (select 1 from match_players mp
                      where mp.match_id = p_match_id and mp.player_id = (e->>'player_id')::uuid
                        and mp.status in ('joined', 'attended'))
      or (e->>'kind') not in ('goal', 'assist');
  if v_bad > 0 then raise exception 'حدث لا يخص لاعباً في المباراة'; end if;

  update matches set score_a = p_score_a, score_b = p_score_b, status = 'finished' where id = p_match_id;
  delete from match_events where match_id = p_match_id;
  insert into match_events (match_id, player_id, kind)
  select p_match_id, (e->>'player_id')::uuid, e->>'kind'
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e;
end $$;

-- إحصائيات اللاعبين (اختياري: منذ تاريخ معيّن، أو للاعب واحد)
create or replace function player_stats(p_since timestamptz default null, p_player uuid default null)
returns table (player_id uuid, matches int, wins int, draws int, losses int, goals int, assists int, mvps int)
language sql stable security definer set search_path = public as $$
  with played as (
    select mp.player_id, m.id as match_id, mp.team, m.score_a, m.score_b
      from match_players mp
      join matches m on m.id = mp.match_id
     where m.score_a is not null and m.score_b is not null
       and mp.status in ('joined', 'attended')
       and (p_since is null or m.starts_at >= p_since)
       and (p_player is null or mp.player_id = p_player)
  ),
  mvp as (
    select distinct on (v.match_id) v.match_id, v.player_id
      from match_mvp_votes v
     group by v.match_id, v.player_id
     order by v.match_id, count(*) desc
  )
  select p.player_id,
         count(*)::int,
         count(*) filter (where (p.team = 'A' and p.score_a > p.score_b) or (p.team = 'B' and p.score_b > p.score_a))::int,
         count(*) filter (where p.team is not null and p.score_a = p.score_b)::int,
         count(*) filter (where (p.team = 'A' and p.score_a < p.score_b) or (p.team = 'B' and p.score_b < p.score_a))::int,
         coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'goal')), 0)::int,
         coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'assist')), 0)::int,
         count(*) filter (where exists (select 1 from mvp where mvp.match_id = p.match_id and mvp.player_id = p.player_id))::int
    from played p
   group by p.player_id;
$$;

-- ---------- البطولات ----------
do $$ begin
  create type tournament_status as enum ('registration', 'ongoing', 'finished');
exception when duplicate_object then null; end $$;

create table if not exists tournaments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  venue_id         uuid references venues(id),
  venue_name       text not null,
  players_per_side int not null default 5,
  team_count       int not null check (team_count between 2 and 64),
  team_fee         int not null default 0,
  player_fee       int not null default 0,
  prize            text,
  status           tournament_status not null default 'registration',
  starts_on        timestamptz not null,
  format           text not null default 'مجموعات + إقصائي',
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);

create table if not exists tournament_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  group_name    text,
  captain_id    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  unique (tournament_id, captain_id),
  unique (tournament_id, name)
);

create table if not exists tournament_fixtures (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  stage         text not null check (stage in ('group', 'round16', 'quarter', 'semi', 'final')),
  group_name    text,
  home_id       uuid references tournament_teams(id),
  away_id       uuid references tournament_teams(id),
  home_score    smallint,
  away_score    smallint,
  starts_at     timestamptz
);

create table if not exists tournament_scorers (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id     uuid not null references profiles(id),
  goals         int not null default 0,
  primary key (tournament_id, player_id)
);

alter table tournaments         enable row level security;
alter table tournament_teams    enable row level security;
alter table tournament_fixtures enable row level security;
alter table tournament_scorers  enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

create policy "t_read"  on tournaments         for select using (true);
create policy "t_admin" on tournaments         for all using (is_admin()) with check (is_admin());
create policy "tt_read" on tournament_teams    for select using (true);
create policy "tt_admin" on tournament_teams   for all using (is_admin()) with check (is_admin());
create policy "tf_read" on tournament_fixtures for select using (true);
create policy "tf_admin" on tournament_fixtures for all using (is_admin()) with check (is_admin());
create policy "ts_read" on tournament_scorers  for select using (true);
create policy "ts_admin" on tournament_scorers for all using (is_admin()) with check (is_admin());

-- تسجيل فريق: الكابتن هو المستخدم الحالي
create or replace function register_team(p_tournament_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_t  tournaments%rowtype;
  v_n  int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  select * into v_t from tournaments where id = p_tournament_id for update;
  if not found then raise exception 'البطولة غير موجودة'; end if;
  if v_t.status <> 'registration' then raise exception 'التسجيل مغلق لهذه البطولة'; end if;
  select count(*) into v_n from tournament_teams where tournament_id = p_tournament_id;
  if v_n >= v_t.team_count then raise exception 'اكتمل عدد الفرق'; end if;
  if length(trim(p_name)) < 2 then raise exception 'اكتب اسم الفريق'; end if;
  begin
    insert into tournament_teams (tournament_id, name, captain_id)
    values (p_tournament_id, trim(p_name), auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'سجّلت فريقاً في هذه البطولة مسبقاً أو الاسم مستخدم';
  end;
  return v_id;
end $$;

create or replace view tournament_cards with (security_invoker = true) as
select t.*, (select count(*) from tournament_teams tt where tt.tournament_id = t.id)::int as registered_teams
  from tournaments t;

grant execute on function submit_match_result(uuid, int, int, jsonb), player_stats(timestamptz, uuid),
  register_team(uuid, text) to authenticated;
