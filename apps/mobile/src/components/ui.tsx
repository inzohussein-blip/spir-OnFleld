import { Ionicons } from '@expo/vector-icons';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { toWesternDigits } from '../lib/format';
import { fonts, radius, themed, useColors } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = 'body' | 'title' | 'h2' | 'muted' | 'small';

/** كل النصوص تُعرض بالأرقام 1,2,3 حتى لو أدخلها المستخدم بأرقام عربية-هندية */
const western = (ch: ReactNode): ReactNode => (typeof ch === 'string' ? toWesternDigits(ch) : ch);

export function Text({ variant = 'body', style, children, ...rest }: TextProps & { variant?: Variant }) {
  const s = useStyles();
  const parts = Array.isArray(children) ? children.map(western) : [western(children)];
  // تمرير الأبناء كوسائط منفصلة يحافظ على سلوك JSX (بدون الحاجة لمفاتيح)
  return createElement(RNText, { ...rest, style: [s.base, s[variant], style] }, ...parts);
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.primary} />;
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  if (!scroll) return <View style={[s.screen, s.screenPad, style]}>{children}</View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const s = useStyles();
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const c = useColors();
  const box = { primary: s.btnPrimary, outline: s.btnOutline, danger: s.btnDanger, ghost: s.btnGhost }[variant];
  const fg = { primary: c.onPrimary, outline: c.primary, danger: c.danger, ghost: c.primary }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, box, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.btnInner}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const s = useStyles();
  const c = useColors();
  const { label, style, onChangeText, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="small">{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...rest}
        onChangeText={onChangeText ? (v) => onChangeText(toWesternDigits(v)) : undefined}
        style={[s.input, style]}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, style }: { label: string; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive, style]}>
      <Text variant="small" style={{ color: active ? c.onPrimary : c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** تبويبات علوية (Segmented) */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  const s = useStyles();
  const c = useColors();
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segmentItem, active && s.segmentActive]}>
            {o.icon ? <Ionicons name={o.icon} size={16} color={active ? c.onPrimary : c.muted} /> : null}
            <Text variant="small" style={{ color: active ? c.onPrimary : c.muted, fontFamily: fonts.semibold }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'yellow' | 'red' | 'gray' }) {
  const c = useColors();
  const s = useStyles();
  const t = {
    green: { bg: c.primarySoft, fg: c.primary },
    yellow: { bg: c.warnSoft, fg: c.warnText },
    red: { bg: c.dangerSoft, fg: c.danger },
    gray: { bg: c.cardAlt, fg: c.muted },
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text variant="small" style={{ color: t.fg, fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.row, style]}>{children}</View>;
}

/** عنوان قسم مع خط جانبي ووصف */
export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <View style={s.sectionBar} />
      <View style={{ flex: 1 }}>
        <Text variant="h2">{title}</Text>
        {hint ? <Text variant="small" style={s.mutedText}>{hint}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** مربع إحصائية صغير */
export function StatTile({ label, value, icon, tone = 'green' }: { label: string; value: string | number; icon?: IconName; tone?: 'green' | 'yellow' | 'red' | 'blue' }) {
  const s = useStyles();
  const c = useColors();
  const fg = { green: c.primary, yellow: c.accent, red: c.danger, blue: c.teamA }[tone];
  return (
    <View style={s.stat}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={s.statValue}>{value}</Text>
      <Text variant="small" style={s.mutedText}>{label}</Text>
    </View>
  );
}

/** صف إعدادات بأيقونة */
export function ListItem({ icon, title, subtitle, onPress, right }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode }) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress && !right} style={({ pressed }) => [s.listItem, pressed && { opacity: 0.7 }]}>
      <View style={s.listIcon}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{title}</Text>
        {subtitle ? <Text variant="small" style={s.mutedText}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-back" size={18} color={c.muted} /> : null)}
    </Pressable>
  );
}

export function Loading() {
  const s = useStyles();
  const c = useColors();
  return (
    <View style={[s.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export function Empty({ title, hint, icon = 'football-outline' }: { title: string; hint?: string; icon?: IconName }) {
  const s = useStyles();
  const c = useColors();
  return (
    <View style={[s.center, { paddingVertical: 40 }]}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={32} color={c.primary} />
      </View>
      <Text variant="h2" style={{ textAlign: 'center' }}>{title}</Text>
      {hint ? <Text variant="muted" style={{ textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const s = useStyles();
  const c = useColors();
  if (!message) return null;
  return (
    <View style={s.error}>
      <Text style={{ color: c.danger }}>{message}</Text>
    </View>
  );
}

/** شريط تقدّم عدد اللاعبين */
export function Progress({ value, max }: { value: number; max: number }) {
  const s = useStyles();
  const c = useColors();
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? c.accent : c.primary }]} />
    </View>
  );
}

export const useStyles = themed((c) => ({
  base: { fontFamily: fonts.regular, color: c.text, fontSize: 15 },
  body: {},
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36 },
  h2: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28 },
  muted: { color: c.muted, fontSize: 14 },
  small: { fontSize: 13 },
  mutedText: { color: c.muted },
  screen: { flex: 1, backgroundColor: c.bg },
  screenPad: { padding: 16, gap: 12, paddingBottom: 120 }, // مساحة للشريط السفلي العائم
  card: { backgroundColor: c.card, borderRadius: radius, padding: 14, gap: 8, borderWidth: 1, borderColor: c.border },
  btn: { minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnPrimary: { backgroundColor: c.primary },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  btnDanger: { backgroundColor: c.dangerSoft },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  input: {
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.text,
    outlineWidth: 0,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  segment: { flexDirection: 'row', backgroundColor: c.card, borderRadius: radius, padding: 4, gap: 4, borderWidth: 1, borderColor: c.border },
  segmentItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius - 4 },
  segmentActive: { backgroundColor: c.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  section: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  sectionBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.primary },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: radius, padding: 12, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: c.border },
  statValue: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  error: { backgroundColor: c.dangerSoft, borderRadius: radius, padding: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
}));
