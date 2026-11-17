import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { dismissToday, firstVisible, type Dismissed } from '../lib/adDismiss';
import { useSession } from '../lib/session';
import { shareInvite } from '../lib/share';
import type { Ad } from '../lib/types';
import { AdBanner } from './AdBanner';

const KEY = 'balmalaab-ad-dismissed';

/**
 * إعلان واحد بالمرة، بدون تبديل تلقائي، ويّا زر ✕.
 * اللي يسكّره اللاعب ما يرجع يطلعله لحد باجر، ويطلع اللي بعده (إذا أكو).
 * التمرير للصفحة اللي يبدي من الإعلان ما ينحسب ضغطة.
 */
export function AdSingle({ ads, now }: { ads: Ad[]; now: number }) {
  const router = useRouter();
  const { profile } = useSession();
  const [dismissed, setDismissed] = useState<Dismissed | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setDismissed(raw ? (JSON.parse(raw) as Dismissed) : {}))
      .catch(() => alive && setDismissed({}));
    return () => {
      alive = false;
    };
  }, []);

  if (!dismissed) return null;
  const ad = firstVisible(ads, dismissed, new Date(now));
  if (!ad) return null;

  const close = () => {
    const next = dismissToday(dismissed, ad.id, new Date());
    setDismissed(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };
  const moved = (e: GestureResponderEvent) => !start || Math.hypot(e.nativeEvent.pageX - start.x, e.nativeEvent.pageY - start.y) > 10;
  const open = () => {
    if (!ad.link) return;
    if (ad.link === 'share:invite') void shareInvite(profile?.public_id);
    else router.push(ad.link as Href);
  };

  return (
    <View>
      <AdBanner
        ad={ad}
        now={now}
        onPressIn={(e) => setStart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
        onPress={ad.link ? (e) => !moved(e) && open() : undefined}
      />
      <Pressable
        onPress={close}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="سكّر الإعلان"
        style={{ position: 'absolute', top: 7, left: 46, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}
