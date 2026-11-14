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
