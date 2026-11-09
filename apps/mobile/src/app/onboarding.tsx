import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Chip, ErrorText, Input, Row, Screen, Text } from '../components/ui';
import { api } from '../lib/api';
import { POSITION_LABEL } from '../lib/format';
import { errMsg, useSession } from '../lib/session';
import type { Position } from '../lib/types';

const CITIES = ['بغداد', 'البصرة', 'أربيل', 'النجف', 'كربلاء', 'الموصل', 'السليمانية', 'الحلة', 'الناصرية', 'الديوانية'];
const POSITIONS: Position[] = ['goalkeeper', 'defender', 'midfielder', 'forward', 'any'];

export default function Onboarding() {
  const router = useRouter();
  const { refresh, profile } = useSession();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [city, setCity] = useState(profile?.city ?? 'بغداد');
  const [position, setPosition] = useState<Position>(profile?.preferred_position ?? 'any');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (name.trim().length < 3) return setError('اكتب اسمك (3 أحرف على الأقل)');
    setBusy(true);
    setError(null);
    try {
      await api.saveProfile({ full_name: name.trim(), city, preferred_position: position });
      await refresh();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">أهلاً بك في بالملعب 👋</Text>
      <Text variant="muted">عرّفنا عليك حتى نرتب لك مباريات تناسب مستواك ومنطقتك.</Text>
      <Input label="الاسم" placeholder="الاسم الكامل" value={name} onChangeText={setName} />
      <Text variant="small">المحافظة</Text>
      <Row>
        {CITIES.map((c) => (
          <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
        ))}
      </Row>
      <Text variant="small">مركزك المفضّل</Text>
      <Row>
        {POSITIONS.map((p) => (
          <Chip key={p} label={POSITION_LABEL[p]} active={position === p} onPress={() => setPosition(p)} />
        ))}
      </Row>
      <ErrorText message={error} />
      <Button title={profile ? 'حفظ' : 'ابدأ اللعب'} loading={busy} onPress={submit} />
    </Screen>
  );
}
