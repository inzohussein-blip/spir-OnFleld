import * as ImagePicker from 'expo-image-picker';

/** اختيار صورة مربعة من المعرض (يعيد null إذا ألغى المستخدم) */
export async function pickSquareImage(aspect: [number, number] = [1, 1]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('اسمح للتطبيق يوصل للصور من إعدادات الهاتف');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.6 });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0].uri;
}
