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

const KANAL_KOKU: Record<string, string> = { kick: 'https://kick.com', twitch: 'https://twitch.tv', youtube: 'https://youtube.com/@' };

/** `!so` ve paneldeki "Shoutout" aynı sohbet metnini yazar */
export function shoutoutMetni(kanal: string, platform: string): string {
  return `📢 ${kanal} kanalına göz atın: ${KANAL_KOKU[String(platform).toLowerCase()] || KANAL_KOKU.kick}/${kanal}`;
}

/** `klip`: Y10 gelen Twitch baskınında baskın yapanın son klibi kartın altında oynar */
export async function shoutoutGonder(kanal: string, platform: string, secenek: { klip?: boolean } = {}): Promise<void> {
  let bilgi: { avatarUrl?: string; oyun?: string; klipId?: string; klipSure?: number } = {};
  if (platform === 'twitch' && secenek.klip && KANAL_ADI.test(kanal)) {
    try {
      const { platformManager } = await import('../../platforms/manager.js');
      const tw: any = platformManager.getPlatform('twitch');
      const [klip, avatar] = await Promise.all([tw?.sonKlip?.(kanal), tw?.avatarBul?.(kanal)]);
      if (klip) bilgi = { klipId: klip.id, klipSure: klip.sure };
      if (typeof avatar === 'string' && avatar.startsWith('https://')) bilgi.avatarUrl = avatar;
    } catch {
      /* klip bulunamadı: kart klipsiz çıkar */
    }
  }
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
