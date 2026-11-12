/**
 * AxBoT — platform yetenek modeli
 * Developed by AxthrowA
 *
 * Denetimde bulundu (CURRENT_SYSTEM_AUDIT §3): adaptör sözleşmesi yalnız
 * connect/disconnect/sendMessage/isConnected/getStatus içeriyordu. Hangi
 * platformun hangi olayı verebildiği veya hangi moderasyon eylemini
 * yapabildiği hiçbir yerde tanımlı değildi. Sonuç: panel her platform için
 * tüm ayarları gösteriyordu — Discord'a "abone uyarısı", YouTube'a "raid"
 * gibi karşılığı olmayanlar dahil.
 *
 * Örnek alınan bot da aynı şeyi yapıyor: TTS sayfasındaki rol listesi Kick'e özel
 * ("Herkes / Abone / VIP / OG / Moderatör / Sahip"), uyarı listesi platform
 * etiketli ("Bits (Twitch)", "Super Chat (YouTube)").
 *
 * Burada kodda `if (platform === 'kick')` yazmak yerine yetenek sorulur.
 */

export type PlatformAdi = 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';

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

export type Rol = 'everyone' | 'regular' | 'sub' | 'vip' | 'og' | 'mod' | 'broadcaster';

export interface PlatformYetenekleri {
  sohbet: { oku: boolean; gonder: boolean };
  olaylar: OlayTuru[];
  /** sohbetModlari: yavaş / takipçi / abone / emote modu API'si (yalnız Twitch Helix; Kick ve YouTube'un resmi API'sinde yok) */
  moderasyon: { timeout: boolean; ban: boolean; mesajSil: boolean; sohbetModlari: boolean };
  yayin: { baslikDegistir: boolean; kategoriDegistir: boolean; izleyiciSayisi: boolean };
  roller: Rol[];
}

/**
 * Gözlemlenen gerçek durum. Bir yetenek `true` ise adaptörde KARŞILIĞI
 * uygulanmış olmalıdır; aksi halde arayüz olmayan bir şey vaat eder.
 */
export const YETENEKLER: Record<PlatformAdi, PlatformYetenekleri> = {
  // `ban`: kalıcı yasaklama YÖNTEMİ (`banUser`/`unbanUser`) uygulanmış mı?
  // 4. turda Kick, Twitch, YouTube ve Trovo'ya resmi uçlarla eklendi;
  // ortak kara liste ve panel izleyici kartı kullanır. AutoMod kural
  // eylemleri örnek alınan bottaki gibi uyarı/silme/zaman aşımıyla sınırlı kalır.
  kick: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'follow', 'sub', 'gift_sub', 'kicks', 'host', 'stream_online', 'stream_offline'],
    // Resmi API (docs.kick.com): POST /moderation/bans (dakika, 1-10080),
    // DELETE /chat/{id}, PATCH /channels. Token şu izinleri taşımalı:
    // moderation:ban, moderation:chat_message:manage, channel:write —
    // eski bağlantılar taşımaz, bir kez yeniden bağlanmak gerekir.
    // Kalıcı ban: aynı uç, `duration` verilmez; kaldırma DELETE.
    moderasyon: { timeout: true, ban: true, mesajSil: true, sohbetModlari: false },
    yayin: { baslikDegistir: true, kategoriDegistir: true, izleyiciSayisi: true },
    // Kick'in rol kümesi — örnek alınan bot TTS sayfasında da aynısı listeleniyor
    roller: ['everyone', 'sub', 'vip', 'og', 'mod', 'broadcaster']
  },
  twitch: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'follow', 'sub', 'resub', 'gift_sub', 'bits', 'tip', 'raid', 'stream_online', 'stream_offline'],
    // Helix (twitch-helix.ts). IRC jetonu `oauth2/validate` ile doğrulanıp
    // Client-ID ondan öğrenilir. Jetonda ilgili izin yoksa işlem SEBEBİYLE
    // reddedilir (moderator:manage:banned_users, moderator:manage:chat_messages,
    // channel:manage:broadcast, moderator:manage:chat_settings). Jetonsuz (anonim) okuyucuda hiçbiri çalışmaz.
    moderasyon: { timeout: true, ban: true, mesajSil: true, sohbetModlari: true },
    yayin: { baslikDegistir: true, kategoriDegistir: true, izleyiciSayisi: true },
    roller: ['everyone', 'sub', 'vip', 'mod', 'broadcaster']
  },
  youtube: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat', 'superchat', 'tip', 'member', 'stream_online', 'stream_offline'],
    // liveChatBans.insert (temporary/permanent) ve liveChatMessages.delete —
    // OAuth jetonu gerekir. Ban kaldırma eklemenin döndürdüğü kimlikle.
    // Başlık videos.update ile; YouTube'da "oyun/kategori" Data API ile
    // değiştirilemiyor.
    moderasyon: { timeout: true, ban: true, mesajSil: true, sohbetModlari: false },
    yayin: { baslikDegistir: true, kategoriDegistir: false, izleyiciSayisi: true },
    roller: ['everyone', 'sub', 'mod', 'broadcaster']
  },
  tiktok: {
    // TikTok sohbeti YALNIZ OKUNABİLİR (resmi yazma API'si yok). Önceden
    // `gonder: true` yazıyordu ama `sendMessage` her zaman false dönüyordu.
    sohbet: { oku: true, gonder: false },
    olaylar: ['chat', 'follow', 'gift_tiktok', 'stream_online', 'stream_offline'],
    moderasyon: { timeout: false, ban: false, mesajSil: false, sohbetModlari: false },
    // İzleyici sayısı kütüphanede var ama adaptörde OKUNMUYOR
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: false },
    roller: ['everyone', 'mod', 'broadcaster']
  },
  trovo: {
    sohbet: { oku: true, gonder: true },
    // Trovo sohbet akisi bu olaylari veriyor (Chat Service §3.4).
    // `tip` spell (mana/elixir) karsiligidir; tutar BILINMEDIGI icin 0
    // gonderilir, adet mesajda tasinir.
    olaylar: ['chat', 'follow', 'sub', 'gift_sub', 'tip', 'raid', 'stream_online', 'stream_offline'],
    // Mesaj silme: DELETE /channels/{c}/messages/{m}/users/{u} (belgeli).
    // Kalıcı ban: belgedeki örnek komut `ban xxx`. Zaman aşımının SÜRE
    // BİRİMİ hiçbir kaynakta yok — uydurulmadı.
    moderasyon: { timeout: false, ban: true, mesajSil: true, sohbetModlari: false },
    // Başlık: belgedeki örnek komut `settitle`. Kategori komutu belgede yok.
    yayin: { baslikDegistir: true, kategoriDegistir: false, izleyiciSayisi: false },
    // Trovo'da VIP yok; editor/supermod en yakin kanal rolleridir.
    roller: ['everyone', 'sub', 'vip', 'mod', 'broadcaster']
  },
  discord: {
    sohbet: { oku: true, gonder: true },
    olaylar: ['chat'],
    // discord.js (4. tur): mesaj silme, zaman aşımı (en çok 28 gün), ban.
    // Bot sunucuda ilgili izinlere sahip olmalı; yoksa sebep söylenir.
    moderasyon: { timeout: true, ban: true, mesajSil: true, sohbetModlari: false },
    yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: false },
    roller: ['everyone', 'mod', 'broadcaster']
  }
};

/** Bilinmeyen platformda her şey kapalı kabul edilir. */
const BOS: PlatformYetenekleri = {
  sohbet: { oku: false, gonder: false },
  olaylar: [],
  moderasyon: { timeout: false, ban: false, mesajSil: false, sohbetModlari: false },
  yayin: { baslikDegistir: false, kategoriDegistir: false, izleyiciSayisi: false },
  roller: ['everyone', 'broadcaster']
};

export function yetenek(platform: string): PlatformYetenekleri {
  return YETENEKLER[String(platform).toLowerCase() as PlatformAdi] ?? BOS;
}

