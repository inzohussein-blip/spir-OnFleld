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
