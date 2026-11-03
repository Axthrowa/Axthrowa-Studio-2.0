/**
 * AxBoT — değişken motoru genel arayüzü
 * Developed by AxthrowA
 *
 * Çağıranlar yalnız bu dosyayı kullanır.
 */
import type { ChatMessagePayload } from '../event-bus.js';
import { coz } from './resolve.js';
import { kayitDefteri, degiskenKatalogu } from './registry.js';
import type { DegiskenBaglam } from './types.js';
import { kickbotCevir } from './kickbot-uyum.js';

export { degiskenKatalogu };
export type { DegiskenBaglam };

/** Sohbet mesajından değişken bağlamı üretir. */
export function baglamOlustur(
  message: ChatMessagePayload,
  args: string[] = [],
  commandName?: string,
  isTest = false
): DegiskenBaglam {
  return {
    user: {
      username: message.user.username,
      displayName: message.user.displayName || message.user.username,
      userId: (message.user as any).id ? String((message.user as any).id) : undefined,
      isBroadcaster: !!message.user.isBroadcaster,
      isMod: !!message.user.isMod,
      isSub: !!message.user.isSub,
      isVip: !!message.user.isVip
    },
    platform: message.platform,
    channel: message.channel,
    args,
    rawArgs: args.join(' '),
    commandName,
    isTest,
    yerel: new Map()
  };
}

/**
 * Şablonu çözer. Eski `{user}` biçimi `variable-parser.ts` tarafından ZATEN
 * çözülmüş olarak gelir; burada yeni `$(...)` biçimi işlenir.
 */
export async function degiskenleriCoz(sablon: string, ctx: DegiskenBaglam): Promise<string> {
  // `{{sender.username}}` gibi başka bot söz dizimi önce `$(...)`'a çevrilir
  return coz(kickbotCevir(sablon), kayitDefteri, ctx);
}

/** Kayıtlı değişken sayısı (panelde göstermek için). */
export function degiskenSayisi(): number {
  return kayitDefteri.size;
}
