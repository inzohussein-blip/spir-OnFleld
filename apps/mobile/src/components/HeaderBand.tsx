import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, themed } from '../theme';
import { Text } from './ui';

/** رأس بسيط: شريط ملوّن بزوايا سفلية دائرية وعنوان في الوسط (أو محتوى مخصص) */
export function HeaderBand({ title, children }: { title?: string; children?: ReactNode }) {
  const st = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.band, { paddingTop: insets.top + 14 }]}>
      {children ?? <Text style={st.title}>{title}</Text>}
    </View>
  );
}

const useStyles = themed((c) => ({
  band: {
    backgroundColor: c.bandBg,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 18,
    alignItems: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 32, color: c.text },
}));
