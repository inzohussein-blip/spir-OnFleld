import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { formatClock } from './format';
import { joinAlertPlan } from './schedule';
import type { Match } from './types';

/**
 * الإشعارات:
 * - محلية (تعمل فوراً بدون خادم): تذكير قبل المباراة بساعتين، وتنبيه عند فتح التسجيل.
 * - من الخادم (دخلت من قائمة الانتظار…): تحتاج ربط التطبيق بمشروع EAS/Firebase — انظر README.
 */
const supported = Platform.OS === 'android' || Platform.OS === 'ios';
const KEY = 'balmalaab-scheduled';

type Scheduled = Record<string, string>; // مفتاح منطقي ← معرّف الإشعار المجدول

async function readScheduled(): Promise<Scheduled> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Scheduled;
  } catch {
    return {};
  }
}
async function writeScheduled(s: Scheduled) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
}

let configured = false;
export async function setupNotifications() {
  if (!supported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('matches', {
      name: 'المباريات',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** `date` = null: يطلع فوراً */
async function scheduleAt(key: string, date: Date | null, title: string, body: string, matchId: string) {
  if (!(await ensurePermission())) return false;
  const scheduled = await readScheduled();
  if (scheduled[key]) await Notifications.cancelScheduledNotificationAsync(scheduled[key]).catch(() => {});
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { match_id: matchId } },
    trigger: date ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'matches' } : { channelId: 'matches' },
  });
  scheduled[key] = id;
  await writeScheduled(scheduled);
  return true;
}

async function cancel(key: string) {
  if (!supported) return;
  const scheduled = await readScheduled();
  if (!scheduled[key]) return;
  await Notifications.cancelScheduledNotificationAsync(scheduled[key]).catch(() => {});
  delete scheduled[key];
  await writeScheduled(scheduled);
}

/** كلمات تزيد الحماس — وحدة عشوائية بكل إشعار */
const HYPE = ['جهّز جزمتك وتعال نار 🔥⚽', 'اليوم يومك يا بطل 💪🔥', 'الملعب علينا واللعب عليك 😎⚽', 'خلّي الكل يحچي عن لعبك 🏆🔥', 'دفّي عضلاتك وتعال جاهز ⚡⚽'];
const hype = () => HYPE[Math.floor(Math.random() * HYPE.length)];
const SERVER_PUSH_KEY = 'balmalaab-server-push';

/**
 * بعد الانضمام:
 * - «تم الحجز ✅» بعد نص ساعة (أو فوراً إذا المباراة أقرب من نص ساعة) ويّا «تعال قبل ربع ساعة».
 * - تذكير قبل المباراة بساعة بكلمة حماس — إلا إذا الخادم يدز التذكير (إشعارات الخادم مفعّلة).
 */
export async function scheduleMatchReminder(m: Match) {
  const plan = joinAlertPlan(m.starts_at, Date.now());
  if (!plan) return false;
  const venue = m.venue_name ?? 'المباراة';
  const clock = formatClock(m.starts_at);
  const confirmed = await scheduleAt(
    `confirm:${m.id}`,
    plan.soon ? null : new Date(plan.confirmAt),
    plan.soon ? 'تم الحجز ✅ مباراتك قريبة!' : 'تم الحجز ✅ مكانك محجوز',
    plan.soon
      ? `${venue} — الساعة ${clock}. تحرّك هسه وكون بالملعب قبل ربع ساعة ⏱️ ${hype()}`
      : `${venue} — الساعة ${clock}. لازم تكون بالملعب قبل ربع ساعة من البداية ⏱️ ${hype()}`,
    m.id,
  );
  const serverReminds = (await AsyncStorage.getItem(SERVER_PUSH_KEY).catch(() => null)) === '1';
  if (plan.reminderAt && !serverReminds) {
    await scheduleAt(`reminder:${m.id}`, new Date(plan.reminderAt), 'مباراتك بعد ساعة ⚽🔥', `${venue} — الساعة ${clock}. تعال قبل ربع ساعة. ${hype()}`, m.id);
  }
  return confirmed;
}

export async function cancelMatchReminder(matchId: string) {
  await cancel(`confirm:${matchId}`);
  await cancel(`reminder:${matchId}`);
}

/** «ذكّرني عند فتح التسجيل» */
export async function scheduleRegistrationAlert(m: Match) {
  if (!m.registration_opens_at) return false;
  const at = new Date(m.registration_opens_at);
  if (at.getTime() <= Date.now()) return false;
  return scheduleAt(`regopen:${m.id}`, at, 'فتح التسجيل! 🔔', `سجّل هسه بمباراة ${m.venue_name ?? ''} قبل ما يكتمل العدد`, m.id);
}

export async function hasRegistrationAlert(matchId: string) {
  return !!(await readScheduled())[`regopen:${matchId}`];
}

export const notificationsSupported = supported;

/**
 * تسجيل الجهاز لإشعارات الخادم («انفتح التسجيل»، «باقي مكان واحد»، «مباراتك بعد ساعة»...):
 * - إذا التطبيق مربوط بمشروع EAS ← رمز Expo
 * - غير ذلك بالأندرويد ← رمز Firebase مباشر (يحتاج google-services.json وقت البناء)
 * بدون أي إعداد ما يطلع رمز، والتذكيرات المحلية تبقى تشتغل.
 */
export async function registerForPush() {
  if (!supported) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId && Platform.OS !== 'android') return;
  try {
    if (!(await ensurePermission())) return;
    const token = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : String((await Notifications.getDevicePushTokenAsync()).data);
    if (token) {
      await api.savePushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
      // الخادم صار يدز «مباراتك بعد ساعة» — ما نكرره محلياً
      if (!api.isDemo) await AsyncStorage.setItem(SERVER_PUSH_KEY, '1').catch(() => {});
    }
  } catch {
    /* بدون إعداد Firebase ما يتوفر رمز — الإشعارات المحلية تبقى تعمل */
  }
}
