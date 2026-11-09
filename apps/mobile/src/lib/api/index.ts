import { demoApi } from './demo';
import { createSupabaseApi } from './supabase';
import type { Api } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** إذا لم تُضبط مفاتيح Supabase يعمل التطبيق في الوضع التجريبي */
export const api: Api = url && key ? createSupabaseApi(url, key) : demoApi;

export type { Api, ProfileInput } from './types';
