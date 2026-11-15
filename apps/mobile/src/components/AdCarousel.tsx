import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { shareInvite } from '../lib/share';
import { useSession } from '../lib/session';
import type { Ad } from '../lib/types';
import { themed } from '../theme';
import { AdBanner } from './AdBanner';

const ROTATE_MS = 5000;

/** شريط الإعلانات: إعلان واحد بالمرة، يتبدل وحده كل 5 ثواني، ويتسحب يمين ويسار، ونقاط تحته */
export function AdCarousel({ ads, now }: { ads: Ad[]; now: number }) {
  const st = useStyles();
  const router = useRouter();
  const { profile } = useSession();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startXRef = useRef<number | null>(null);
  const count = ads.length;
  const current = count ? ads[index % count] : null;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (!current) return null;

  const open = (ad: Ad) => {
    if (!ad.link) return;
    if (ad.link === 'share:invite') void shareInvite(profile?.public_id);
    else router.push(ad.link as Href);
  };

  return (
    <View>
      <View
        onTouchStart={(e) => {
          startXRef.current = e.nativeEvent.pageX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          const dx = startXRef.current === null ? 0 : e.nativeEvent.pageX - startXRef.current;
          startXRef.current = null;
          setPaused(false);
          // السحب لليسار = اللي بعده (اتجاه القراءة من اليمين)
          if (Math.abs(dx) > 40) setIndex((i) => (i + (dx < 0 ? 1 : -1) + count) % count);
        }}
      >
        <AdBanner key={current.id} ad={current} now={now} onPress={current.link ? () => open(current) : undefined} />
      </View>
      {count > 1 ? (
        <View style={st.dots}>
          {ads.map((a, i) => (
            <Pressable key={a.id} onPress={() => setIndex(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`الإعلان ${i + 1}`} accessibilityState={{ selected: i === index % count }}>
              <View style={[st.dot, i === index % count && st.dotOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed((c) => ({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotOn: { width: 18, backgroundColor: c.primary },
}));
