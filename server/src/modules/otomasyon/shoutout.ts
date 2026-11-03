/**
 * Shoutout kartı: kanalın profil fotoğrafı ve son oyunu bulunabildiyse karta eklenir. Bilgi alınamazsa
 * (Kick engeli, Twitch'te yetki gerekmesi) kart yine adıyla çıkar: tanıtım dış servise takılmaz.
 */
import axios from 'axios';
import { eventBus } from '../../core/event-bus.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const KANAL_ADI = /^[A-Za-z0-9_-]{1,40}$/;

/** `kick.com/api/v2/channels/<kanal>` yanıtından kartın alanları */
export function kickKanalBilgisi(veri: any): { avatarUrl?: string; oyun?: string } {
  const avatar = veri?.user?.profile_pic;
  const oyun = veri?.livestream?.categories?.[0]?.name ?? veri?.previous_livestreams?.[0]?.categories?.[0]?.name ?? veri?.recent_categories?.[0]?.name;
  return {
    ...(typeof avatar === 'string' && avatar.startsWith('https://') ? { avatarUrl: avatar } : {}),
    ...(typeof oyun === 'string' && oyun ? { oyun: oyun.slice(0, 80) } : {}),
  };
}

export async function shoutoutGonder(kanal: string, platform: string): Promise<void> {
  let bilgi: { avatarUrl?: string; oyun?: string } = {};
  if (platform === 'kick' && KANAL_ADI.test(kanal)) {
    try {
      const r = await axios.get(`https://kick.com/api/v2/channels/${kanal}`, { headers: { Accept: 'application/json', 'User-Agent': UA }, timeout: 2500 });
      bilgi = kickKanalBilgisi(r.data);
    } catch {
      /* bilgi alınamadı: kart adıyla çıkar */
    }
  }
  eventBus.emit('widget_update', { type: 'shoutout', data: { channel: kanal, platform, ...bilgi } });
}
