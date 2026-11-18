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
