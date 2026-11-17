import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { type GestureResponderEvent } from 'react-native';
import { useSession } from '../lib/session';
import { shareInvite } from '../lib/share';
import type { Ad } from '../lib/types';
import { AdBanner } from './AdBanner';

/**
 * إعلان واحد بالمرة (الأول بالترتيب)، بدون تبديل تلقائي وبدون زر إغلاق.
 * التمرير للصفحة اللي يبدي من الإعلان ما ينحسب ضغطة.
 */
export function AdSingle({ ads, now }: { ads: Ad[]; now: number }) {
  const router = useRouter();
  const { profile } = useSession();
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const ad = ads[0];
  if (!ad) return null;

  const moved = (e: GestureResponderEvent) => !start || Math.hypot(e.nativeEvent.pageX - start.x, e.nativeEvent.pageY - start.y) > 10;
  const open = () => {
    if (!ad.link) return;
    if (ad.link === 'share:invite') void shareInvite(profile?.public_id);
    else router.push(ad.link as Href);
  };

  return (
    <AdBanner
      ad={ad}
      now={now}
      onPressIn={(e) => setStart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
      onPress={ad.link ? (e) => !moved(e) && open() : undefined}
    />
  );
}
