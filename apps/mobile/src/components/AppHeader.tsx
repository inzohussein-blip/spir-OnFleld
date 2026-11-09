import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { fonts, headerText, themed, useColors } from '../theme';
import { Text } from './ui';

/** شعار «بالملعب» النصي في منتصف الرأس */
export function BrandTitle() {
  const c = useColors();
  const st = useStyles();
  return (
    <View style={st.brand}>
      <Text style={[st.brandText, { color: headerText(c) }]}>بالملعب</Text>
      <View style={st.underline}>
        <View style={[st.seg, { backgroundColor: c.primary }]} />
        <View style={[st.seg, { backgroundColor: c.accent }]} />
        <View style={[st.seg, { backgroundColor: '#2BB673' }]} />
      </View>
    </View>
  );
}

export function HeaderIcon({ icon, onPress, badge }: { icon: 'person-outline' | 'chatbubbles-outline'; onPress: () => void; badge?: boolean }) {
  const c = useColors();
  const st = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={st.iconBtn} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={c.primary} />
      {badge ? <View style={st.dot} /> : null}
    </Pressable>
  );
}

export function useHeaderButtons() {
  const router = useRouter();
  return {
    headerTitle: () => <BrandTitle />,
    headerTitleAlign: 'center' as const,
    headerRight: () => <HeaderIcon icon="person-outline" onPress={() => router.push('/profile')} />,
    headerLeft: () => <HeaderIcon icon="chatbubbles-outline" onPress={() => router.push('/chats')} badge />,
  };
}

const useStyles = themed((c) => ({
  brand: { alignItems: 'center' },
  brandText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, letterSpacing: 0.5 },
  underline: { flexDirection: 'row', gap: 2, marginTop: -2 },
  seg: { width: 16, height: 3, borderRadius: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  dot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
}));
