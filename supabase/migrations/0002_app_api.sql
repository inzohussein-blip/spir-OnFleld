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
