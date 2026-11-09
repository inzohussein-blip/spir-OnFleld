import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius } from '../theme';

type Variant = 'body' | 'title' | 'h2' | 'muted' | 'small';

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[styles.base, styles[variant], style]} />;
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!scroll) return <View style={[styles.screen, styles.screenPad, style]}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = btn[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, v.box, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color as string} /> : <Text style={[styles.btnText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="small">{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} {...rest} style={[styles.input, style]} />
    </View>
  );
}

export function Chip({ label, active, onPress, style }: { label: string; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive, style]}>
      <Text variant="small" style={[{ color: colors.text }, active && { color: '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'yellow' | 'red' | 'gray' }) {
  const t = {
    green: { bg: colors.primarySoft, fg: colors.primaryDark },
    yellow: { bg: '#FFF4CC', fg: '#7A5B00' },
    red: { bg: colors.dangerSoft, fg: colors.danger },
    gray: { bg: '#ECEFED', fg: colors.muted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text variant="small" style={{ color: t.fg, fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={[styles.center, { paddingVertical: 48 }]}>
      <Text style={{ fontSize: 40 }}>⚽</Text>
      <Text variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {hint ? <Text variant="muted" style={{ textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Text style={{ color: colors.danger }}>{message}</Text>
    </View>
  );
}

/** شريط تقدّم عدد اللاعبين */
export function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? colors.accent : colors.primary }]} />
    </View>
  );
}

const text = (color: string): TextStyle => ({ color });
const btn = {
  primary: { box: { backgroundColor: colors.primary }, text: text('#fff') },
  outline: { box: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }, text: text(colors.primary) },
  danger: { box: { backgroundColor: colors.dangerSoft }, text: text(colors.danger) },
  ghost: { box: { backgroundColor: 'transparent' }, text: text(colors.primary) },
};

const styles = StyleSheet.create({
  base: { fontFamily: fonts.regular, color: colors.text, fontSize: 15 },
  body: {},
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36 },
  h2: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28 },
  muted: { color: colors.muted, fontSize: 14 },
  small: { fontSize: 13 },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  btn: { minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  input: {
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radius, padding: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
});
