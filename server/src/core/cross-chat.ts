/**
 * StreamAxT — çapraz sohbet aktarımı (saf)
 * Developed by AxthrowA
 *
 * Bir platformdaki sohbet mesajı diğer bağlı platformlara bot hesabıyla
 * yazılır. Eski kodda üç kusur vardı:
 *
 * 1) YANKI DÖNGÜSÜ. Aktarılan mesaj hedef platformda botun kendi mesajı
 *    olarak geri geliyor. Yalnız Kick bu yankıyı eliyordu; Twitch, YouTube ve
 *    Trovo'dan dönen "[KICK] ali: selam" yeniden aktarılıyordu. İki yankılı
 *    platform bağlıyken mesaj platformlar arasında döngüye girip sohbeti
 *    dolduruyordu. YouTube'da bot çoğunlukla yayıncının kendi hesabı olduğu
 *    için dönen metin YAYINCI yetkisiyle komut olarak da işlenebiliyordu.
 * 2) `$` KALIPLARI. Biçim `String.replace(dize, izleyiciMetni)` ile
 *    dolduruluyordu; izleyicinin yazdığı `$&`, `$'` gibi kalıplar yerine koyma
 *    sözdizimi sayılıp metni bozuyordu. Kullanıcı adında `$message` geçerse
 *    sıradaki yer tutucu adın içinde değiştiriliyordu.
 * 3) KOMUT OLARAK YORUMLANMA. Biçim `$message` ile başlıyorsa izleyicinin
 *    `/ban ...` ya da `!komut` metni botun (moderatör) ağzından diğer
 *    platformda komut gibi görünebiliyordu.
 */

export interface AktarimDegerleri {
  platform: string;
  user: string;
  message: string;
}

/** Platform sohbet sınırlarının altında kal (Twitch 500, YouTube 200 → gönderici keser). */
export const AKTARIM_UZUNLUK_SINIRI = 450;

const PLATFORMLAR = ['KICK', 'TWITCH', 'YOUTUBE', 'TROVO', 'TIKTOK', 'DISCORD'];

/**
 * Biçimi tek geçişte doldurur. Değerler yerine koyma sözdizimi olarak
 * yorumlanmaz, birbirinin içindeki yer tutucular da değiştirilmez.
 */
export function aktarimMetni(bicim: string, d: AktarimDegerleri): string {
  const degerler: Record<string, string> = {
    platform: String(d.platform || '').toUpperCase(),
    user: String(d.user || ''),
    message: String(d.message || '')
  };
  let metin = String(bicim || '[$platform] $user: $message')
    .replace(/\$(platform|user|message)/g, (_, anahtar: string) => degerler[anahtar])
    .replace(/[\r\n]+/g, ' ')
    .trim();
  // Satır başındaki komut karakteri başka platformda komut gibi okunmasın.
  if (/^[/.!]/.test(metin)) metin = `» ${metin}`;
  return metin.slice(0, AKTARIM_UZUNLUK_SINIRI);
}

function kacisla(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Gelen mesaj bizim aktarım biçimimizle üretilmiş bir metin mi (yankı)?
 *
 * Hedef platform metni kesebildiği ya da biçimlendirebildiği için birebir
 * karşılaştırma yetmez; biçimin sabit kısımları ve platform adı üzerinden
 * eşleşir. Yalnız `$message`'dan oluşan biçimde ayırt edilecek bir iz
 * olmadığından `false` döner (o durumda gönderilen metinlerin birebir kaydı
 * korur).
 */
export function aktarimYankisiMi(bicim: string, gelen: string): boolean {
  const b = String(bicim || '[$platform] $user: $message');
  if (!b.includes('$platform')) return false;
  const govde = b
    .split(/(\$platform|\$user|\$message)/)
    .map((parca) => {
      if (parca === '$platform') return `(?:${PLATFORMLAR.join('|')})`;
      if (parca === '$user') return '.+?';
      if (parca === '$message') return '[\\s\\S]*';
      return kacisla(parca.replace(/[\r\n]+/g, ' '));
    })
    .join('');
  const metin = String(gelen || '').trim().replace(/^» /, '');
  return new RegExp(`^${govde}$`, 'i').test(metin);
}

const BOTU_ISARETLEYEN = new Set(['kick', 'twitch', 'discord']);

/**
 * Gelen metin botun az önce yazdığı metnin yankısı mı? Bot hesabını `isSelf` ile işaretleyen
 * platformlarda izleyici yankı sayılmaz: botla aynı metni yazan izleyici yok sayılıyordu.
 * YouTube ve Trovo'da bot hesabı ayırt edilemediği için metin eşleşmesi yeterlidir.
 */
export function botYankisiMi(sonCiktilar: Set<string>, metin: string, platform: string, isSelf?: boolean): boolean {
  return sonCiktilar.has(metin) && (!BOTU_ISARETLEYEN.has(platform) || Boolean(isSelf));
}
