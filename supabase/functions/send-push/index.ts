// Supabase Edge Function: إرسال إشعار للهاتف عند إضافة صف في جدول notifications
//
// الإعداد (مرة واحدة):
// 1) supabase functions deploy send-push
// 2) supabase secrets set WEBHOOK_SECRET=<قيمة عشوائية طويلة>
// 3) من لوحة Supabase: Database → Webhooks → جديد
//    الجدول: notifications، الحدث: INSERT، النوع: Supabase Edge Function → send-push
//    أضف Header باسم x-webhook-secret وقيمته نفس WEBHOOK_SECRET
//
// يرسل عبر خدمة Expo Push، ويحتاج أن يكون التطبيق مرتبطاً بمشروع EAS
// (projectId في app.json → extra.eas.projectId) وبإعداد FCM للأندرويد.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationRow {
  user_id: string;
  title: string;
  body: string;
  match_id: string | null;
  kind: string;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = await req.json();
  const row = payload?.record as NotificationRow | undefined;
  if (payload?.type !== 'INSERT' || !row?.user_id) return new Response('ignored', { status: 200 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: tokens, error } = await sb.from('push_tokens').select('token').eq('user_id', row.user_id);
  if (error) return new Response(error.message, { status: 500 });

  const messages = (tokens ?? [])
    .map((t) => t.token as string)
    .filter((t) => t.startsWith('ExponentPushToken['))
    .map((to) => ({ to, title: row.title, body: row.body, sound: 'default', data: { match_id: row.match_id, kind: row.kind } }));
  if (!messages.length) return new Response('no tokens', { status: 200 });

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  return new Response(await res.text(), { status: res.ok ? 200 : 502 });
});
