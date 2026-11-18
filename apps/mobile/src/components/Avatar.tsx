import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, useColors } from '../theme';
import { Text } from './ui';

/** صورة اللاعب إن وجدت، وإلا الحرف الأول من اسمه */
export function Avatar({ name, url, size = 44, ring, style }: { name: string; url?: string | null; size?: number; ring?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(ring ? { borderWidth: Math.max(2, size / 20), borderColor: ring } : null),
  };
  return (
    <View style={[box, style]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`صورة ${name}`} />
      ) : (
        <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.42, lineHeight: size * 0.6, color: '#fff' }}>{name.trim().slice(0, 1) || '؟'}</Text>
      )}
    </View>
  );
}
