import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { formatClock } from './format';
import { reminderAt } from './schedule';
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

async function scheduleAt(key: string, date: Date, title: string, body: string, matchId: string) {
  if (!(await ensurePermission())) return false;
  const scheduled = await readScheduled();
  if (scheduled[key]) await Notifications.cancelScheduledNotificationAsync(scheduled[key]).catch(() => {});
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { match_id: matchId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'matches' },
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

/** بعد الانضمام: تذكير قبل المباراة بساعتين */
export async function scheduleMatchReminder(m: Match) {
  const at = reminderAt(m, Date.now());
  if (!at) return false;
  return scheduleAt(`reminder:${m.id}`, at, 'مباراتك بعد ساعتين ⚽', `${m.venue_name ?? 'المباراة'} — تبدأ ${formatClock(m.starts_at)}`, m.id);
}

export const cancelMatchReminder = (matchId: string) => cancel(`reminder:${matchId}`);

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

/** تسجيل الجهاز لإشعارات الخادم — يعمل فقط بعد ربط التطبيق بمشروع EAS (extra.eas.projectId) */
export async function registerForPush() {
  if (!supported) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return;
  try {
    if (!(await ensurePermission())) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.savePushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    /* بدون إعداد FCM لن يتوفر رمز — الإشعارات المحلية تبقى تعمل */
  }
}
