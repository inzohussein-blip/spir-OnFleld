import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText, Input, Text } from '../components/ui';
import { api } from '../lib/api';
import { errMsg, useSession } from '../lib/session';
import { fonts, themed, useColors } from '../theme';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.header }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <Text style={styles.logo}>⚽</Text>
          <Text style={styles.brand}>بالملعب</Text>
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  logo: { fontSize: 64 },
  brand: { fontFamily: fonts.bold, fontSize: 40, color: '#fff', lineHeight: 60 },
  tagline: { color: '#DDF3E5', fontSize: 16 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, paddingBottom: 40 },
  demo: { backgroundColor: colors.warnSoft, padding: 10, borderRadius: 10 },
}));
