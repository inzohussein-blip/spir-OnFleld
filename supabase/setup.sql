-- ملف الإعداد الكامل لقاعدة بيانات «احجزلي بالملعب» — مولّد تلقائياً من supabase/migrations
-- لا تعدّله يدوياً: عدّل ملفات migrations وشغّل supabase/build-setup.sh

-- ================================================================
-- 0001_init.sql
-- ================================================================
-- =====================================================================
-- «بالملعب» — المخطط الأولي لقاعدة البيانات (Supabase / PostgreSQL)
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- الأنواع ----------
create type user_role       as enum ('player', 'owner', 'staff', 'admin');
create type player_position as enum ('goalkeeper', 'defender', 'midfielder', 'forward', 'any');
create type booking_status  as enum ('hold', 'confirmed', 'cancelled', 'completed', 'no_show');
create type payment_status  as enum ('unpaid', 'deposit', 'paid', 'refunded');
create type match_status    as enum ('open', 'full', 'in_progress', 'finished', 'cancelled');
create type match_visibility as enum ('public', 'private');
create type skill_level     as enum ('beginner', 'intermediate', 'advanced', 'open');
create type roster_status   as enum ('joined', 'waitlist', 'left', 'no_show', 'attended');
create type team_side       as enum ('A', 'B');

-- ---------- المستخدمون ----------
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text not null,
  phone              text unique,
  avatar_url         text,
  city               text,
  preferred_position player_position not null default 'any',
  role               user_role not null default 'player',
  is_certified_rater boolean not null default false,  -- مقيّم معتمد
  skill_rating       numeric(3,2) not null default 3.00 check (skill_rating between 1 and 5),
  reliability_score  numeric(5,2) not null default 100, -- نسبة الالتزام %
  matches_played     int not null default 0,
  created_at         timestamptz not null default now()
);

-- ---------- الساحات ----------
create table venues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id),
  name        text not null,
  city        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  phone       text,
  amenities   text[] not null default '{}',   -- مثل: {parking, showers, cafe}
  photos      text[] not null default '{}',
  is_verified boolean not null default false,
  created_at  timestamptz not null default now()
);

create table fields (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  name            text not null,                -- «ساحة 1»
  players_per_side int not null default 5 check (players_per_side between 3 and 11),
  surface         text,                         -- عشب صناعي / طبيعي
  is_indoor       boolean not null default false,
  default_price   int not null,                 -- بالدينار لكل ساعة
  slot_minutes    int not null default 60,
  cancel_free_hours int not null default 6,     -- الإلغاء مجاني قبل X ساعة
  is_active       boolean not null default true
);

create table field_hours (
  id             uuid primary key default gen_random_uuid(),
  field_id       uuid not null references fields(id) on delete cascade,
  weekday        smallint not null check (weekday between 0 and 6), -- 0 = الأحد
  open_time      time not null,
  close_time     time not null,
  price_per_hour int
);

create table field_blackouts (
  id       uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  during   tstzrange not null,
  reason   text
);

-- ---------- الحجوزات ----------
create table bookings (
  id              uuid primary key default gen_random_uuid(),
  field_id        uuid not null references fields(id),
  booked_by       uuid references profiles(id),   -- null = حجز يدوي من صاحب الساحة
  walk_in_name    text,
  walk_in_phone   text,
  during          tstzrange not null,
  status          booking_status not null default 'hold',
  price           int not null,
  payment_status  payment_status not null default 'unpaid',
  hold_expires_at timestamptz,
  recurrence_id   uuid,                           -- لربط الحجوزات المتكررة
  created_at      timestamptz not null default now(),

  -- منع الحجز المزدوج: لا يمكن لحجزين فعّالين على نفس الملعب أن يتداخلا زمنياً
  constraint no_double_booking exclude using gist (
    field_id with =,
    during   with &&
  ) where (status in ('hold', 'confirmed'))
);
create index on bookings (field_id, lower(during));

-- ---------- المباريات ----------
create table matches (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references bookings(id),
  organizer_id    uuid not null references profiles(id),
  title           text,
  players_per_side int not null default 5 check (players_per_side between 2 and 11),
  max_players     int generated always as (players_per_side * 2) stored,
  reserves        int not null default 2,
  skill_level     skill_level not null default 'open',
  visibility      match_visibility not null default 'public',
  status          match_status not null default 'open',
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  cost_per_player int,
  invite_code     text unique default substr(md5(random()::text), 1, 8),
  notes           text,
  created_at      timestamptz not null default now()
);

create table match_players (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references profiles(id),
  status     roster_status not null default 'joined',
  team       team_side,
  position   player_position,
  paid       boolean not null default false,
  confirmed  boolean not null default false,    -- تأكيد الحضور
  joined_at  timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table match_messages (
  id         bigserial primary key,
  match_id   uuid not null references matches(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------- التقييمات ----------
create table player_ratings (
  match_id      uuid not null references matches(id) on delete cascade,
  rater_id      uuid not null references profiles(id),
  ratee_id      uuid not null references profiles(id),
  skill         smallint not null check (skill between 1 and 5),
  teamwork      smallint not null check (teamwork between 1 and 5),
  sportsmanship smallint not null check (sportsmanship between 1 and 5),
  weight        numeric(3,1) not null default 1,  -- المقيّم المعتمد = 3
  details       jsonb,                            -- تقييم تفصيلي (سرعة، تمرير…)
  created_at    timestamptz not null default now(),
  primary key (match_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);

create table match_mvp_votes (
  match_id  uuid not null references matches(id) on delete cascade,
  voter_id  uuid not null references profiles(id),
  player_id uuid not null references profiles(id),
  primary key (match_id, voter_id),
  check (voter_id <> player_id)
);

create table field_reviews (
  id         uuid primary key default gen_random_uuid(),
  field_id   uuid not null references fields(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  stars      smallint not null check (stars between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (field_id, user_id)
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  target_type text not null check (target_type in ('player', 'venue', 'match')),
  target_id   uuid not null,
  reason      text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

create table push_tokens (
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- =====================================================================
-- الدوال (منطق الأعمال الذرّي)
-- =====================================================================

-- الانضمام لمباراة: يقفل صف المباراة ثم يضيف اللاعب كـ joined أو waitlist
create or replace function join_match(p_match_id uuid)
returns roster_status
language plpgsql security definer set search_path = public as $$
declare
  v_match    matches%rowtype;
  v_count    int;
  v_existing roster_status;
  v_status   roster_status;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'المباراة غير موجودة'; end if;
  if v_match.status not in ('open', 'full') then
    raise exception 'لا يمكن الانضمام لهذه المباراة';
  end if;

  select status into v_existing from match_players
   where match_id = p_match_id and player_id = auth.uid();
  if v_existing in ('joined', 'waitlist') then
    return v_existing;  -- منضم مسبقاً
  end if;

  select count(*) into v_count from match_players
   where match_id = p_match_id and status = 'joined';

  v_status := case when v_count < v_match.max_players then 'joined' else 'waitlist' end;

  insert into match_players (match_id, player_id, status)
  values (p_match_id, auth.uid(), v_status)
  on conflict (match_id, player_id) do update
    set status = excluded.status, team = null, joined_at = now();

  if v_status = 'joined' and v_count + 1 >= v_match.max_players then
    update matches set status = 'full' where id = p_match_id;
  end if;

  return v_status;
end $$;

-- الانسحاب: يرقّي أول لاعب في قائمة الانتظار
create or replace function leave_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_was  roster_status;
  v_next uuid;
begin
  perform 1 from matches where id = p_match_id for update;

  select status into v_was from match_players
   where match_id = p_match_id and player_id = auth.uid();
  if v_was is null or v_was not in ('joined', 'waitlist') then return; end if;

  update match_players set status = 'left', team = null
   where match_id = p_match_id and player_id = auth.uid();

  if v_was = 'joined' then
    select player_id into v_next from match_players
     where match_id = p_match_id and status = 'waitlist'
     order by joined_at limit 1;

    if v_next is not null then
      update match_players set status = 'joined'
       where match_id = p_match_id and player_id = v_next;
      -- TODO: إرسال إشعار للاعب المُرقّى (Edge Function)
    else
      update matches set status = 'open' where id = p_match_id and status = 'full';
    end if;
  end if;
end $$;

-- إعادة حساب مستوى اللاعب (متوسط مرجّح للتقييمات)
create or replace function recalc_player_rating(p_player uuid)
returns void
language sql security definer set search_path = public as $$
  update profiles set skill_rating = coalesce((
    select round(sum(((skill * 2 + teamwork + sportsmanship) / 4.0) * weight) / sum(weight), 2)
      from player_ratings
     where ratee_id = p_player
       and created_at > now() - interval '12 months'
  ), skill_rating)
  where id = p_player;
$$;

create or replace function trg_after_rating() returns trigger
language plpgsql as $$
begin
  perform recalc_player_rating(new.ratee_id);
  return new;
end $$;

create trigger after_rating_insert
after insert on player_ratings
for each row execute function trg_after_rating();

-- =====================================================================
-- الصلاحيات (Row Level Security) — الأساسيات
-- =====================================================================
alter table profiles        enable row level security;
alter table venues          enable row level security;
alter table fields          enable row level security;
alter table field_hours     enable row level security;
alter table field_blackouts enable row level security;
alter table bookings        enable row level security;
alter table matches         enable row level security;
alter table match_players   enable row level security;
alter table match_messages  enable row level security;
alter table player_ratings  enable row level security;
alter table match_mvp_votes enable row level security;
alter table field_reviews   enable row level security;
alter table reports         enable row level security;
alter table push_tokens     enable row level security;

-- الملفات: الجميع يقرأ، كل شخص يعدّل ملفه فقط
create policy "profiles_read"   on profiles for select using (true);
create policy "profiles_update" on profiles for update using (id = auth.uid());
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());

-- الساحات: قراءة عامة، صاحب الساحة يدير ساحاته
create policy "venues_read"  on venues for select using (true);
create policy "venues_owner" on venues for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "fields_read"  on fields for select using (true);
create policy "fields_owner" on fields for all using (
  exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid()));
create policy "hours_read"   on field_hours for select using (true);
create policy "hours_owner"  on field_hours for all using (
  exists (select 1 from fields f join venues v on v.id = f.venue_id
           where f.id = field_id and v.owner_id = auth.uid()));
create policy "blackouts_read" on field_blackouts for select using (true);
create policy "blackouts_owner" on field_blackouts for all using (
  exists (select 1 from fields f join venues v on v.id = f.venue_id
           where f.id = field_id and v.owner_id = auth.uid()));

-- الحجوزات: صاحب الحجز أو صاحب الساحة
create policy "bookings_read" on bookings for select using (
  booked_by = auth.uid() or exists (
    select 1 from fields f join venues v on v.id = f.venue_id
     where f.id = field_id and v.owner_id = auth.uid()));
create policy "bookings_insert" on bookings for insert with check (booked_by = auth.uid());

-- المباريات: العامة يراها الجميع، الخاصة للمشاركين والمنظم
create policy "matches_read" on matches for select using (
  visibility = 'public' or organizer_id = auth.uid() or exists (
    select 1 from match_players mp where mp.match_id = matches.id and mp.player_id = auth.uid()));
create policy "matches_insert" on matches for insert with check (organizer_id = auth.uid());
create policy "matches_update" on matches for update using (organizer_id = auth.uid());

create policy "roster_read" on match_players for select using (true);
-- الانضمام والانسحاب يتمّان عبر الدوال join_match / leave_match فقط
create policy "roster_organizer" on match_players for update using (
  exists (select 1 from matches m where m.id = match_id and m.organizer_id = auth.uid()));

create policy "messages_rw" on match_messages for all using (
  exists (select 1 from match_players mp
           where mp.match_id = match_messages.match_id
             and mp.player_id = auth.uid() and mp.status = 'joined'));

-- التقييم: فقط من حضر نفس المباراة، وخلال 48 ساعة من نهايتها
create policy "ratings_insert" on player_ratings for insert with check (
  rater_id = auth.uid()
  and exists (select 1 from match_players a
               where a.match_id = player_ratings.match_id and a.player_id = auth.uid()
                 and a.status in ('joined', 'attended'))
  and exists (select 1 from match_players b
               where b.match_id = player_ratings.match_id and b.player_id = ratee_id
                 and b.status in ('joined', 'attended'))
  and exists (select 1 from matches m
               where m.id = player_ratings.match_id
                 and now() between m.ends_at and m.ends_at + interval '48 hours'));
-- هوية المقيّم مخفية: اللاعب يرى فقط التقييمات التي كتبها هو
create policy "ratings_read_own" on player_ratings for select using (rater_id = auth.uid());

create policy "mvp_insert" on match_mvp_votes for insert with check (voter_id = auth.uid());
create policy "mvp_read"   on match_mvp_votes for select using (true);

create policy "reviews_read"  on field_reviews for select using (true);
create policy "reviews_write" on field_reviews for insert with check (user_id = auth.uid());

create policy "reports_insert" on reports for insert with check (reporter_id = auth.uid());

create policy "push_tokens_own" on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- تفعيل التحديث الحي لعدّاد اللاعبين والدردشة
alter publication supabase_realtime add table match_players, match_messages, matches;

-- ================================================================
-- 0002_app_api.sql
-- ================================================================
-- =====================================================================
-- «بالملعب» — دوال وواجهات يحتاجها تطبيق اللاعبين
-- =====================================================================

-- رقم الهاتف موجود في auth.users؛ لا نكشفه في جدول الملفات المقروء للجميع
alter table profiles drop column if exists phone;

-- ساعات عمل مبسطة على مستوى الملعب (field_hours تبقى للتسعير التفصيلي لاحقاً)
alter table fields add column if not exists open_hour  smallint not null default 16 check (open_hour between 0 and 23);
alter table fields add column if not exists close_hour smallint not null default 24 check (close_hour between 1 and 24);

-- إنشاء ملف تلقائي عند تسجيل مستخدم جديد
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'لاعب جديد'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- الأوقات المشغولة لملعب (بدون كشف من حجز) — يحتاجها اللاعب لعرض الساعات المتاحة
create or replace function field_busy(p_field_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select lower(during), upper(during) from bookings
   where field_id = p_field_id and status in ('hold', 'confirmed')
     and during && tstzrange(p_from, p_to)
  union all
  select lower(during), upper(during) from field_blackouts
   where field_id = p_field_id and during && tstzrange(p_from, p_to);
$$;

-- حجز + إنشاء مباراة + انضمام المنظّم، في عملية واحدة ذرّية
create or replace function create_match(
  p_field_id uuid,
  p_starts_at timestamptz,
  p_hours int,
  p_players_per_side int,
  p_skill_level skill_level default 'open',
  p_visibility match_visibility default 'public',
  p_title text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_field   fields%rowtype;
  v_ends    timestamptz := p_starts_at + make_interval(hours => p_hours);
  v_booking uuid;
  v_match   uuid;
  v_price   int;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  if p_hours not between 1 and 4 then raise exception 'مدة غير صالحة'; end if;
  if p_starts_at < now() then raise exception 'لا يمكن الحجز في وقت مضى'; end if;

  select * into v_field from fields where id = p_field_id and is_active;
  if not found then raise exception 'الملعب غير متاح'; end if;
  v_price := v_field.default_price * p_hours;

  begin
    insert into bookings (field_id, booked_by, during, status, price)
    values (p_field_id, auth.uid(), tstzrange(p_starts_at, v_ends), 'confirmed', v_price)
    returning id into v_booking;
  exception when exclusion_violation then
    raise exception 'هذا الوقت محجوز مسبقاً';
  end;

  insert into matches (booking_id, organizer_id, title, players_per_side, skill_level, visibility,
                       starts_at, ends_at, cost_per_player)
  values (v_booking, auth.uid(), p_title, p_players_per_side, p_skill_level, p_visibility,
          p_starts_at, v_ends, ceil(v_price::numeric / (p_players_per_side * 2) / 250) * 250)
  returning id into v_match;

  insert into match_players (match_id, player_id, status) values (v_match, auth.uid(), 'joined');
  return v_match;
end $$;

-- بطاقات المباريات للعرض في القوائم (تخضع لصلاحيات المستخدم)
create or replace view match_cards with (security_invoker = true) as
select m.id, m.booking_id, m.organizer_id, m.title, m.players_per_side, m.max_players, m.reserves,
       m.skill_level, m.visibility,
       case when m.status in ('open', 'full') and m.ends_at < now() then 'finished'::match_status else m.status end as status,
       m.starts_at, m.ends_at, m.cost_per_player,
       v.name as venue_name, f.name as field_name,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.status = 'joined')::int as joined_count
  from matches m
  left join bookings b on b.id = m.booking_id
  left join fields  f on f.id = b.field_id
  left join venues  v on v.id = f.venue_id;

-- وزن التقييم يُحدد في الخادم وليس من التطبيق (المقيّم المعتمد = 3)
create or replace function trg_rating_weight() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.weight := case when (select is_certified_rater from profiles where id = new.rater_id) then 3 else 1 end;
  return new;
end $$;

drop trigger if exists before_rating_insert on player_ratings;
create trigger before_rating_insert
before insert on player_ratings
for each row execute function trg_rating_weight();

-- التصويت لأفضل لاعب: فقط من شارك في المباراة
drop policy if exists "mvp_insert" on match_mvp_votes;
create policy "mvp_insert" on match_mvp_votes for insert with check (
  voter_id = auth.uid()
  and exists (select 1 from match_players a
               where a.match_id = match_mvp_votes.match_id and a.player_id = auth.uid()
                 and a.status in ('joined', 'attended')));

grant execute on function join_match(uuid), leave_match(uuid), field_busy(uuid, timestamptz, timestamptz),
  create_match(uuid, timestamptz, int, int, skill_level, match_visibility, text) to authenticated;

-- ================================================================
-- 0003_stats_tournaments.sql
-- ================================================================
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

-- ================================================================
-- 0004_trials_posts_chats_wallet.sql
-- ================================================================
-- =====================================================================
-- «بالملعب» — اختبارات الأندية، المنشورات، المحادثات، المحفظة،
-- إحصائيات البطولة الكاملة، حذف الحساب
-- =====================================================================

-- ---------- إحصائيات البطولة: صناعة وكروت ----------
alter table tournament_scorers add column if not exists assists      int not null default 0;
alter table tournament_scorers add column if not exists yellow_cards int not null default 0;
alter table tournament_scorers add column if not exists red_cards    int not null default 0;

-- ---------- اختبارات الأندية ----------
create table if not exists trials (
  id            uuid primary key default gen_random_uuid(),
  club_name     text not null,
  title         text not null,
  description   text not null default '',
  age_min       int not null default 12,
  age_max       int not null default 25,
  positions     player_position[] not null default '{}',
  venue_name    text not null,
  trial_date    timestamptz not null,
  status        text not null default 'upcoming' check (status in ('upcoming', 'open', 'closed')),
  is_free       boolean not null default true,
  verified_club boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists trial_applications (
  trial_id   uuid not null references trials(id) on delete cascade,
  player_id  uuid not null references profiles(id),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  scout_note text,
  created_at timestamptz not null default now(),
  primary key (trial_id, player_id)
);

create table if not exists trial_alerts (
  player_id  uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table trials             enable row level security;
alter table trial_applications enable row level security;
alter table trial_alerts       enable row level security;

create policy "trials_read"  on trials for select using (true);
create policy "trials_admin" on trials for all using (is_admin()) with check (is_admin());
create policy "apps_own_read" on trial_applications for select using (player_id = auth.uid() or is_admin());
create policy "apps_admin"    on trial_applications for update using (is_admin());
create policy "alerts_own"    on trial_alerts for all using (player_id = auth.uid()) with check (player_id = auth.uid());

-- قائمة الاختبارات مع عدد المتقدمين وحالة طلبي
create or replace function list_trials(p_id uuid default null)
returns table (id uuid, club_name text, title text, description text, age_min int, age_max int,
               positions player_position[], venue_name text, trial_date timestamptz, status text,
               is_free boolean, verified_club boolean, applicants int, my_status text, my_note text)
language sql stable security definer set search_path = public as $$
  select t.id, t.club_name, t.title, t.description, t.age_min, t.age_max, t.positions, t.venue_name,
         t.trial_date, t.status, t.is_free, t.verified_club,
         (select count(*) from trial_applications a where a.trial_id = t.id)::int,
         mine.status, mine.scout_note
    from trials t
    left join trial_applications mine on mine.trial_id = t.id and mine.player_id = auth.uid()
   where p_id is null or t.id = p_id
   order by case t.status when 'open' then 0 when 'upcoming' then 1 else 2 end, t.trial_date;
$$;

create or replace function apply_to_trial(p_trial_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  select status into v_status from trials where id = p_trial_id;
  if v_status is null then raise exception 'الاختبار غير موجود'; end if;
  if v_status <> 'open' then raise exception 'التقديم غير متاح لهذا الاختبار'; end if;
  insert into trial_applications (trial_id, player_id) values (p_trial_id, auth.uid());
exception when unique_violation then
  raise exception 'قدّمت على هذا الاختبار مسبقاً';
end $$;

-- ---------- المنشورات ----------
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('full', 'small')),
  title       text not null,
  body        text not null default '',
  venue_name  text,
  cover_color text not null default '#1E4FD8',
  media_urls  text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table posts enable row level security;
create policy "posts_read"  on posts for select using (true);
create policy "posts_admin" on posts for all using (is_admin()) with check (is_admin());

-- ---------- المحادثات ----------
create table if not exists chat_messages (
  id           bigserial primary key,
  channel      text not null check (channel in ('general', 'announcements', 'support')),
  sender_id    uuid not null references profiles(id),
  -- في محادثة الإدارة: صاحب المحادثة (اللاعب)
  thread_owner uuid references profiles(id),
  body         text not null check (length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_channel on chat_messages (channel, created_at desc);
alter table chat_messages enable row level security;

create policy "chat_read" on chat_messages for select using (
  auth.uid() is not null and (
    channel in ('general', 'announcements')
    or thread_owner = auth.uid()
    or is_admin()));
create policy "chat_insert" on chat_messages for insert with check (
  sender_id = auth.uid() and (
    (channel = 'general' and thread_owner is null)
    or (channel = 'announcements' and is_admin())
    or (channel = 'support' and (thread_owner = auth.uid() or is_admin()))));

alter publication supabase_realtime add table chat_messages;

-- ---------- المحفظة ----------
create table if not exists wallet_transactions (
  id         bigserial primary key,
  player_id  uuid not null references profiles(id),
  kind       text not null check (kind in ('topup', 'payment', 'reward', 'refund')),
  amount     int not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
alter table wallet_transactions enable row level security;
create policy "wallet_own"   on wallet_transactions for select using (player_id = auth.uid());
create policy "wallet_admin" on wallet_transactions for all using (is_admin()) with check (is_admin());

-- ---------- حذف الحساب ----------
-- نُبقي سجل المباريات متّسقاً: الملف يُجهَّل ولا يُحذف، والمستخدم يُحذف من نظام الدخول
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add column if not exists deleted_at timestamptz;

create or replace function delete_my_account()
returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null then raise exception 'يجب تسجيل الدخول'; end if;
  update profiles set full_name = 'حساب محذوف', city = null, avatar_url = null, attributes = null, deleted_at = now()
   where id = v_id;
  delete from push_tokens where user_id = v_id;
  delete from trial_alerts where player_id = v_id;
  update match_players set status = 'left'
   where player_id = v_id and status in ('joined', 'waitlist')
     and match_id in (select id from matches where starts_at > now());
  delete from auth.users where id = v_id;
end $$;

grant execute on function list_trials(uuid), apply_to_trial(uuid), delete_my_account() to authenticated;

-- ================================================================
-- 0005_registration_rankings.sql
-- ================================================================
-- =====================================================================
-- «بالملعب» — موعد فتح التسجيل للمباريات، وإحصائيات لفترة محددة (التصنيف الشهري)
-- =====================================================================

-- موعد فتح التسجيل (null = مفتوح فوراً)
alter table matches add column if not exists registration_opens_at timestamptz;

-- بطاقات المباريات: نضيف موعد التسجيل وعنوان الساحة (إضافة أعمدة في النهاية فقط)
create or replace view match_cards with (security_invoker = true) as
select m.id, m.booking_id, m.organizer_id, m.title, m.players_per_side, m.max_players, m.reserves,
       m.skill_level, m.visibility,
       case when m.status in ('open', 'full') and m.ends_at < now() then 'finished'::match_status else m.status end as status,
       m.starts_at, m.ends_at, m.cost_per_player,
       v.name as venue_name, f.name as field_name,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.status = 'joined')::int as joined_count,
       m.registration_opens_at,
       v.address as venue_address
  from matches m
  left join bookings b on b.id = m.booking_id
  left join fields  f on f.id = b.field_id
  left join venues  v on v.id = f.venue_id;

-- الانضمام يحترم موعد فتح التسجيل
create or replace function join_match(p_match_id uuid)
returns roster_status
language plpgsql security definer set search_path = public as $$
declare
  v_match    matches%rowtype;
  v_count    int;
  v_existing roster_status;
  v_status   roster_status;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'المباراة غير موجودة'; end if;
  if v_match.status not in ('open', 'full') then
    raise exception 'لا يمكن الانضمام لهذه المباراة';
  end if;
  if v_match.registration_opens_at is not null and v_match.registration_opens_at > now() then
    raise exception 'التسجيل لم يُفتح بعد لهذه المباراة';
  end if;

  select status into v_existing from match_players
   where match_id = p_match_id and player_id = auth.uid();
  if v_existing in ('joined', 'waitlist') then
    return v_existing;
  end if;

  select count(*) into v_count from match_players
   where match_id = p_match_id and status = 'joined';

  v_status := case when v_count < v_match.max_players then 'joined' else 'waitlist' end;

  insert into match_players (match_id, player_id, status)
  values (p_match_id, auth.uid(), v_status)
  on conflict (match_id, player_id) do update
    set status = excluded.status, team = null, joined_at = now();

  if v_status = 'joined' and v_count + 1 >= v_match.max_players then
    update matches set status = 'full' where id = p_match_id;
  end if;

  return v_status;
end $$;

-- إحصائيات اللاعبين بين تاريخين [p_from, p_to) — للتصنيف الشهري
create or replace function player_stats_range(p_from timestamptz, p_to timestamptz)
returns table (player_id uuid, matches int, wins int, draws int, losses int, goals int, assists int, mvps int)
language sql stable security definer set search_path = public as $$
  with played as (
    select mp.player_id, m.id as match_id, mp.team, m.score_a, m.score_b
      from match_players mp
      join matches m on m.id = mp.match_id
     where m.score_a is not null and m.score_b is not null
       and mp.status in ('joined', 'attended')
       and m.starts_at >= p_from and m.starts_at < p_to
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

grant execute on function player_stats_range(timestamptz, timestamptz) to authenticated;

-- ================================================================
-- 0006_suggestions_notifications_admin.sql
-- ================================================================
-- =====================================================================
-- «بالملعب» — إنشاء المباريات للإدارة فقط، اقتراحات اللاعبين، الإشعارات،
-- وصور اللاعبين والملاعب (Supabase Storage)
-- =====================================================================

-- ---------- إنشاء المباريات: لوحة التحكم فقط ----------
create or replace function create_match(
  p_field_id uuid, p_starts_at timestamptz, p_hours int, p_players_per_side int,
  p_skill_level skill_level default 'open', p_visibility match_visibility default 'public', p_title text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'إنشاء المباريات صار من لوحة التحكم فقط';
end $$;

create or replace function admin_create_match(
  p_field_id uuid,
  p_starts_at timestamptz,
  p_hours int,
  p_players_per_side int,
  p_skill_level skill_level default 'open',
  p_visibility match_visibility default 'public',
  p_title text default null,
  p_registration_opens_at timestamptz default null,
  p_suggestion_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_field   fields%rowtype;
  v_ends    timestamptz := p_starts_at + make_interval(hours => p_hours);
  v_booking uuid;
  v_match   uuid;
  v_price   int;
  v_player  uuid;
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  if p_hours not between 1 and 4 then raise exception 'مدة غير صالحة'; end if;
  if p_starts_at < now() then raise exception 'الموعد لازم يكون بالمستقبل'; end if;
  if p_registration_opens_at is not null and p_registration_opens_at > p_starts_at then
    raise exception 'موعد فتح التسجيل لازم يكون قبل المباراة';
  end if;

  select * into v_field from fields where id = p_field_id and is_active;
  if not found then raise exception 'الملعب غير متاح'; end if;
  v_price := v_field.default_price * p_hours;

  begin
    insert into bookings (field_id, booked_by, during, status, price)
    values (p_field_id, auth.uid(), tstzrange(p_starts_at, v_ends), 'confirmed', v_price)
    returning id into v_booking;
  exception when exclusion_violation then
    raise exception 'هذا الوقت محجوز بنفس الملعب';
  end;

  insert into matches (booking_id, organizer_id, title, players_per_side, skill_level, visibility,
                       starts_at, ends_at, cost_per_player, registration_opens_at)
  values (v_booking, auth.uid(), p_title, p_players_per_side, p_skill_level, p_visibility,
          p_starts_at, v_ends, ceil(v_price::numeric / (p_players_per_side * 2) / 250) * 250, p_registration_opens_at)
  returning id into v_match;

  if p_suggestion_id is not null then
    update match_suggestions set status = 'scheduled', match_id = v_match
     where id = p_suggestion_id
     returning player_id into v_player;
    if v_player is not null then
      insert into notifications (user_id, kind, title, body, match_id)
      values (v_player, 'match_created', 'اقتراحك صار مباراة ⚽', 'الإدارة نزّلت المباراة اللي اقترحتها. انضم قبل ما يكتمل العدد!', v_match);
    end if;
  end if;

  return v_match;
end $$;

-- ---------- اقتراحات اللاعبين ----------
create table if not exists match_suggestions (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references profiles(id),
  venue_id         uuid references venues(id),
  venue_text       text,
  day              date not null,
  hour             smallint not null check (hour between 0 and 23),
  players_per_side int not null default 5 check (players_per_side between 2 and 11),
  note             text check (note is null or length(note) <= 500),
  status           text not null default 'pending' check (status in ('pending', 'scheduled', 'rejected')),
  match_id         uuid references matches(id),
  created_at       timestamptz not null default now(),
  check (venue_id is not null or length(trim(coalesce(venue_text, ''))) > 0)
);
alter table match_suggestions enable row level security;
create policy "sugg_insert_own" on match_suggestions for insert with check (player_id = auth.uid() and status = 'pending');
create policy "sugg_read"       on match_suggestions for select using (player_id = auth.uid() or is_admin());
create policy "sugg_admin"      on match_suggestions for update using (is_admin()) with check (is_admin());

-- ---------- الإشعارات داخل التطبيق ----------
create table if not exists notifications (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('promoted', 'registration_open', 'match_created', 'suggestion', 'reminder', 'general')),
  title      text not null,
  body       text not null default '',
  match_id   uuid references matches(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "notif_own_read"   on notifications for select using (user_id = auth.uid());
create policy "notif_own_update" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table notifications;

-- إشعار تلقائي عند الترقية من قائمة الانتظار إلى المباراة
create or replace function trg_notify_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'waitlist' and new.status = 'joined' then
    insert into notifications (user_id, kind, title, body, match_id)
    values (new.player_id, 'promoted', 'دخلت المباراة 🎉', 'انسحب لاعب وصار إلك مكان بالمباراة.', new.match_id);
  end if;
  return new;
end $$;

drop trigger if exists after_roster_promotion on match_players;
create trigger after_roster_promotion
after update of status on match_players
for each row execute function trg_notify_promotion();

-- ---------- صور الملاعب في بطاقات المباريات ----------
create or replace view match_cards with (security_invoker = true) as
select m.id, m.booking_id, m.organizer_id, m.title, m.players_per_side, m.max_players, m.reserves,
       m.skill_level, m.visibility,
       case when m.status in ('open', 'full') and m.ends_at < now() then 'finished'::match_status else m.status end as status,
       m.starts_at, m.ends_at, m.cost_per_player,
       v.name as venue_name, f.name as field_name,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.status = 'joined')::int as joined_count,
       m.registration_opens_at,
       v.address as venue_address,
       v.id as venue_id,
       v.photos[1] as venue_photo
  from matches m
  left join bookings b on b.id = m.booking_id
  left join fields  f on f.id = b.field_id
  left join venues  v on v.id = f.venue_id;

-- الإدارة تعدّل الملاعب (صور، بيانات) من لوحة التحكم
drop policy if exists "venues_admin" on venues;
create policy "venues_admin" on venues for update using (is_admin()) with check (is_admin());

-- ---------- التخزين: صور اللاعبين والملاعب ----------
-- مسار صورة اللاعب: avatars/<user_id>/<file> — كل لاعب يكتب في مجلده فقط
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('venue-photos', 'venue-photos', true) on conflict (id) do nothing;

create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_write_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "venue_photos_read" on storage.objects for select using (bucket_id = 'venue-photos');
create policy "venue_photos_admin" on storage.objects for insert with check (bucket_id = 'venue-photos' and is_admin());

grant execute on function admin_create_match(uuid, timestamptz, int, int, skill_level, match_visibility, text, timestamptz, uuid) to authenticated;

-- ================================================================
-- 0007_teams.sql
-- ================================================================
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

-- ================================================================
-- 0008_account_deletion_requests.sql
-- ================================================================
-- ════════════════════════════════════════════════════════════════════
-- 0008 — «طلب حذف الحساب» بدل الحذف الفوري
--   • اللاعب يطلب الحذف من «حسابي» ويطلع من حسابه
--   • الطلب يوصل للوحة التحكم، والحذف يصير خلال 30 يوم
--   • إذا اللاعب دخل لحسابه قبل الحذف، الطلب ينلغي تلقائياً
--   • الطلبات اللي خلصت مدتها تنحذف بـ process_due_account_deletions()
--     (تشغّلها الإدارة، أو pg_cron يومياً — شوف README)
-- ════════════════════════════════════════════════════════════════════

create table if not exists account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references profiles(id) on delete cascade,
  player_name  text,          -- الاسم وقت الطلب، حتى يبين للإدارة بعد الحذف
  public_id    text,
  requested_at timestamptz not null default now(),
  due_at       timestamptz not null default now() + interval '30 days',
  status       text not null default 'pending' check (status in ('pending', 'cancelled', 'done')),
  cancelled_at timestamptz,
  done_at      timestamptz
);
create unique index if not exists deletion_one_pending on account_deletion_requests (player_id) where status = 'pending';
alter table account_deletion_requests enable row level security;
create policy "deletion_read" on account_deletion_requests for select using (player_id = auth.uid() or is_admin());
-- الكتابة كلها من الدوال تحت

-- الحذف نفسه (نفس اللي جان يسويه delete_my_account) للاعب معيّن
create or replace function _delete_account(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set full_name = 'حساب محذوف', city = null, avatar_url = null, attributes = null, deleted_at = now()
   where id = p_player;
  delete from push_tokens where user_id = p_player;
  delete from trial_alerts where player_id = p_player;
  update match_players set status = 'left'
   where player_id = p_player and status in ('joined', 'waitlist')
     and match_id in (select id from matches where starts_at > now());
  delete from team_members where player_id = p_player;
  update team_invites set status = 'rejected' where player_id = p_player and status = 'pending';
  -- الفرق اللي هو قائدها: القيادة لأقدم عضو، وإذا ماكو أحد ينحذف الفريق
  update teams t set captain_id = (select tm.player_id from team_members tm where tm.team_id = t.id order by tm.joined_at limit 1)
   where t.captain_id = p_player and exists (select 1 from team_members tm where tm.team_id = t.id);
  delete from teams where captain_id = p_player;
  delete from auth.users where id = p_player;
end $$;
revoke all on function _delete_account(uuid) from public;

-- الحذف الفوري صار طلب: ما نسمح للتطبيق يستدعيه بعد
revoke execute on function delete_my_account() from authenticated;

create or replace function request_account_deletion() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'لازم تسجّل دخول'; end if;
  select id into v_id from account_deletion_requests where player_id = auth.uid() and status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into account_deletion_requests (player_id, player_name, public_id)
  select id, full_name, public_id from profiles where id = auth.uid()
  returning id into v_id;
  return v_id;
end $$;

-- التطبيق يستدعيها كل ما اللاعب يكون داخل لحسابه
create or replace function cancel_my_deletion_request() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update account_deletion_requests set status = 'cancelled', cancelled_at = now()
   where player_id = auth.uid() and status = 'pending';
  return found;
end $$;

create or replace function admin_complete_account_deletion(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_req account_deletion_requests%rowtype;
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  select * into v_req from account_deletion_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'الطلب مو موجود أو انلغى'; end if;
  update account_deletion_requests set status = 'done', done_at = now() where id = p_request;
  perform _delete_account(v_req.player_id);
end $$;

-- كل الطلبات اللي خلصت مدتها (30 يوم) — للإدارة أو pg_cron
create or replace function process_due_account_deletions() returns int
language plpgsql security definer set search_path = public as $$
declare v_req record; v_n int := 0;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  for v_req in select * from account_deletion_requests where status = 'pending' and due_at <= now() for update loop
    update account_deletion_requests set status = 'done', done_at = now() where id = v_req.id;
    perform _delete_account(v_req.player_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

grant execute on function request_account_deletion(), cancel_my_deletion_request(),
  admin_complete_account_deletion(uuid), process_due_account_deletions() to authenticated;

-- ================================================================
-- 0009_ads.sql
-- ================================================================
-- الإعلانات: ستة قوالب ثابتة التصميم، والإدارة تعدّل النصوص والأرقام والتواريخ والمدينة من لوحة التحكم.
-- اللاعب يقرا الإعلانات الفعّالة بس، والإدارة تقرا وتكتب الكل.

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  template text not null check (template in ('services', 'league', 'motm', 'offpeak', 'invite', 'partner')),
  eyebrow text not null default '' check (char_length(eyebrow) <= 30),
  title text not null check (char_length(title) between 3 and 40),
  body text not null default '' check (char_length(body) <= 70),
  cta text check (cta is null or char_length(cta) <= 24),
  link text check (link is null or link ~ '^(/[A-Za-z0-9/_-]*|share:invite)$'),
  badge text check (badge is null or char_length(badge) <= 6),
  countdown_to timestamptz,
  rating numeric(2, 1) check (rating is null or rating between 0 and 5),
  image_url text,
  city text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index if not exists ads_live_idx on ads (active, sort);

alter table ads enable row level security;

drop policy if exists "ads_read_live" on ads;
create policy "ads_read_live" on ads for select using (
  is_admin() or (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
);
drop policy if exists "ads_admin_write" on ads;
create policy "ads_admin_write" on ads for all using (is_admin()) with check (is_admin());

grant select on ads to anon, authenticated;
grant insert, update, delete on ads to authenticated;

-- الإعلانات الستة كبداية (نفس محتوى القوالب)، تتعدل أو تنحذف من لوحة التحكم
insert into ads (template, eyebrow, title, body, cta, link, badge, countdown_to, rating, sort)
select * from (values
  ('services', 'خدمات المباراة', 'حكم، كرات وتصوير', 'اطلبها ويّا حجزك، ويّا المياه والإسعافات', 'اطلبها هسه', '/chats', null, null::timestamptz, null::numeric, 0),
  ('league', 'التسجيل مفتوح', 'دوري بالملعب', '8 فرق · ملاعب النخيل · كأس وميداليات', 'سجّل فريقك', '/tournaments', null, now() + interval '5 days', null, 1),
  ('motm', 'رجل المباراة', 'العب زين.. واكسب', 'أفضل لاعب ياخذ 10,000 د.ع بمحفظته', 'شوف الشروط', '/wallet', '88', null, null, 2),
  ('offpeak', 'عرض العصرية', 'خصم 25% قبل الساعة 5', 'مباريات الصبح والعصر بسعر أقل', 'شوف المباريات', '/venues', '25%', null, null, 3),
  ('invite', 'ادعُ أصدقاءك', '3 أصدقاء = مباراة ببلاش', 'لما يلعبون أول مباراة، حصتك علينا', 'ادعُ هسه', '/invite', null, null, null, 4),
  ('partner', 'المنصور', 'ملاعب النخيل', 'عشب جديد · إنارة ليلية · موقف سيارات', 'احجز بالنخيل', '/venues', null, null, 4.8, 5)
) as v(template, eyebrow, title, body, cta, link, badge, countdown_to, rating, sort)
where not exists (select 1 from ads);

-- ================================================================
-- 0010_rewards_attendance_owner.sql
-- ================================================================
-- =====================================================================
-- 0010: المكافآت (رجل المباراة، دعوة الأصدقاء)، خصم الأوقات الهادئة،
-- الحضور والغياب وإغلاق المباراة، تقارير الأعطال، تنبيهات (مكان انفتح،
-- الأيام المفضلة)، محادثة المباراة، وأصحاب الملاعب.
-- =====================================================================

-- ---------- إعدادات المكافآت (صف واحد، تعدّله الإدارة) ----------
create table if not exists app_settings (
  id              int primary key default 1 check (id = 1),
  motm_reward     int not null default 10000 check (motm_reward between 0 and 1000000),
  referral_reward int not null default 5000 check (referral_reward between 0 and 1000000),
  referral_needed int not null default 3 check (referral_needed between 1 and 20)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;
alter table app_settings enable row level security;
drop policy if exists "settings_read" on app_settings;
create policy "settings_read" on app_settings for select using (true);
drop policy if exists "settings_admin" on app_settings;
create policy "settings_admin" on app_settings for update using (is_admin()) with check (is_admin());
grant select on app_settings to anon, authenticated;
grant update on app_settings to authenticated;

-- ---------- أنواع الإشعارات الجديدة ----------
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'promoted', 'registration_open', 'match_created', 'suggestion', 'reminder', 'general',
  'spot_opened', 'fav_day', 'motm', 'referral', 'no_show'));

-- ---------- تقارير الأعطال ----------
create table if not exists crash_reports (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete set null default auth.uid(),
  message     text not null check (char_length(message) between 1 and 500),
  stack       text check (stack is null or char_length(stack) <= 4000),
  platform    text check (platform in ('android', 'ios', 'web')),
  app_version text check (app_version is null or char_length(app_version) <= 20),
  screen      text check (screen is null or char_length(screen) <= 120),
  created_at  timestamptz not null default now()
);
create index if not exists crash_reports_created on crash_reports (created_at desc);
alter table crash_reports enable row level security;
drop policy if exists "crash_insert" on crash_reports;
create policy "crash_insert" on crash_reports for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists "crash_admin" on crash_reports;
create policy "crash_admin" on crash_reports for select using (is_admin());
drop policy if exists "crash_admin_delete" on crash_reports;
create policy "crash_admin_delete" on crash_reports for delete using (is_admin());
grant insert on crash_reports to anon, authenticated;
grant select, delete on crash_reports to authenticated;
grant usage on sequence crash_reports_id_seq to anon, authenticated;

-- حد: 30 تقرير بالساعة لكل جهاز/لاعب حتى ما ينملي الجدول
create or replace function trg_crash_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from crash_reports
       where created_at > now() - interval '1 hour'
         and user_id is not distinct from new.user_id) >= 30 then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists crash_rate_limit on crash_reports;
create trigger crash_rate_limit before insert on crash_reports for each row execute function trg_crash_rate_limit();

-- ---------- المباريات: الخصم، رجل المباراة، الإغلاق، الحضور ----------
alter table matches add column if not exists discount_pct int not null default 0 check (discount_pct between 0 and 90);
alter table matches add column if not exists motm_player_id uuid references profiles(id) on delete set null;
alter table matches add column if not exists closed_at timestamptz;
alter table match_players add column if not exists attendance text check (attendance in ('attended', 'no_show'));

create or replace view match_cards with (security_invoker = true) as
select m.id, m.booking_id, m.organizer_id, m.title, m.players_per_side, m.max_players, m.reserves,
       m.skill_level, m.visibility,
       case when m.status in ('open', 'full') and m.ends_at < now() then 'finished'::match_status else m.status end as status,
       m.starts_at, m.ends_at, m.cost_per_player,
       v.name as venue_name, f.name as field_name,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.status = 'joined')::int as joined_count,
       m.registration_opens_at,
       v.address as venue_address,
       v.id as venue_id,
       v.photos[1] as venue_photo,
       v.city as venue_city,
       m.discount_pct,
       m.motm_player_id,
       (select full_name from profiles p where p.id = m.motm_player_id) as motm_name,
       m.closed_at,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.attendance = 'attended')::int as attended_count,
       (select count(*) from match_players mp where mp.match_id = m.id and mp.attendance = 'no_show')::int as no_show_count
  from matches m
  left join bookings b on b.id = m.booking_id
  left join fields  f on f.id = b.field_id
  left join venues  v on v.id = f.venue_id;

-- خصم الأوقات الهادئة (الإدارة)
create or replace function admin_set_match_discount(p_match uuid, p_pct int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  if p_pct < 0 or p_pct > 90 then raise exception 'الخصم من 0 لـ 90%%'; end if;
  update matches set discount_pct = p_pct where id = p_match;
end $$;
grant execute on function admin_set_match_discount(uuid, int) to authenticated;

-- ---------- دعوة الأصدقاء ----------
create table if not exists referrals (
  referred_id uuid primary key references profiles(id) on delete cascade,
  referrer_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at  timestamptz,
  check (referred_id <> referrer_id)
);
create index if not exists referrals_referrer on referrals (referrer_id);
alter table referrals enable row level security;
drop policy if exists "referrals_read" on referrals;
create policy "referrals_read" on referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid() or is_admin());
grant select on referrals to authenticated;

-- اللاعب الجديد يكتب رقم صديقه (خلال 14 يوم من التسجيل، ومرة وحدة)
create or replace function claim_referral(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_ref profiles;
  v_created timestamptz;
begin
  if v_me is null then raise exception 'لازم تسجّل دخول'; end if;
  select * into v_ref from profiles where public_id = p_code;
  if v_ref.id is null then raise exception 'ماكو لاعب بهذا الرقم'; end if;
  if v_ref.id = v_me then raise exception 'ما تكدر تدعو نفسك 🙂'; end if;
  if exists (select 1 from referrals where referred_id = v_me) then raise exception 'سجّلت رقم صديق من قبل'; end if;
  if exists (select 1 from referrals where referred_id = v_ref.id and referrer_id = v_me) then raise exception 'هذا الصديق إنت دعيته'; end if;
  select created_at into v_created from profiles where id = v_me;
  if v_created < now() - interval '14 days' then raise exception 'رقم الصديق ينكتب بأول 14 يوم من التسجيل بس'; end if;
  insert into referrals (referred_id, referrer_id) values (v_me, v_ref.id);
  return v_ref.full_name;
end $$;
grant execute on function claim_referral(text) to authenticated;

-- ---------- تنبيه «انفتح مكان» ----------
create table if not exists match_watchers (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
alter table match_watchers enable row level security;
drop policy if exists "watchers_own" on match_watchers;
create policy "watchers_own" on match_watchers for all using (player_id = auth.uid()) with check (player_id = auth.uid());
grant select, insert, delete on match_watchers to authenticated;

create or replace function trg_notify_spot_opened() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if old.status = 'joined' and new.status <> 'joined' then
    select coalesce(v.name, 'المباراة') into v_title
      from matches m left join bookings b on b.id = m.booking_id left join fields f on f.id = b.field_id left join venues v on v.id = f.venue_id
     where m.id = new.match_id;
    insert into notifications (user_id, kind, title, body, match_id)
    select w.player_id, 'spot_opened', 'انفتح مكان! ⚡', v_title || ' — الحق مكانك قبل غيرك', new.match_id
      from match_watchers w
     where w.match_id = new.match_id
       and not exists (select 1 from match_players mp where mp.match_id = w.match_id and mp.player_id = w.player_id and mp.status = 'joined');
    delete from match_watchers where match_id = new.match_id;
  end if;
  return new;
end $$;
drop trigger if exists notify_spot_opened on match_players;
create trigger notify_spot_opened after update of status on match_players
for each row execute function trg_notify_spot_opened();

-- ---------- الأيام المفضلة: إشعار لما تنزل مباراة بيومك ----------
alter table profiles add column if not exists fav_days smallint[] not null default '{}';

create or replace function trg_notify_fav_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_city text; v_venue text; v_dow int;
begin
  if new.visibility <> 'public' then return new; end if;
  select v.city, v.name into v_city, v_venue
    from bookings b join fields f on f.id = b.field_id join venues v on v.id = f.venue_id
   where b.id = new.booking_id;
  v_dow := extract(dow from new.starts_at at time zone 'Asia/Baghdad')::int;
  insert into notifications (user_id, kind, title, body, match_id)
  select p.id, 'fav_day', 'مباراة جديدة بيومك المفضل ⚽',
         coalesce(v_venue, 'مباراة') || ' — ' || to_char(new.starts_at at time zone 'Asia/Baghdad', 'HH12:MI'), new.id
    from profiles p
   where v_dow = any (p.fav_days)
     and p.id <> new.organizer_id
     and (p.city is null or v_city is null or p.city = v_city);
  return new;
end $$;
drop trigger if exists notify_fav_day on matches;
create trigger notify_fav_day after insert on matches for each row execute function trg_notify_fav_day();

-- ---------- محادثة المباراة: المنضمين والمنظّم والإدارة ----------
drop policy if exists "messages_rw" on match_messages;
drop policy if exists "match_chat_read" on match_messages;
create policy "match_chat_read" on match_messages for select using (
  is_admin()
  or exists (select 1 from matches m where m.id = match_messages.match_id and m.organizer_id = auth.uid())
  or exists (select 1 from match_players mp where mp.match_id = match_messages.match_id and mp.player_id = auth.uid() and mp.status = 'joined'));
drop policy if exists "match_chat_insert" on match_messages;
create policy "match_chat_insert" on match_messages for insert with check (
  sender_id = auth.uid() and char_length(body) between 1 and 1000 and (
    is_admin()
    or exists (select 1 from matches m where m.id = match_messages.match_id and m.organizer_id = auth.uid())
    or exists (select 1 from match_players mp where mp.match_id = match_messages.match_id and mp.player_id = auth.uid() and mp.status = 'joined')));
grant select, insert on match_messages to authenticated;
grant usage on sequence match_messages_id_seq to authenticated;

-- ---------- إغلاق المباراة: الحضور، الغياب، رجل المباراة، مكافآت الدعوة ----------
-- p_attendance: {"<player_id>": "attended" | "no_show", ...}
create or replace function close_match(p_match uuid, p_attendance jsonb, p_motm uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_m matches;
  v_venue text;
  v_price int;
  v_set app_settings;
  v_charged int := 0;
  v_motm_reward int := 0;
  r record;
  v_ref record;
  v_batch uuid[];
begin
  select * into v_m from matches where id = p_match for update;
  if v_m.id is null then raise exception 'المباراة مو موجودة'; end if;
  if not (is_admin() or v_m.organizer_id = auth.uid()) then raise exception 'بس المنظّم أو الإدارة يسكّرون المباراة'; end if;
  if v_m.starts_at > now() then raise exception 'المباراة بعد ما بدت'; end if;
  if v_m.closed_at is not null then raise exception 'المباراة مسكّرة من قبل'; end if;
  select * into v_set from app_settings where id = 1;
  select coalesce(v.name, 'المباراة') into v_venue
    from bookings b join fields f on f.id = b.field_id join venues v on v.id = f.venue_id where b.id = v_m.booking_id;
  v_price := case when v_m.cost_per_player is null then 0 else round(v_m.cost_per_player * (100 - v_m.discount_pct) / 100.0)::int end;

  -- الحضور
  update match_players mp
     set attendance = case when p_attendance ->> mp.player_id::text = 'no_show' then 'no_show' else 'attended' end
   where mp.match_id = p_match and mp.status = 'joined';

  -- الغياب: المبلغ على اللاعب، أو على القائد إذا دخّله ويّا الفريق
  if v_price > 0 then
    for r in
      select mp.player_id, coalesce(mp.paid_by, mp.player_id) as payer, p.full_name
        from match_players mp join profiles p on p.id = mp.player_id
       where mp.match_id = p_match and mp.attendance = 'no_show'
    loop
      insert into wallet_transactions (player_id, kind, amount, note)
      values (r.payer, 'payment', -v_price, 'غياب عن مباراة ' || v_venue || case when r.payer <> r.player_id then ' — ' || r.full_name else '' end);
      insert into notifications (user_id, kind, title, body, match_id)
      values (r.payer, 'no_show', 'انخصم مبلغ غياب', v_price || ' د.ع — ' || v_venue, p_match);
      v_charged := v_charged + 1;
    end loop;
  end if;

  -- رجل المباراة (لازم يكون حاضر)
  if p_motm is not null then
    if not exists (select 1 from match_players where match_id = p_match and player_id = p_motm and attendance = 'attended') then
      raise exception 'رجل المباراة لازم يكون من الحاضرين';
    end if;
    update matches set motm_player_id = p_motm where id = p_match;
    v_motm_reward := v_set.motm_reward;
    if v_motm_reward > 0 then
      insert into wallet_transactions (player_id, kind, amount, note) values (p_motm, 'reward', v_motm_reward, 'رجل المباراة 🏅 ' || v_venue);
    end if;
    insert into notifications (user_id, kind, title, body, match_id)
    values (p_motm, 'motm', 'إنت رجل المباراة 🏅', case when v_motm_reward > 0 then v_motm_reward || ' د.ع انضافت لمحفظتك' else v_venue end, p_match);
  end if;

  -- دعوة الأصدقاء: أول مباراة يحضرها الصديق تحسب
  update referrals rf set qualified_at = now()
   where rf.qualified_at is null
     and exists (select 1 from match_players mp where mp.match_id = p_match and mp.player_id = rf.referred_id and mp.attendance = 'attended');
  for v_ref in select distinct referrer_id from referrals where qualified_at is not null and rewarded_at is null loop
    loop
      select array_agg(referred_id) into v_batch from (
        select referred_id from referrals
         where referrer_id = v_ref.referrer_id and qualified_at is not null and rewarded_at is null
         order by qualified_at limit v_set.referral_needed) s;
      exit when coalesce(array_length(v_batch, 1), 0) < v_set.referral_needed;
      update referrals set rewarded_at = now() where referred_id = any (v_batch);
      if v_set.referral_reward > 0 then
        insert into wallet_transactions (player_id, kind, amount, note)
        values (v_ref.referrer_id, 'reward', v_set.referral_reward, 'دعوة أصدقاء 🎁');
      end if;
      insert into notifications (user_id, kind, title, body)
      values (v_ref.referrer_id, 'referral', 'مكافأة دعوة الأصدقاء 🎁', v_set.referral_reward || ' د.ع انضافت لمحفظتك');
    end loop;
  end loop;

  update matches set closed_at = now() where id = p_match;
  return jsonb_build_object('charged', v_charged, 'motm_reward', v_motm_reward);
end $$;
grant execute on function close_match(uuid, jsonb, uuid) to authenticated;

-- ---------- أصحاب الملاعب ----------
-- الإدارة تحدد صاحب الملعب برقمه (ID)، ويصير دوره «owner» إذا جان لاعب
create or replace function admin_set_venue_owner(p_venue uuid, p_public_id text) returns text
language plpgsql security definer set search_path = public as $$
declare v_owner profiles;
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  select * into v_owner from profiles where public_id = p_public_id;
  if v_owner.id is null then raise exception 'ماكو لاعب بهذا الرقم'; end if;
  update venues set owner_id = v_owner.id where id = p_venue;
  if v_owner.role = 'player' then update profiles set role = 'owner' where id = v_owner.id; end if;
  return v_owner.full_name;
end $$;
grant execute on function admin_set_venue_owner(uuid, text) to authenticated;

-- الإدارة تحجب أوقات بأي ملعب (صاحب الملعب عنده سياسة من 0001)
drop policy if exists "blackouts_admin" on field_blackouts;
create policy "blackouts_admin" on field_blackouts for all using (is_admin()) with check (is_admin());
grant select, insert, delete on field_blackouts to authenticated;

-- ================================================================
-- 0011_security_hardening.sql
-- ================================================================
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

-- ================================================================
-- 0012_match_cards.sql
-- ================================================================
-- =====================================================================
-- 0012: البطاقات الصفراء والحمراء بالمباريات
--   • المنظّم يسجّلها ويّا الأهداف والصناعة (حدثان جديدان: yellow / red)
--   • إحصائيات اللاعب ترجع عدد البطاقات حتى تبين على بطاقته بحسابي
-- =====================================================================

alter table match_events drop constraint if exists match_events_kind_check;
alter table match_events add constraint match_events_kind_check check (kind in ('goal', 'assist', 'yellow', 'red'));

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
      or (e->>'kind') not in ('goal', 'assist', 'yellow', 'red');
  if v_bad > 0 then raise exception 'حدث لا يخص لاعباً في المباراة'; end if;

  -- بطاقة حمراء وحدة بالكثير لكل لاعب بالمباراة
  select count(*) into v_bad from (
    select e->>'player_id' from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
     where e->>'kind' = 'red' group by 1 having count(*) > 1) x;
  if v_bad > 0 then raise exception 'اللاعب ياخذ بطاقة حمراء وحدة بالكثير'; end if;

  update matches set score_a = p_score_a, score_b = p_score_b, status = 'finished' where id = p_match_id;
  delete from match_events where match_id = p_match_id;
  insert into match_events (match_id, player_id, kind)
  select p_match_id, (e->>'player_id')::uuid, e->>'kind'
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e;
end $$;

-- نوع الإرجاع تغيّر (عمودين جداد) — لازم نحذف الدالة ونرجع نسوّيها
drop function if exists player_stats(timestamptz, uuid);
create function player_stats(p_since timestamptz default null, p_player uuid default null)
returns table (player_id uuid, matches int, wins int, draws int, losses int, goals int, assists int, mvps int, yellow int, red int)
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
         count(*) filter (where exists (select 1 from mvp where mvp.match_id = p.match_id and mvp.player_id = p.player_id))::int,
         coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'yellow')), 0)::int,
         coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'red')), 0)::int
    from played p
   group by p.player_id;
$$;

drop function if exists player_stats_range(timestamptz, timestamptz);
create function player_stats_range(p_from timestamptz, p_to timestamptz)
returns table (player_id uuid, matches int, wins int, draws int, losses int, goals int, assists int, mvps int, yellow int, red int)
language sql stable security definer set search_path = public as $$
    with played as (
      select mp.player_id, m.id as match_id, mp.team, m.score_a, m.score_b
        from match_players mp
        join matches m on m.id = mp.match_id
       where m.score_a is not null and m.score_b is not null
         and mp.status in ('joined', 'attended')
         and m.starts_at >= p_from and m.starts_at < p_to
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
           count(*) filter (where exists (select 1 from mvp where mvp.match_id = p.match_id and mvp.player_id = p.player_id))::int,
           coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'yellow')), 0)::int,
           coalesce(sum((select count(*) from match_events e where e.match_id = p.match_id and e.player_id = p.player_id and e.kind = 'red')), 0)::int
      from played p
     group by p.player_id;
$$;

grant execute on function player_stats(timestamptz, uuid), player_stats_range(timestamptz, timestamptz) to authenticated;

-- ================================================================
-- 0013_push_staff.sql
-- ================================================================
-- =====================================================================
-- 0013: إشعارات الخادم + الموظفين
--   1) إشعارات حقيقية من الخادم (توصل حتى لو التطبيق مسكّر):
--      «انفتح التسجيل»، «باقي مكان واحد»، «مباراتك بعد ساعة»، و«انلغت المباراة».
--      كلها تنضاف لجدول notifications، ودالة send-push تدزها للهاتف.
--   2) دور «موظف» (staff): يدير المباريات بس — ينشئ، يعدّل الخصم، يلغي،
--      يسجّل النتيجة ويسكّر المباراة. ما يشوف الأرباح ولا الإعلانات ولا الإعدادات.
-- =====================================================================

-- ---------- الأدوار ----------
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('staff', 'admin') from profiles where id = auth.uid()), false);
$$;
grant execute on function is_staff() to authenticated;

-- المدير بس يعيّن أو يشيل موظف (برقم اللاعب العام)
create or replace function admin_set_staff(p_public_id text, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  select * into v_p from profiles where public_id = p_public_id and deleted_at is null;
  if v_p.id is null then raise exception 'ماكو لاعب بهذا الرقم'; end if;
  if v_p.role = 'admin' then raise exception 'هذا الحساب مدير'; end if;
  update profiles set role = case when p_on then 'staff'::user_role else 'player'::user_role end where id = v_p.id;
  return v_p.full_name;
end $$;
grant execute on function admin_set_staff(text, boolean) to authenticated;

create or replace function admin_list_staff()
returns table (id uuid, full_name text, public_id text, avatar_url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'هذه العملية للإدارة فقط'; end if;
  return query select p.id, p.full_name, p.public_id, p.avatar_url from profiles p where p.role = 'staff' order by p.full_name;
end $$;
grant execute on function admin_list_staff() to authenticated;

-- ---------- صلاحيات المباريات للموظفين ----------
drop policy if exists "matches_admin_write" on matches;
create policy "matches_admin_write" on matches for all using (is_staff()) with check (is_staff());

drop policy if exists "roster_organizer" on match_players;
create policy "roster_organizer" on match_players for update using (
  is_staff() or exists (select 1 from matches m where m.id = match_id and m.organizer_id = auth.uid()));

drop policy if exists "match_chat_read" on match_messages;
create policy "match_chat_read" on match_messages for select using (
  is_staff()
  or exists (select 1 from matches m where m.id = match_messages.match_id and m.organizer_id = auth.uid())
  or exists (select 1 from match_players mp where mp.match_id = match_messages.match_id and mp.player_id = auth.uid() and mp.status = 'joined'));
drop policy if exists "match_chat_insert" on match_messages;
create policy "match_chat_insert" on match_messages for insert with check (
  sender_id = auth.uid() and char_length(body) between 1 and 1000 and (
    is_staff()
    or exists (select 1 from matches m where m.id = match_messages.match_id and m.organizer_id = auth.uid())
    or exists (select 1 from match_players mp where mp.match_id = match_messages.match_id and mp.player_id = auth.uid() and mp.status = 'joined')));


-- ---------- دوال المباريات: الموظف مثل المدير ----------
create or replace function admin_create_match(
  p_field_id uuid,
  p_starts_at timestamptz,
  p_hours int,
  p_players_per_side int,
  p_skill_level skill_level default 'open',
  p_visibility match_visibility default 'public',
  p_title text default null,
  p_registration_opens_at timestamptz default null,
  p_suggestion_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_field   fields%rowtype;
  v_ends    timestamptz := p_starts_at + make_interval(hours => p_hours);
  v_booking uuid;
  v_match   uuid;
  v_price   int;
  v_player  uuid;
begin
  if not is_staff() then raise exception 'هذه العملية للإدارة والموظفين فقط'; end if;
  if p_hours not between 1 and 4 then raise exception 'مدة غير صالحة'; end if;
  if p_starts_at < now() then raise exception 'الموعد لازم يكون بالمستقبل'; end if;
  if p_registration_opens_at is not null and p_registration_opens_at > p_starts_at then
    raise exception 'موعد فتح التسجيل لازم يكون قبل المباراة';
  end if;

  select * into v_field from fields where id = p_field_id and is_active;
  if not found then raise exception 'الملعب غير متاح'; end if;
  v_price := v_field.default_price * p_hours;

  begin
    insert into bookings (field_id, booked_by, during, status, price)
    values (p_field_id, auth.uid(), tstzrange(p_starts_at, v_ends), 'confirmed', v_price)
    returning id into v_booking;
  exception when exclusion_violation then
    raise exception 'هذا الوقت محجوز بنفس الملعب';
  end;

  insert into matches (booking_id, organizer_id, title, players_per_side, skill_level, visibility,
                       starts_at, ends_at, cost_per_player, registration_opens_at)
  values (v_booking, auth.uid(), p_title, p_players_per_side, p_skill_level, p_visibility,
          p_starts_at, v_ends, ceil(v_price::numeric / (p_players_per_side * 2) / 250) * 250, p_registration_opens_at)
  returning id into v_match;

  if p_suggestion_id is not null then
    update match_suggestions set status = 'scheduled', match_id = v_match
     where id = p_suggestion_id
     returning player_id into v_player;
    if v_player is not null then
      insert into notifications (user_id, kind, title, body, match_id)
      values (v_player, 'match_created', 'اقتراحك صار مباراة ⚽', 'الإدارة نزّلت المباراة اللي اقترحتها. انضم قبل ما يكتمل العدد!', v_match);
    end if;
  end if;

  return v_match;
end $$;

create or replace function admin_set_match_discount(p_match uuid, p_pct int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'هذه العملية للإدارة والموظفين فقط'; end if;
  if p_pct < 0 or p_pct > 90 then raise exception 'الخصم من 0 لـ 90%%'; end if;
  update matches set discount_pct = p_pct where id = p_match;
end $$;

create or replace function submit_match_result(p_match_id uuid, p_score_a int, p_score_b int, p_events jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match matches%rowtype;
  v_bad   int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'المباراة غير موجودة'; end if;
  if v_match.organizer_id <> auth.uid() and not is_staff() then raise exception 'فقط منظّم المباراة يسجّل النتيجة'; end if;
  if v_match.starts_at > now() then raise exception 'لم تبدأ المباراة بعد'; end if;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'نتيجة غير صالحة'; end if;

  -- كل لاعب في الأحداث يجب أن يكون مشاركاً في المباراة
  select count(*) into v_bad
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
   where not exists (select 1 from match_players mp
                      where mp.match_id = p_match_id and mp.player_id = (e->>'player_id')::uuid
                        and mp.status in ('joined', 'attended'))
      or (e->>'kind') not in ('goal', 'assist', 'yellow', 'red');
  if v_bad > 0 then raise exception 'حدث لا يخص لاعباً في المباراة'; end if;

  -- بطاقة حمراء وحدة بالكثير لكل لاعب بالمباراة
  select count(*) into v_bad from (
    select e->>'player_id' from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
     where e->>'kind' = 'red' group by 1 having count(*) > 1) x;
  if v_bad > 0 then raise exception 'اللاعب ياخذ بطاقة حمراء وحدة بالكثير'; end if;

  update matches set score_a = p_score_a, score_b = p_score_b, status = 'finished' where id = p_match_id;
  delete from match_events where match_id = p_match_id;
  insert into match_events (match_id, player_id, kind)
  select p_match_id, (e->>'player_id')::uuid, e->>'kind'
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e;
end $$;

create or replace function close_match(p_match uuid, p_attendance jsonb, p_motm uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_m matches;
  v_venue text;
  v_price int;
  v_set app_settings;
  v_charged int := 0;
  v_motm_reward int := 0;
  r record;
  v_ref record;
  v_batch uuid[];
begin
  select * into v_m from matches where id = p_match for update;
  if v_m.id is null then raise exception 'المباراة مو موجودة'; end if;
  if not (is_staff() or v_m.organizer_id = auth.uid()) then raise exception 'بس المنظّم أو الإدارة يسكّرون المباراة'; end if;
  if v_m.starts_at > now() then raise exception 'المباراة بعد ما بدت'; end if;
  if v_m.closed_at is not null then raise exception 'المباراة مسكّرة من قبل'; end if;
  select * into v_set from app_settings where id = 1;
  select coalesce(v.name, 'المباراة') into v_venue
    from bookings b join fields f on f.id = b.field_id join venues v on v.id = f.venue_id where b.id = v_m.booking_id;
  v_price := case when v_m.cost_per_player is null then 0 else round(v_m.cost_per_player * (100 - v_m.discount_pct) / 100.0)::int end;

  -- الحضور
  update match_players mp
     set attendance = case when p_attendance ->> mp.player_id::text = 'no_show' then 'no_show' else 'attended' end
   where mp.match_id = p_match and mp.status = 'joined';

  -- الغياب: المبلغ على اللاعب، أو على القائد إذا دخّله ويّا الفريق
  if v_price > 0 then
    for r in
      select mp.player_id, coalesce(mp.paid_by, mp.player_id) as payer, p.full_name
        from match_players mp join profiles p on p.id = mp.player_id
       where mp.match_id = p_match and mp.attendance = 'no_show'
    loop
      insert into wallet_transactions (player_id, kind, amount, note)
      values (r.payer, 'payment', -v_price, 'غياب عن مباراة ' || v_venue || case when r.payer <> r.player_id then ' — ' || r.full_name else '' end);
      insert into notifications (user_id, kind, title, body, match_id)
      values (r.payer, 'no_show', 'انخصم مبلغ غياب', v_price || ' د.ع — ' || v_venue, p_match);
      v_charged := v_charged + 1;
    end loop;
  end if;

  -- رجل المباراة (لازم يكون حاضر)
  if p_motm is not null then
    if not exists (select 1 from match_players where match_id = p_match and player_id = p_motm and attendance = 'attended') then
      raise exception 'رجل المباراة لازم يكون من الحاضرين';
    end if;
    update matches set motm_player_id = p_motm where id = p_match;
    v_motm_reward := v_set.motm_reward;
    if v_motm_reward > 0 then
      insert into wallet_transactions (player_id, kind, amount, note) values (p_motm, 'reward', v_motm_reward, 'رجل المباراة 🏅 ' || v_venue);
    end if;
    insert into notifications (user_id, kind, title, body, match_id)
    values (p_motm, 'motm', 'إنت رجل المباراة 🏅', case when v_motm_reward > 0 then v_motm_reward || ' د.ع انضافت لمحفظتك' else v_venue end, p_match);
  end if;

  -- دعوة الأصدقاء: أول مباراة يحضرها الصديق تحسب
  update referrals rf set qualified_at = now()
   where rf.qualified_at is null
     and exists (select 1 from match_players mp where mp.match_id = p_match and mp.player_id = rf.referred_id and mp.attendance = 'attended');
  for v_ref in select distinct referrer_id from referrals where qualified_at is not null and rewarded_at is null loop
    loop
      select array_agg(referred_id) into v_batch from (
        select referred_id from referrals
         where referrer_id = v_ref.referrer_id and qualified_at is not null and rewarded_at is null
         order by qualified_at limit v_set.referral_needed) s;
      exit when coalesce(array_length(v_batch, 1), 0) < v_set.referral_needed;
      update referrals set rewarded_at = now() where referred_id = any (v_batch);
      if v_set.referral_reward > 0 then
        insert into wallet_transactions (player_id, kind, amount, note)
        values (v_ref.referrer_id, 'reward', v_set.referral_reward, 'دعوة أصدقاء 🎁');
      end if;
      insert into notifications (user_id, kind, title, body)
      values (v_ref.referrer_id, 'referral', 'مكافأة دعوة الأصدقاء 🎁', v_set.referral_reward || ' د.ع انضافت لمحفظتك');
    end loop;
  end loop;

  update matches set closed_at = now() where id = p_match;
  return jsonb_build_object('charged', v_charged, 'motm_reward', v_motm_reward);
end $$;

-- إلغاء مباراة (الموظف أو المدير): اللاعبين المنضمين ينبلّغون
create or replace function staff_cancel_match(p_match uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_m matches;
begin
  if not is_staff() then raise exception 'هذه العملية للإدارة والموظفين فقط'; end if;
  select * into v_m from matches where id = p_match for update;
  if v_m.id is null then raise exception 'المباراة مو موجودة'; end if;
  if v_m.status = 'cancelled' then return; end if;
  if v_m.closed_at is not null then raise exception 'المباراة مسكّرة، ما تنلغي'; end if;
  update matches set status = 'cancelled' where id = p_match;
  -- نفك حجز الساحة حتى تنحجز لغيرها
  update bookings set status = 'cancelled' where id = v_m.booking_id;
  insert into notifications (user_id, kind, title, body, match_id)
  select mp.player_id, 'cancelled', 'انلغت المباراة ❌',
         coalesce(nullif(trim(p_reason), ''), 'الإدارة لغت المباراة. تكدر تنضم لمباراة ثانية من الرئيسية.'), p_match
    from match_players mp where mp.match_id = p_match and mp.status in ('joined', 'waitlist');
end $$;
grant execute on function staff_cancel_match(uuid, text) to authenticated;

-- ---------- أنواع الإشعارات ----------
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'promoted', 'registration_open', 'match_created', 'suggestion', 'reminder', 'general',
  'spot_opened', 'fav_day', 'motm', 'referral', 'no_show', 'one_left', 'cancelled'));

-- ---------- «نبهني لما ينفتح التسجيل» على الخادم ----------
create table if not exists registration_alerts (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
alter table registration_alerts enable row level security;
drop policy if exists "regalerts_own" on registration_alerts;
create policy "regalerts_own" on registration_alerts for all using (player_id = auth.uid()) with check (player_id = auth.uid());
grant select, insert, delete on registration_alerts to authenticated;

-- حتى ما ينبعث نفس الإشعار مرتين
alter table matches add column if not exists reg_open_notified_at timestamptz;
alter table matches add column if not exists one_left_notified_at timestamptz;
alter table matches add column if not exists reminder_sent_at timestamptz;

-- اسم الملعب للمباراة (للنصوص)
create or replace function match_venue_name(p_match uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(v.name, m.title, 'المباراة')
    from matches m left join bookings b on b.id = m.booking_id left join fields f on f.id = b.field_id left join venues v on v.id = f.venue_id
   where m.id = p_match;
$$;
revoke execute on function match_venue_name(uuid) from public, anon, authenticated;

-- الوقت بتوقيت بغداد: «8:30 م»
create or replace function baghdad_clock(p_ts timestamptz) returns text
language sql immutable set search_path = public as $$
  select ltrim(to_char(p_ts at time zone 'Asia/Baghdad', 'HH12:MI'), '0')
      || case when extract(hour from p_ts at time zone 'Asia/Baghdad') < 12 then ' ص' else ' م' end;
$$;

-- ---------- «باقي مكان واحد»: لما ينضم لاعب ويبقى مكان واحد ----------
-- ينبلّغ: اللي يتابعون المباراة، واللي طلبوا تنبيه التسجيل، وأصحاب اليوم المفضل بنفس المدينة — إذا مو منضمين
create or replace function trg_notify_one_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_m matches; v_joined int; v_venue text; v_city text; v_dow int;
begin
  if new.status <> 'joined' or (tg_op = 'UPDATE' and old.status = 'joined') then return new; end if;
  select * into v_m from matches where id = new.match_id;
  if v_m.one_left_notified_at is not null or v_m.status not in ('open', 'full') or v_m.starts_at <= now() then return new; end if;
  select count(*) into v_joined from match_players where match_id = new.match_id and status = 'joined';
  if v_m.max_players - v_joined <> 1 then return new; end if;
  update matches set one_left_notified_at = now() where id = v_m.id;
  select coalesce(v.name, 'المباراة'), v.city into v_venue, v_city
    from bookings b join fields f on f.id = b.field_id join venues v on v.id = f.venue_id where b.id = v_m.booking_id;
  v_dow := extract(dow from v_m.starts_at at time zone 'Asia/Baghdad')::int;
  insert into notifications (user_id, kind, title, body, match_id)
  select distinct u.id, 'one_left', 'باقي مكان واحد! ⏳',
         coalesce(v_venue, 'المباراة') || ' — ' || baghdad_clock(v_m.starts_at) || '. الحقه قبل غيرك', v_m.id
    from (
      select player_id as id from match_watchers where match_id = v_m.id
      union select player_id from registration_alerts where match_id = v_m.id
      union select p.id from profiles p
        where v_m.visibility = 'public' and v_dow = any (p.fav_days)
          and (p.city is null or v_city is null or p.city = v_city)
    ) u
   where u.id <> v_m.organizer_id
     and not exists (select 1 from match_players mp where mp.match_id = v_m.id and mp.player_id = u.id and mp.status in ('joined', 'waitlist'));
  return new;
end $$;
drop trigger if exists notify_one_left on match_players;
create trigger notify_one_left after insert or update of status on match_players
for each row execute function trg_notify_one_left();

-- ---------- المهام الدورية (كل دقيقة) ----------
-- «انفتح التسجيل» و«مباراتك بعد ساعة» — يرجّع عدد الإشعارات المنضافة
create or replace function run_notification_jobs() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_n int; r record;
begin
  -- 1) انفتح التسجيل
  for r in
    select m.id, m.starts_at from matches m
     where m.registration_opens_at is not null and m.registration_opens_at <= now()
       and m.registration_opens_at > now() - interval '1 day'
       and m.reg_open_notified_at is null and m.status in ('open', 'full') and m.starts_at > now()
     for update skip locked
  loop
    update matches set reg_open_notified_at = now() where id = r.id;
    insert into notifications (user_id, kind, title, body, match_id)
    select a.player_id, 'registration_open', 'انفتح التسجيل! 🔔',
           match_venue_name(r.id) || ' — سجّل هسه قبل ما يكتمل العدد', r.id
      from registration_alerts a
     where a.match_id = r.id
       and not exists (select 1 from match_players mp where mp.match_id = r.id and mp.player_id = a.player_id and mp.status in ('joined', 'waitlist'));
    get diagnostics v_n = row_count; v_count := v_count + v_n;
  end loop;

  -- 2) مباراتك بعد ساعة
  for r in
    select m.id, m.starts_at from matches m
     where m.starts_at > now() and m.starts_at <= now() + interval '60 minutes'
       and m.reminder_sent_at is null and m.status in ('open', 'full')
     for update skip locked
  loop
    update matches set reminder_sent_at = now() where id = r.id;
    insert into notifications (user_id, kind, title, body, match_id)
    select mp.player_id, 'reminder', 'مباراتك بعد ساعة ⚽🔥',
           match_venue_name(r.id) || ' — الساعة ' || baghdad_clock(r.starts_at) || '. تعال قبل ربع ساعة، الملعب علينا واللعب عليك 😎', r.id
      from match_players mp where mp.match_id = r.id and mp.status = 'joined';
    get diagnostics v_n = row_count; v_count := v_count + v_n;
  end loop;
  return v_count;
end $$;
revoke execute on function run_notification_jobs() from public, anon, authenticated;

-- التشغيل كل دقيقة (Supabase Cron / pg_cron) — إذا الإضافة مو مفعّلة، فعّلها من Database → Extensions وأعد تشغيل هذا الجزء
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'balmalaab-notifications';
    perform cron.schedule('balmalaab-notifications', '* * * * *', 'select public.run_notification_jobs()');
  else
    raise notice 'pg_cron غير متوفر: شغّل select run_notification_jobs() دورياً';
  end if;
end $$;
