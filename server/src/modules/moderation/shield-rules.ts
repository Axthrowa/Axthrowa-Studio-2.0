/**
 * AxBoT — Kalkan modu kuralları (saf)
 * Developed by AxthrowA
 *
 * 4. tur denetimi (H-KALKAN): ayarlardaki büyük harf / emoji / hesap yaşı /
 * yalnız takipçi seçenekleri hiçbir yerde uygulanmıyordu; yalnız abone ve
 * link kuralı botun mesajı yok saymasını sağlıyordu, mesaj yayında (OBS
 * sohbet katmanında) görünmeye devam ediyordu.
 *
 * Kalkan açıkken ihlal eden mesaj: bot yok sayar (komut/puan/TTS yok), OBS
 * sohbet katmanında gösterilmez ve — `platformdaSil` seçiliyse ve platform
 * destekliyorsa — platformda silinir.
 *
 * Uygulanamayan iki seçenek BİLEREK uygulanmaz ve arayüzde öyle gösterilir:
 * sohbet olaylarında (Kick, Twitch IRC, YouTube, Trovo) ne gönderenin takip
 * durumu ne de hesabının açılış tarihi var. Her mesaj için ek API çağrısı
 * hem hız sınırına takılır hem de baskın anında tam yanlış yerde yavaşlatır.
 */

export type KalkanIhlali = 'abone' | 'link' | 'caps' | 'emoji';

export interface KalkanKurallari {
  isActive: boolean;
  blockLinks: boolean;
  blockCaps: boolean;
  blockEmotes: boolean;
  subOnly: boolean;
}

export interface KalkanMesaji {
  message: string;
  user: { isMod?: boolean; isBroadcaster?: boolean; isSub?: boolean; isVip?: boolean };
  emotes?: Record<string, string[]>;
}

/** Arayüzün "desteklenmiyor" diye gösterdiği ayarlar ve nedeni. */
export const KALKAN_DESTEKLENMEYEN = {
  followerOnly: 'Platformların sohbet olayları gönderenin takip durumunu içermiyor.',
  minAccountAgeDays: 'Platformların sohbet olayları hesabın açılış tarihini içermiyor.'
} as const;

/** Kalkan AutoMod'dan katıdır: normal kuralda serbest kalan kısa bağırışlar da yakalanır. */
export const KALKAN_CAPS_EN_AZ_HARF = 8;
export const KALKAN_CAPS_ORANI = 0.7;
export const KALKAN_EN_FAZLA_EMOJI = 3;

const LINK = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|gg|tv|xyz|info|ru|me|ly|co)\b/i;
const EMOJI = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;
/** Kick sohbet metnindeki emote işaretlemesi: `[emote:37226:KEKW]` */
const KICK_EMOTE = /\[emote:\d+:[^\]]*\]/g;

export function linkVarMi(metin: string): boolean {
  return LINK.test(metin);
}

/** Türkçe harfler dahil: `İ`, `Ş`, `Ğ` büyük harf sayılır. */
export function buyukHarfMi(metin: string): boolean {
  const harfler = metin.replace(KICK_EMOTE, '').match(/\p{L}/gu) || [];
  if (harfler.length < KALKAN_CAPS_EN_AZ_HARF) return false;
  let buyuk = 0;
  for (const h of harfler) {
    if (h !== h.toLocaleLowerCase('tr') && h === h.toLocaleUpperCase('tr')) buyuk++;
  }
  return buyuk / harfler.length >= KALKAN_CAPS_ORANI;
}

/** Unicode emoji + platform emote'ları (Kick işaretlemesi ya da Twitch `emotes` etiketi). */
export function emojiSayisi(metin: string, emotes?: Record<string, string[]>): number {
  const unicode = (metin.match(EMOJI) || []).length;
  const kick = (metin.match(KICK_EMOTE) || []).length;
  const etiket = emotes ? Object.values(emotes).reduce((t, konumlar) => t + (Array.isArray(konumlar) ? konumlar.length : 0), 0) : 0;
  return unicode + kick + etiket;
}

/**
 * Kalkan açıkken bu mesaj engellenmeli mi? Yayıncı ve moderatörler muaftır;
 * yalnız-abone kuralında abone ve VIP'ler de geçer.
 */
export function kalkanIhlali(kurallar: KalkanKurallari, mesaj: KalkanMesaji): KalkanIhlali | null {
  if (!kurallar.isActive) return null;
  const u = mesaj.user || {};
  if (u.isBroadcaster || u.isMod) return null;
  const metin = String(mesaj.message || '');
  if (kurallar.subOnly && !u.isSub && !u.isVip) return 'abone';
  if (kurallar.blockLinks && linkVarMi(metin)) return 'link';
  if (kurallar.blockCaps && buyukHarfMi(metin)) return 'caps';
  if (kurallar.blockEmotes && emojiSayisi(metin, mesaj.emotes) > KALKAN_EN_FAZLA_EMOJI) return 'emoji';
  return null;
}

export const KALKAN_IHLAL_ADI: Record<KalkanIhlali, string> = {
  abone: 'yalnız abone',
  link: 'link',
  caps: 'büyük harf',
  emoji: 'emoji seli'
};
