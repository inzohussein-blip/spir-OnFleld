import { Ionicons } from '@expo/vector-icons';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { createElement, useCallback, type ComponentProps, type ReactNode } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toWesternDigits } from '../lib/format';
import { cardRadius, fonts, radius, space, themed, type, useColors, useTheme } from '../theme';

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

/**
 * رأس الأقسام الرئيسية: شريط غامق بتوهّج برتقالي وزوايا سفلية دائرية،
 * عنوان أبيض كبير وسطر صغير تحته، وأزرار أيقونات على الطرف. نفس الشكل بكل التبويبات.
 */
export function PageHeader({ title, subtitle, actions, eyebrow, children }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string; children?: ReactNode }) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  // الرأس غامق: أرقام الساعة والبطارية بيضاء، وترجع مثل ما جانت لما نطلع
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  return (
    <View style={[s.band, { paddingTop: insets.top + space.md }]}>
      <View style={s.glow} pointerEvents="none" />
      <View style={s.bandRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <Text style={s.bandEyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
          <Text style={s.bandTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.bandSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {actions ? <View style={s.pageActions}>{actions}</View> : null}
      </View>
      {children}
    </View>
  );
}

/** زر أيقونة دائري بحجم ثابت (44) — `onBand` للزر فوق الرأس الغامق، مع نقطة تنبيه اختيارية */
export function IconButton({ icon, onPress, label, dot, disabled, onBand }: { icon: IconName; onPress: () => void; label: string; dot?: boolean; disabled?: boolean; onBand?: boolean }) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.iconBtn, onBand && s.iconBtnBand, disabled && { opacity: 0.35 }, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={21} color={onBand ? '#FFFFFF' : c.primary} />
      {dot ? <View style={[s.iconDot, onBand && { borderColor: 'transparent' }]} /> : null}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const s = useStyles();
  const c = useColors();
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { backgroundColor: c.cardAlt }, style]}>
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
      style={({ pressed }) => [s.btn, box, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85 }, style]}
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
    <View style={{ gap: space.xs + 2 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...rest}
        onChangeText={onChangeText ? (v) => onChangeText(toWesternDigits(v)) : undefined}
        style={[s.input, style]}
      />
    </View>
  );
}

/** حقل بحث بأيقونة وزر مسح — نفس الشكل وين ما ينستخدم */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const s = useStyles();
  const c = useColors();
  return (
    <View style={s.search}>
      <Ionicons name="search" size={20} color={c.primary} />
      <TextInput
        value={value}
        onChangeText={(v) => onChange(toWesternDigits(v))}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        style={s.searchInput}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="مسح البحث">
          <Ionicons name="close-circle" size={19} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress, style, icon }: { label: string; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const s = useStyles();
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive, style]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {icon ? <Ionicons name={icon} size={15} color={active ? c.onPrimary : c.text} /> : null}
      <Text style={[s.chipText, { color: active ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

/** تبويبات علوية (Segmented) */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  const s = useStyles();
  const c = useColors();
  return (
    <View style={s.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segmentItem, active && s.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            {o.icon ? <Ionicons name={o.icon} size={16} color={active ? c.onPrimary : c.muted} /> : null}
            <Text style={[s.segmentText, { color: active ? c.onPrimary : c.muted }]}>{o.label}</Text>
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
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.row, style]}>{children}</View>;
}

/** عنوان قسم: نص عريض صغير ووصف اختياري، وزر على الطرف */
export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
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
      <Text style={s.sectionHint}>{label}</Text>
    </View>
  );
}

/**
 * مجموعة أسطر داخل بطاقة واحدة بفواصل رفيعة (مثل إعدادات الهاتف).
 * الفاصل هو فراغ 1px يبين منه لون الإطار — كل سطر خلفيته لون البطاقة.
 */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={{ gap: space.sm }}>
      {title ? <Text style={s.groupTitle}>{title}</Text> : null}
      <View style={s.group}>{children}</View>
    </View>
  );
}

/** سطر داخل ListGroup: أيقونة، عنوان، ووصف أو قيمة على الطرف */
export function ListRow({ icon, title, subtitle, onPress, right, danger, chevron = true }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; chevron?: boolean }) {
  const s = useStyles();
  const c = useColors();
  const fg = danger ? c.danger : c.text;
  const content = (
    <>
      {icon ? (
        <View style={[s.listIcon, danger && { backgroundColor: c.dangerSoft }]}>
          <Ionicons name={icon} size={19} color={danger ? c.danger : c.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.listTitle, { color: fg }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.sectionHint} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <Ionicons name="chevron-back" size={18} color={c.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={s.listRow}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.listRow, pressed && { backgroundColor: c.cardAlt }]} accessibilityRole="button" accessibilityLabel={title}>
      {content}
    </Pressable>
  );
}

/** للتوافق مع الصفحات القديمة: سطر بأيقونة بدون مجموعة */
export function ListItem(props: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode }) {
  return <ListRow {...props} />;
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
    <View style={[s.center, { paddingVertical: space.xxl }]}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={28} color={c.muted} />
      </View>
      <Text style={[s.sectionTitle, { textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[s.sectionHint, { textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const s = useStyles();
  const c = useColors();
  if (!message) return null;
  return (
    <View style={s.error} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={c.danger} />
      <Text style={{ color: c.danger, flex: 1 }}>{message}</Text>
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
  title: { ...type.title },
  h2: { ...type.headline },
  muted: { color: c.muted, fontSize: 14 },
  small: { fontSize: 13 },
  mutedText: { color: c.muted },
  screen: { flex: 1, backgroundColor: c.bg },
  screenPad: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  band: { backgroundColor: c.bandBg, backgroundImage: c.bandGradient, paddingHorizontal: space.lg, paddingBottom: space.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', gap: space.md },
  // توهّج الغروب: تدرّج ناعم من الزاوية بدل دوائر
  glow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundImage: 'linear-gradient(215deg, rgba(255,106,0,0.34) 0%, rgba(232,23,59,0.16) 45%, rgba(232,23,59,0) 80%)' },
  bandRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  bandEyebrow: { ...type.caption, color: 'rgba(255,255,255,0.75)' },
  bandTitle: { ...type.largeTitle, color: '#FFFFFF' },
  bandSubtitle: { ...type.caption, color: 'rgba(255,255,255,0.8)', marginTop: -4 },
  pageActions: { flexDirection: 'row', gap: space.sm, paddingBottom: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnBand: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.12)' },
  iconDot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF5A5F', borderWidth: 2, borderColor: c.card },
  card: { backgroundColor: c.card, borderRadius: cardRadius, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: c.border },
  btn: { minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btnPrimary: { backgroundColor: c.primary, backgroundImage: c.primaryGradient },
  btnOutline: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.primary },
  btnDanger: { backgroundColor: c.dangerSoft },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { ...type.headline, fontSize: 15 },
  fieldLabel: { ...type.label, color: c.muted },
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, backgroundColor: c.card, borderRadius: radius, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 46, fontFamily: fonts.regular, fontSize: 15, color: c.text, outlineWidth: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipActive: { backgroundColor: c.primary, backgroundImage: c.primaryGradient, borderColor: 'transparent' },
  chipText: { ...type.label, fontSize: 13 },
  segment: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: radius, padding: 3, gap: 3 },
  segmentItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: radius - 3 },
  segmentActive: { backgroundColor: c.primary, backgroundImage: c.primaryGradient },
  segmentText: { ...type.label, fontSize: 13 },
  badge: { paddingHorizontal: 10, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { ...type.micro, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  sectionTitle: { ...type.headline },
  sectionHint: { ...type.caption, color: c.muted },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: cardRadius, padding: space.md, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: c.border },
  statValue: { ...type.title },
  groupTitle: { ...type.label, color: c.muted, paddingHorizontal: space.xs },
  group: { backgroundColor: c.border, borderRadius: cardRadius, borderWidth: 1, borderColor: c.border, overflow: 'hidden', gap: 1 },
  listRow: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
  listIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listTitle: { ...type.body },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.dangerSoft, borderRadius: radius, padding: space.md },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
}));
