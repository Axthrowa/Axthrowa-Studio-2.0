/**
 * StreamAxT — platform yetenek modeli
 * Developed by AxthrowA
 *
 * Denetimde bulundu (CURRENT_SYSTEM_AUDIT §3): adaptör sözleşmesi yalnız
 * connect/disconnect/sendMessage/isConnected/getStatus içeriyordu. Hangi
 * platformun hangi olayı verebildiği veya hangi moderasyon eylemini
 * yapabildiği hiçbir yerde tanımlı değildi. Sonuç: panel her platform için
 * tüm ayarları gösteriyordu — Discord'a "abone uyarısı", YouTube'a "raid"
 * gibi karşılığı olmayanlar dahil.
 *
 * BotRix de aynı şeyi yapıyor: TTS sayfasındaki rol listesi Kick'e özel
 * ("Herkes / Abone / VIP / OG / Moderatör / Sahip"), uyarı listesi platform
 * etiketli ("Bits (Twitch)", "Super Chat (YouTube)").
 *
 * Burada kodda `if (platform === 'kick')` yazmak yerine yetenek sorulur.
 */

export type PlatformAdi = 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';

export type OlayTuru =
  | 'chat'
  | 'follow'
  | 'sub'
  | 'resub'
  | 'gift_sub'
  | 'tip'
  | 'bits'
  | 'kicks'
  | 'superchat'
  | 'raid'
  | 'host'
  | 'gift_tiktok'
  | 'member'
  | 'stream_online'
  | 'stream_offline';

export type Rol = 'everyone' | 'sub' | 'vip' | 'og' | 'mod' | 'broadcaster';

export interface PlatformYetenekleri {
  sohbet: { oku: boolean; gonder: boolean };
  olaylar: OlayTuru[];
  moderasyon: { timeout: boolean; ban: boolean; mesajSil: boolean };
  yayin: { baslikDegistir: boolean; kategoriDegistir: boolean; izleyiciSayisi: boolean };
  roller: Rol[];
}

/**
 * Gözlemlenen gerçek durum. Bir yetenek `true` ise adaptörde KARŞILIĞI
 * uygulanmış olmalıdır; aksi halde arayüz olmayan bir şey vaat eder.
 */
export const YETENEKLER: Record<PlatformAdi, PlatformYetenekleri> = {
  kick: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'follow', 'sub', 'gift_sub', 'kicks', 'host'],
    moderasyon: { timeout: true, ban: true, mesajSil: false },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: true },
    // Kick'in rol kümesi — BotRix TTS sayfasında da aynısı listeleniyor
    roller: ['everyone', 'sub', 'vip', 'og', 'mod', 'broadcaster']
  },
  twitch: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'follow', 'sub', 'resub', 'gift_sub', 'bits', 'tip', 'raid'],
    moderasyon: { timeout: true, ban: true, mesajSil: true },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: true },
    roller: ['everyone', 'sub', 'vip', 'mod', 'broadcaster']
  },
  youtube: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'superchat', 'tip', 'member'],
    moderasyon: { timeout: false, ban: false, mesajSil: false },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: true },
    roller: ['everyone', 'sub', 'mod', 'broadcaster']
  },
  tiktok: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'follow', 'gift_tiktok'],
    moderasyon: { timeout: false, ban: false, mesajSil: false },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: true },
    roller: ['everyone', 'mod', 'broadcaster']
  },
  discord: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat'],
    moderasyon: { timeout: false, ban: false, mesajSil: false },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: false },
    roller: ['everyone', 'mod', 'broadcaster']
  }
};

/** Bilinmeyen platformda her şey kapalı kabul edilir. */
const BOS: PlatformYetenekleri = {
  sohbet: { oku: false, gonder: false },
  olaylar: [],
  moderasyon: { timeout: false, ban: false, mesajSil: false },
  yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: false },
  roller: ['everyone', 'broadcaster']
};

export function yetenek(platform: string): PlatformYetenekleri {
  return YETENEKLER[String(platform).toLowerCase() as PlatformAdi] ?? BOS;
}

/** Belirli bir olayı hangi platformlar üretebilir? */
export function olayiDestekleyenler(olay: OlayTuru): PlatformAdi[] {
  return (Object.keys(YETENEKLER) as PlatformAdi[]).filter((p) =>
    YETENEKLER[p].olaylar.includes(olay)
  );
}

/** Panelin "neden yapamıyorum" diye açıklaması için kısa metin. */
export function moderasyonAciklamasi(platform: string, eylem: 'timeout' | 'ban' | 'mesajSil'): string | null {
  const y = yetenek(platform);
  if (y.moderasyon[eylem]) return null;
  const adlar: Record<string, string> = {
    timeout: 'zaman aşımı',
    ban: 'yasaklama',
    mesajSil: 'mesaj silme'
  };
  return `${platform} platformu ${adlar[eylem]} desteklemiyor; uyarı mesajına düşülür.`;
}
