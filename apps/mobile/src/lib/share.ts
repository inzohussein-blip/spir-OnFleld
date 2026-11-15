import { Share } from 'react-native';
import { WEB_URL } from '../config';
import { formatDateTime } from './format';
import { spotsInfo } from './schedule';
import type { Match } from './types';

/** رابط ويب يفتح المباراة لأي شخص (حتى بدون التطبيق) */
export const matchLink = (id: string) => `${WEB_URL.replace(/\/$/, '')}/match/${id}`;

export function shareMatch(m: Match) {
  const spots = spotsInfo(m);
  return Share.share({
    message:
      `⚽ ${m.title || m.venue_name || 'مباراة'}\n` +
      `🕒 ${formatDateTime(m.starts_at)}\n` +
      (spots.left > 0 ? `${spots.label} — تعال العب ويانه!` : 'العدد مكتمل — سجّل بقائمة الانتظار') +
      `\n${matchLink(m.id)}`,
  });
}

/** رابط دعوة صديق للتطبيق (ويّا رقم اللاعب حتى نعرف منو دعاه) */
export function shareInvite(publicId?: string | null) {
  const url = `${WEB_URL.replace(/\/$/, '')}/${publicId ? `?ref=${publicId}` : ''}`;
  return Share.share({ message: `⚽ تعال العب ويّاي ببالملعب — تلكى مباراة قريبة منك وتنضم بضغطة\n${url}` });
}
