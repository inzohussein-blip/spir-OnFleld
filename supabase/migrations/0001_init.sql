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
