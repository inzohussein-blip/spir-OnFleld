import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SkeletonList } from '../components/feedback';
import { Empty, Text, type IconName } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAsync } from '../lib/session';
import type { NotificationKind } from '../lib/types';
import { fonts, themed, useColors } from '../theme';

const ICON: Record<NotificationKind, IconName> = {
  promoted: 'checkmark-circle',
  registration_open: 'notifications',
  match_created: 'football',
  suggestion: 'bulb',
  reminder: 'alarm',
  general: 'information-circle',
  spot_opened: 'flash',
  fav_day: 'calendar',
  motm: 'medal',
  referral: 'gift',
  no_show: 'wallet',
};

/** مركز الإشعارات: كل جديد يخص اللاعب، وتُعلَّم كمقروءة عند الفتح */
export default function NotificationsScreen() {
  const router = useRouter();
  const c = useColors();
  const st = useStyles();
  const { data, loading, refreshing, reload } = useAsync(() => api.listNotifications(), []);
  useFocusEffect(
    useCallback(() => {
      // نقرأ القائمة أولاً (حتى تبين الجديدة مميزة) ثم نعلّمها مقروءة
      void reload().then(() => api.markNotificationsRead().catch(() => {}));
    }, [reload]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
    >
      <Pressable onPress={() => router.push('/chats')} style={st.chats}>
        <Ionicons name="chatbubbles-outline" size={22} color={c.primary} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold }}>المحادثات والتبليغات</Text>
        <Ionicons name="chevron-back" size={18} color={c.muted} />
      </Pressable>
      <FavDays />
      {loading && !data ? <SkeletonList count={3} height={80} /> : null}
      {data && data.length === 0 ? <Empty title="ماكو إشعارات" hint="راح نبلّغك هنا بكل جديد يخص مبارياتك" icon="notifications-outline" /> : null}
      {data?.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => (n.match_id ? router.push({ pathname: '/match/[id]', params: { id: n.match_id } }) : undefined)}
          style={[st.item, !n.read && st.unread]}
        >
          <View style={st.icon}>
            <Ionicons name={ICON[n.kind]} size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold }}>{n.title}</Text>
            {n.body ? <Text variant="small" style={{ color: c.muted, lineHeight: 20 }}>{n.body}</Text> : null}
            <Text variant="small" style={{ color: c.muted, fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
          </View>
          {!n.read ? <View style={st.dot} /> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** الأسبوع يبدأ من السبت (getDay: 6 = السبت) */
const WEEK: [number, string][] = [
  [6, 'السبت'],
  [0, 'الأحد'],
  [1, 'الاثنين'],
  [2, 'الثلاثاء'],
  [3, 'الأربعاء'],
  [4, 'الخميس'],
  [5, 'الجمعة'],
];

/** أيامي المفضلة: إشعار لما تنزل مباراة جديدة بيوم منها (بمدينتي) */
function FavDays() {
  const c = useColors();
  const st = useStyles();
  const { data, reload } = useAsync(() => api.getFavDays(), []);
  const [saving, setSaving] = useState(false);
  const days = data ?? [];
  const toggle = async (d: number) => {
    setSaving(true);
    try {
      await api.setFavDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
      await reload();
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={st.fav}>
      <Text style={{ fontFamily: fonts.bold }}>نبّهني لما تنزل مباراة جديدة بأيام:</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {WEEK.map(([d, label]) => {
          const on = days.includes(d);
          return (
            <Pressable key={d} disabled={saving} onPress={() => void toggle(d)} style={[st.favChip, on && { backgroundColor: c.primary, borderColor: c.primary }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text variant="small" style={{ color: on ? '#fff' : c.text, fontFamily: on ? fonts.bold : fonts.regular }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="small" style={{ color: c.muted }}>{days.length ? 'راح نبلّغك بكل مباراة جديدة بهالأيام.' : 'اختار يوم أو أكثر.'}</Text>
    </View>
  );
}

const useStyles = themed((c) => ({
  fav: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 },
  favChip: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: c.bg },
  chats: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14 },
  unread: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, marginTop: 6 },
}));
