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
