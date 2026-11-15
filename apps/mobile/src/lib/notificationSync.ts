import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * إشعارات على التلفون بدون Firebase:
 * التطبيق يفحص إشعاراته من الخادم (مكان انفتح، مباراة بيومك المفضل، رجل المباراة…)
 * - لما يكون مفتوح: كل دقيقة
 * - لما يكون مسكّر: مهمة بالخلفية كل ~15 دقيقة (النظام يحدد الوقت بالضبط)
 * والجديد منها يطلع كإشعار على الشاشة. كل إشعار يطلع مرة وحدة بس.
 */
const TASK = 'balmalaab-notifications';
const SEEN = 'balmalaab-seen-notifications';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

/** يختار الإشعارات الجديدة اللي ما طلعت قبل (بحد أقصى 5 بالمرة) */
export function freshNotifications<T extends { id: string; read: boolean }>(list: T[], seen: Set<string>): T[] {
  return list.filter((n) => !n.read && !seen.has(n.id)).slice(0, 5);
}

export async function syncNotifications(): Promise<number> {
  if (!supported) return 0;
  const list = await api.listNotifications();
  const raw = await AsyncStorage.getItem(SEEN);
  // أول مرة: كل القديم ينحسب «شايفه» حتى ما تطلع دفعة إشعارات قديمة
  if (raw === null) {
    await AsyncStorage.setItem(SEEN, JSON.stringify(list.slice(0, 300).map((n) => n.id)));
    return 0;
  }
  const seen = new Set<string>(JSON.parse(raw) as string[]);
  const fresh = freshNotifications(list, seen);
  if (!fresh.length) return 0;
  const perm = await Notifications.getPermissionsAsync();
  for (const n of fresh) {
    seen.add(n.id);
    if (perm.granted) {
      await Notifications.scheduleNotificationAsync({ content: { title: n.title, body: n.body, data: { match_id: n.match_id } }, trigger: null });
    }
  }
  await AsyncStorage.setItem(SEEN, JSON.stringify([...seen].slice(-300)));
  return fresh.length;
}

if (supported) {
  TaskManager.defineTask(TASK, async () => {
    try {
      await syncNotifications();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** يسجّل الفحص بالخلفية (مرة وحدة) */
export async function registerBackgroundSync() {
  if (!supported) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {
    /* بعض الأجهزة تمنع المهام بالخلفية — يبقى الفحص لما التطبيق مفتوح */
  }
}
