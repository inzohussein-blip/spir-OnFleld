import { Ionicons } from '@expo/vector-icons';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, themed, useColors } from '../theme';
import { Text } from './ui';

// ---------- رسالة سفلية مؤقتة مع زر «تراجع» ----------
interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** المدة بالمللي ثانية (افتراضياً 5 ثوانٍ) */
  duration?: number;
}
interface ToastState extends ToastOptions {
  id: number;
  message: string;
}
const ToastContext = createContext<(message: string, opts?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const show = useCallback((message: string, opts?: ToastOptions) => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, ...opts });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), toast.duration ?? 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      {toast ? <ToastView toast={toast} onClose={() => setToast(null)} /> : null}
    </ToastContext>
  );
}

function ToastView({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const st = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.toastWrap, { bottom: insets.bottom + 100 }]} pointerEvents="box-none">
      <View style={st.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={st.toastText}>{toast.message}</Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              onClose();
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={st.toastAction}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const useToast = () => use(ToastContext);

// ---------- هياكل التحميل الرمادية ----------
export function SkeletonCard({ height = 130 }: { height?: number }) {
  const st = useStyles();
  return (
    <View style={[st.skeleton, { height }]} accessibilityLabel="جاري التحميل">
      <View style={st.skRow}>
        <View style={st.skThumb} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={[st.skLine, { width: '70%' }]} />
          <View style={[st.skLine, { width: '45%' }]} />
          <View style={[st.skLine, { width: '30%' }]} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3, height }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => `sk-${i}`).map((k) => (
        <SkeletonCard key={k} height={height} />
      ))}
    </>
  );
}

// ---------- تنبيه انقطاع الاتصال ----------
export function OfflineBanner({ show }: { show: boolean }) {
  const st = useStyles();
  const c = useColors();
  if (!show) return null;
  return (
    <View style={st.offline}>
      <Ionicons name="cloud-offline-outline" size={18} color={c.warnText} />
      <Text variant="small" style={{ color: c.warnText, flex: 1 }}>ماكو اتصال — دتشوف آخر بيانات محفوظة</Text>
    </View>
  );
}

const useStyles = themed((c) => ({
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#101828', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, maxWidth: 520, alignSelf: 'stretch', justifyContent: 'space-between' },
  toastText: { color: '#fff', fontFamily: fonts.semibold, flexShrink: 1 },
  toastAction: { color: '#8FB0FF', fontFamily: fonts.bold },
  skeleton: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 14, justifyContent: 'center' },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skThumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: c.cardAlt },
  skLine: { height: 12, borderRadius: 6, backgroundColor: c.cardAlt },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.warnSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
}));
