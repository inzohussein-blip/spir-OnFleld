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
