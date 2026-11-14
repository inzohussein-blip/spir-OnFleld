import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { fonts, useColors } from '../theme';
import { Text } from './ui';

/** تعهّد القائد: يتحمّل مبلغ أي لاعب من الفريق ما يحضر */
export function CaptainPledge({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primarySoft, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: value ? c.primary : c.border }}
    >
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={24} color={c.primary} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold, lineHeight: 24 }}>أتحمّل دفع مبلغ أي لاعب من الفريق ما يحضر</Text>
    </Pressable>
  );
}
