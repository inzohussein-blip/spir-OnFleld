-- =====================================================================
-- بعد ما تسجّل دخول أول مرة من التطبيق: خلي حسابك مدير، وضيف أول ملعب
-- بدّل القيم بين < > وشغّل الملف بـ SQL Editor
-- =====================================================================

-- 1) خلي حسابك مدير — رقمك (ID) يطلع بـ «حسابي» تحت بطاقتك
update profiles set role = 'admin' where public_id = '<رقمك من حسابي، مثلاً 7310524>';

-- 2) ضيف ملعب وساحاته (المالك = أنت، وتكدر تحوّله لصاحب الملعب بعدين من لوحة التحكم)
with me as (
  select id from profiles where public_id = '<رقمك من حسابي>'
), v as (
  insert into venues (owner_id, name, city, address, lat, lng, is_verified)
  select id, '<اسم الملعب، مثلاً ملاعب النخيل>', '<المحافظة، مثلاً بغداد>', '<المنطقة، مثلاً المنصور قرب ساحة الرواد>',
         <خط العرض، مثلاً 33.3152>, <خط الطول، مثلاً 44.3661>, true
    from me
  returning id
)
insert into fields (venue_id, name, players_per_side, default_price)
select v.id, f.name, f.size, f.price
  from v,
  (values
     ('ساحة 1', 5, 40000),   -- الاسم، اللاعبين بكل فريق (5 = خماسي)، سعر الساعة بالدينار
     ('ساحة 2', 7, 60000)
  ) as f(name, size, price);

-- 3) تأكد
select v.name as venue, f.name as field, f.players_per_side, f.default_price
  from venues v join fields f on f.venue_id = v.id order by v.name, f.name;
