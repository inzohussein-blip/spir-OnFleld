import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
import { POSITION_CODE } from '../lib/stats';
import type { PlayerCard, PlayerStats, Profile } from '../lib/types';
import { fonts, fromLeft, themed, wideSpaces } from '../theme';
import { Halftone, Text } from './ui';

const ROYAL = '#1A23C9';
const NAVY = '#0B1033';
const YELLOW = '#FFD60A';

/** جهة: المشاركة (مباريات، أهداف، فوز) */
const PLAY: { key: keyof PlayerStats; label: string }[] = [
  { key: 'matches', label: 'مباريات' },
  { key: 'goals', label: 'أهداف' },
  { key: 'wins', label: 'فوز' },
];
/** الجهة الثانية: البطاقات ورجل المباراة — أيقونة بطاقة ملوّنة أو ميدالية */
const DISCIPLINE: { key: keyof PlayerStats; label: string; chip?: string }[] = [
  { key: 'yellow', label: 'صفراء', chip: YELLOW },
  { key: 'red', label: 'حمراء', chip: '#E5252A' },
  { key: 'mvps', label: 'رجل المباراة' },
];

/**
 * بطاقة اللاعب بحسابي — على شكل بطاقات اللاعبين (التقييم والمركز بالزاوية، صورة كبيرة،
 * الاسم، وإحصائياته بجهتين: المشاركة، والبطاقات ورجل المباراة) بأسلوب «ملكي»: أزرق بنقاط القمصان، شريطين أصفر مايلين،
 * إطار أصفر، وأسفل البطاقة مدوّر مثل الدرع.
 */
export function RoyalPlayerCard({
  profile,
  card,
  uploading,
  onChangePhoto,
  onCopyId,
}: {
  profile: Profile;
  card: PlayerCard | null | undefined;
  uploading?: boolean;
  onChangePhoto: () => void;
  onCopyId: () => void;
}) {
  const st = useStyles();
  const stat = (k: keyof PlayerStats) => (card ? String(card.stats[k]) : '—');
  return (
    <View style={st.card} accessibilityLabel={`بطاقة ${profile.full_name}، التقييم ${card?.overall ?? ''}`}>
      <Halftone rows={30} cols={20} style={{ top: 8, ...fromLeft(8) }} color="rgba(255,255,255,0.10)" />
      <View style={st.stripeWide} pointerEvents="none" />
      <View style={st.stripeThin} pointerEvents="none" />
      <View style={st.inner} pointerEvents="none" />

      {/* التقييم والمركز بالزاوية، والصورة الكبيرة */}
      <View style={st.top}>
        <View style={st.ratingCol}>
          <Text style={st.rating}>{card?.overall ?? '—'}</Text>
          <Text style={st.position}>{POSITION_CODE[profile.preferred_position]}</Text>
          <View style={st.rule} />
          <Ionicons name="football" size={22} color={YELLOW} />
          {profile.city ? <Text style={st.city} numberOfLines={1}>{profile.city}</Text> : null}
        </View>
        <Pressable onPress={onChangePhoto} style={st.photoWrap} accessibilityRole="button" accessibilityLabel="تغيير الصورة الشخصية">
          <View style={st.photo}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`صورة ${profile.full_name}`} />
            ) : (
              <Text style={st.initial}>{profile.full_name.trim().slice(0, 1) || '؟'}</Text>
            )}
          </View>
          <View style={st.camera}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={15} color={NAVY} />
          </View>
        </Pressable>
      </View>

      {/* الاسم */}
      <Text style={st.name} numberOfLines={1}>{wideSpaces(profile.full_name)}</Text>
      <View style={st.nameLine} />

      {/* الإحصائيات بجهتين */}
      <View style={st.attrs}>
        <View style={[st.attrCol, st.attrColSep]}>
          {PLAY.map(({ key, label }) => (
            <View key={key} style={st.attrRow}>
              <Text style={st.attrValue}>{stat(key)}</Text>
              <Text style={st.attrLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={[st.attrCol, st.attrColWide]}>
          {DISCIPLINE.map(({ key, label, chip }) => (
            <View key={key} style={st.attrRow}>
              <Text style={st.attrValue}>{stat(key)}</Text>
              {chip ? <View style={[st.chip, { backgroundColor: chip }]} /> : <Ionicons name="medal" size={12} color={YELLOW} />}
              <Text style={st.attrLabel} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* رقم اللاعب بطرف الدرع */}
      {profile.public_id ? (
        <Pressable onPress={onCopyId} style={st.id} accessibilityRole="button" accessibilityLabel={`رقمك ${profile.public_id} — اضغط للنسخ`}>
          <Text style={st.idText}>ID {profile.public_id}</Text>
          <Ionicons name="copy-outline" size={13} color={NAVY} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = themed(() => ({
  card: {
    alignSelf: 'center',
    width: 300,
    backgroundColor: ROYAL,
    borderWidth: 3,
    borderColor: YELLOW,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 30,
    paddingHorizontal: 18,
    alignItems: 'center',
    boxShadow: `0 6px 0 ${NAVY}`,
  },
  stripeWide: { position: 'absolute', top: -40, bottom: -40, ...fromLeft(-50), width: 62, backgroundColor: YELLOW, transform: [{ skewX: '-14deg' }] },
  stripeThin: { position: 'absolute', top: -40, bottom: -40, ...fromLeft(22), width: 9, backgroundColor: YELLOW, transform: [{ skewX: '-14deg' }] },
  // خط رفيع داخل الإطار مثل حافة البطاقة
  inner: { position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderWidth: 1, borderColor: 'rgba(255,214,10,0.45)', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 112, borderBottomRightRadius: 112 },
  top: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'flex-start', gap: 8 },
  ratingCol: { width: 74, alignItems: 'center', gap: 2 },
  rating: { fontFamily: fonts.display, fontSize: 54, lineHeight: 64, color: YELLOW },
  position: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  rule: { width: 34, height: 2, backgroundColor: 'rgba(255,255,255,0.5)', marginVertical: 6 },
  city: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, color: '#C9CEF5', marginTop: 4 },
  photoWrap: { flex: 1, alignItems: 'center', paddingTop: 4 },
  photo: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#E3E6FF', borderWidth: 4, borderColor: YELLOW, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 72, lineHeight: 92, color: ROYAL },
  camera: { position: 'absolute', bottom: 2, right: 18, width: 34, height: 34, borderRadius: 10, backgroundColor: YELLOW, borderWidth: 2, borderColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 40, color: '#FFFFFF', textAlign: 'center', marginTop: 10, maxWidth: '100%' },
  nameLine: { width: '70%', height: 3, borderRadius: 2, backgroundColor: YELLOW, marginTop: 2, marginBottom: 10 },
  attrs: { flexDirection: 'row', alignSelf: 'stretch', paddingStart: 4, paddingEnd: 2 },
  attrCol: { flex: 1, gap: 4, paddingHorizontal: 8 },
  // جهة البطاقات أعرض شوية لأن «رجل المباراة» أطول
  attrColWide: { flex: 1.5, paddingEnd: 0 },
  attrColSep: { borderLeftWidth: 2, borderLeftColor: 'rgba(255,214,10,0.6)' },
  attrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // بطاقة الحكم الصغيرة (صفراء/حمراء)
  chip: { width: 10, height: 14, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  attrValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: '#FFFFFF', minWidth: 22 },
  attrLabel: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 20, color: '#E3E6FF' },
  id: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, minHeight: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: YELLOW },
  idText: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: NAVY, letterSpacing: 0.5 },
}));
