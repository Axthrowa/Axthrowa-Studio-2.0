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
}
