import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, themed } from '../theme';
import { Text } from './ui';

/** رأس الصفحات: شريط أزرق ملكي بزوايا سفلية دائرية، عنوان أبيض وسطر صغير تحته (أو محتوى مخصص) */
export function HeaderBand({ title, subtitle, children }: { title?: string; subtitle?: string; children?: ReactNode }) {
  const st = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.band, { paddingTop: insets.top + 14 }]}>
      {children ?? (
        <>
          <Text style={st.title}>{title}</Text>
          {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
        </>
      )}
    </View>
  );
}

/** لون الكتابة فوق الرأس */
export const ON_BAND = '#FFFFFF';
export const ON_BAND_MUTED = 'rgba(255,255,255,0.85)';

const useStyles = themed((c) => ({
  band: {
    backgroundColor: c.bandBg,
    backgroundImage: c.bandGradient,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 18,
    alignItems: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 32, color: ON_BAND },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 22, color: ON_BAND_MUTED },
}));
