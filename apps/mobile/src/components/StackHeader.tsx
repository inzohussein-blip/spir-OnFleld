import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, fromLeft, themed, wideSpaces } from '../theme';
import { Halftone, Text } from './ui';

type HeaderProps = {
  options: { title?: string; headerRight?: (p: { tintColor?: string; canGoBack: boolean }) => ReactNode };
  back?: unknown;
  navigation: { goBack: () => void };
};

/**
 * رأس الصفحات الداخلية «ملكي»: أزرق بنقاط القمصان وشريطين أصفر مايلين على الطرف،
 * زر رجوع أبيض، عنوان كوفي، وخط أصفر تحت. نفس هوية رؤوس التبويبات بحجم أصغر.
 */
export function StackHeader({ options, back, navigation }: HeaderProps) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const title = options.title ?? '';
  const goBack = () => (back || router.canGoBack() ? navigation.goBack() : router.replace('/'));
  return (
    <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
      <Halftone rows={5} cols={9} style={{ top: insets.top + 6, ...fromLeft(6) }} />
      <View style={s.stripeWide} pointerEvents="none" />
      <View style={s.stripeThin} pointerEvents="none" />
      <View style={s.row}>
        <Pressable onPress={goBack} style={({ pressed }) => [s.back, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={6}>
          <Ionicons name="chevron-forward" size={20} color="#0B1033" />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{wideSpaces(title)}</Text>
        {options.headerRight ? <View>{options.headerRight({ tintColor: '#FFFFFF', canGoBack: !!back })}</View> : null}
      </View>
    </View>
  );
}

const useStyles = themed((c) => ({
  bar: { backgroundColor: c.bandBg, paddingHorizontal: 14, paddingBottom: 12, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: c.cta },
  stripeWide: { position: 'absolute', top: -20, bottom: -20, ...fromLeft(-30), width: 64, backgroundColor: c.cta, transform: [{ skewX: '-14deg' }] },
  stripeThin: { position: 'absolute', top: -20, bottom: -20, ...fromLeft(46), width: 10, backgroundColor: c.cta, transform: [{ skewX: '-14deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingEnd: 96 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 #0B1033' },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 21, lineHeight: 32, color: '#FFFFFF' },
}));
