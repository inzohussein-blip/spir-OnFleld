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
