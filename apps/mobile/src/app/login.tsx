import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, View } from 'react-native';
import mark from '../../assets/splash-icon.png';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText, Halftone, Input, Text } from '../components/ui';
import { api } from '../lib/api';
import { errMsg, useSession } from '../lib/session';
import { fonts, fromLeft, themed, useColors, wideSpaces } from '../theme';

export default function Login() {
  const { refresh } = useSession();
  const colors = useColors();
  const styles = useStyles();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          {/* نفس هوية شاشة التحميل: نقاط القمصان والشريطين الأصفر والشعار */}
          <Halftone rows={24} cols={30} style={{ top: 8, ...fromLeft(8) }} color="rgba(255,255,255,0.10)" />
          <View style={styles.stripeWide} pointerEvents="none" />
          <View style={styles.stripeThin} pointerEvents="none" />
          <Image source={mark} style={styles.logo} accessibilityLabel="شعار بالملعب" />
          <Text style={styles.brand}>{wideSpaces('بالملعب')}</Text>
          <Text style={styles.tagline}>احجز ساحتك، كمّل فريقك، والعب</Text>
        </View>
        <View style={styles.sheet}>
          {step === 'phone' ? (
            <>
              <Text variant="h2">سجّل دخولك برقم الهاتف</Text>
              <Input
                label="رقم الهاتف"
                placeholder="07xx xxx xxxx"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={14}
              />
              <ErrorText message={error} />
              <Button title="إرسال رمز التحقق" loading={busy} onPress={() => run(async () => { await api.sendOtp(phone); setStep('code'); })} />
            </>
          ) : (
            <>
              <Text variant="h2">أدخل الرمز المرسل إلى {phone}</Text>
              <Input label="رمز التحقق" placeholder="••••" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
              <ErrorText message={error} />
              <Button title="تأكيد" loading={busy} onPress={() => run(async () => { await api.verifyOtp(phone, code); await refresh(); })} />
              <Button title="تغيير الرقم" variant="ghost" onPress={() => { setStep('phone'); setCode(''); setError(null); }} />
            </>
          )}
          {api.isDemo ? (
            <View style={styles.demo}>
              <Text variant="small" style={{ color: colors.warnText }}>
                وضع تجريبي: أدخل أي رقم، والرمز هو 1234
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = themed((colors) => ({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  stripeWide: { position: 'absolute', top: -60, bottom: -60, ...fromLeft(-40), width: 90, backgroundColor: colors.cta, transform: [{ skewX: '-14deg' }] },
  stripeThin: { position: 'absolute', top: -60, bottom: -60, ...fromLeft(66), width: 16, backgroundColor: colors.cta, transform: [{ skewX: '-14deg' }] },
  logo: { width: 140, height: 140, marginBottom: -24 },
  brand: { fontFamily: fonts.display, fontSize: 38, color: '#fff', lineHeight: 54 },
  tagline: { color: '#C9CEF5', fontSize: 15 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, paddingBottom: 40 },
  demo: { backgroundColor: colors.warnSoft, padding: 10, borderRadius: 10 },
}));
