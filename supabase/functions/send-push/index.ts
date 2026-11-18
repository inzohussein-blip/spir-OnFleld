// Supabase Edge Function: يدز إشعار للهاتف لما ينضاف صف بجدول notifications
//
// الإشعارات نفسها تنكتب بقاعدة البيانات (0013_push_staff.sql):
// «انفتح التسجيل»، «باقي مكان واحد»، «مباراتك بعد ساعة»، «انلغت المباراة»، «دخلت المباراة»...
// هاي الدالة بس توصلها للهاتف.
//
// الإعداد (مرة واحدة) — التفاصيل بـ docs/push.md:
// 1) supabase functions deploy send-push --no-verify-jwt
// 2) supabase secrets set WEBHOOK_SECRET=<قيمة عشوائية طويلة>
// 3) supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"   ← من Firebase
// 4) Database → Webhooks → جديد: الجدول notifications، الحدث INSERT،
//    النوع Supabase Edge Function → send-push، وHeader باسم x-webhook-secret بنفس القيمة
//
// يدعم نوعين من رموز الأجهزة:
// - رمز Firebase مباشر (الأندرويد بدون حساب EAS) ← FCM HTTP v1
// - رمز Expo (ExponentPushToken[...]) إذا التطبيق مربوط بمشروع EAS ← خدمة Expo

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationRow {
  user_id: string;
  title: string;
  body: string;
  match_id: string | null;
  kind: string;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// رمز دخول Google من حساب الخدمة (JWT موقّع RS256) — ينحفظ لحد ما يخلص
let cached: { token: string; exp: number } | null = null;
async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

/** يدز لرموز Firebase — يرجّع الرموز اللي ما عادت صالحة (التطبيق انحذف) */
async function sendFcm(sa: ServiceAccount, tokens: string[], row: NotificationRow): Promise<string[]> {
  const access = await googleAccessToken(sa);
  const dead: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: row.title, body: row.body },
            data: { match_id: row.match_id ?? '', kind: row.kind },
            android: { priority: 'high', notification: { channel_id: 'matches', sound: 'default' } },
          },
        }),
      });
      if (res.status === 404 || res.status === 400) {
        const text = await res.text();
        if (/UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/i.test(text)) dead.push(token);
      }
    }),
  );
  return dead;
}

async function sendExpo(tokens: string[], row: NotificationRow) {
  const messages = tokens.map((to) => ({
    to,
    title: row.title,
    body: row.body,
    sound: 'default',
    channelId: 'matches',
    data: { match_id: row.match_id, kind: row.kind },
  }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = await req.json();
  const row = payload?.record as NotificationRow | undefined;
  if (payload?.type !== 'INSERT' || !row?.user_id) return new Response('ignored', { status: 200 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.from('push_tokens').select('token, platform').eq('user_id', row.user_id);
  if (error) return new Response(error.message, { status: 500 });
  const all = (data ?? []).map((t) => t.token as string);
  const expo = all.filter((t) => t.startsWith('ExponentPushToken['));
  const fcm = all.filter((t) => !t.startsWith('ExponentPushToken['));
  if (!all.length) return new Response('no tokens', { status: 200 });

  try {
    if (expo.length) await sendExpo(expo, row);
    const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (fcm.length && raw) {
      const dead = await sendFcm(JSON.parse(raw) as ServiceAccount, fcm, row);
      if (dead.length) await sb.from('push_tokens').delete().eq('user_id', row.user_id).in('token', dead);
    }
  } catch (e) {
    return new Response(String(e), { status: 502 });
  }
  return new Response('sent', { status: 200 });
});
