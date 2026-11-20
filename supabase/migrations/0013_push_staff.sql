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
