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
  ('invite', 'ادعُ أصدقاءك', '3 أصدقاء = مباراة ببلاش', 'لما يلعبون أول مباراة، حصتك علينا', 'دز الرابط', 'share:invite', null, null, null, 4),
  ('partner', 'المنصور', 'ملاعب النخيل', 'عشب جديد · إنارة ليلية · موقف سيارات', 'احجز بالنخيل', '/venues', null, null, 4.8, 5)
) as v(template, eyebrow, title, body, cta, link, badge, countdown_to, rating, sort)
where not exists (select 1 from ads);
