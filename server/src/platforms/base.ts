import type { YayinBilgisi } from '../core/live-status-math.js';

export interface PlatformStatus {
  connected: boolean;
  channel?: string;
  error?: string;
  viewerCount?: number;
}

/** Moderasyon eylemi sonucu — neden basarisiz oldugu panele tasinir. */
export interface ModerasyonSonucu {
  ok: boolean;
  hata?: string;
}

export abstract class BasePlatform {
  abstract readonly name: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(channel: string, message: string): Promise<boolean>;
  abstract isConnected(): boolean;
  abstract getStatus(): PlatformStatus;

  /**
   * Kullaniciya zaman asimi verir. Platform desteklemiyorsa TANIMSIZ birakilir;
   * hangi platformun ne yapabildigi `capabilities.ts` dosyasinda ilan edilir.
   */
  timeoutUser?(username: string, saniye: number, sebep?: string): Promise<ModerasyonSonucu>;

  /** Tek bir sohbet mesajini siler. */
  deleteMessage?(messageId: string): Promise<ModerasyonSonucu>;

  /**
   * Kullaniciyi bu platformda KALICI banlar. Yalniz resmi API'si olan
   * platformlarda tanimlidir (Kick, Twitch, YouTube, Trovo).
   */
  banUser?(username: string, sebep?: string): Promise<ModerasyonSonucu>;

  /** Kalici bani (ya da suren zaman asimini) kaldirir. */
  unbanUser?(username: string): Promise<ModerasyonSonucu>;

  /**
   * Yayin acik mi? Yoklama servisi (live-poller) bunu dakikada bir cagirir.
   * `null` = bu turda bilinemedi (ag hatasi vb.) — durum degistirilmez.
   * Olayla bildiren platformlar (TikTok, Trovo) bunu tanimlamaz.
   */
  yayinDurumu?(): Promise<YayinBilgisi | null>;

  /** Yayin basligini degistirir (`!title`, `$(settitle)`). */
  baslikDegistir?(baslik: string): Promise<ModerasyonSonucu>;

  /** Yayin kategorisini degistirir (`!game`, `$(setcategory)`). */
  kategoriDegistir?(kategori: string): Promise<ModerasyonSonucu & { kategori?: string }>;
}
