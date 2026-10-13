/**
 * StreamAxT — ortak kara listenin uygulanması
 * Developed by AxthrowA
 *
 * Kurallar `blacklist-rules.ts`'te (saf, testli). Burada: kayıt eşleşirse
 * mesaj bot tarafından yok sayılır (komut/puan/TTS yok) ve seçilen eylem
 * platformda uygulanır. OBS sohbet katmanından gizleme `ws/server.ts`'te
 * (`karaListede` işareti).
 */
import type { ChatMessagePayload } from '../../core/event-bus.js';
import { eventBus } from '../../core/event-bus.js';
import { seyrekUyar } from '../../core/logger.js';
import { platformManager } from '../../platforms/manager.js';
import { yetenek } from '../../platforms/capabilities.js';
import { denemeZamaniGeldi, eylemPlani, karaListeEylemi, type EylemPlani } from './blacklist-rules.js';
import { shieldModeService } from './shield-mode.js';

/** Başarısız ban (ör. izin yok) istek fırtınasına dönmesin. */
const BAN_TEKRAR_ARASI_MS = 5 * 60_000;
const sonBanDenemesi = new Map<string, number>();

/**
 * Mesaj kara listedeki bir kullanıcıdansa eylemi başlatır ve `true` döner
 * (çağıran mesajı işlemeyi bırakır). Platform çağrısı beklenmez: sohbet
 * işleme hattı ağ isteği yüzünden yavaşlamasın.
 */
export function karaListeyiUygula(message: ChatMessagePayload): boolean {
  const kayit = shieldModeService.karaListeKaydi(message.user.username, message.platform);
  if (!kayit) return false;

  const eylem = karaListeEylemi(shieldModeService.getSettings().karaListeEylemi);
  const plan = eylemPlani(eylem, yetenek(message.platform).moderasyon, message.platform);
  if (plan.not) seyrekUyar(`karaliste:not:${message.platform}:${eylem}`, `[Kara liste] ${plan.not}`);
  if (plan.sil || plan.ban) void platformdaUygula(message, plan, kayit.reason);
  return true;
}

async function platformdaUygula(message: ChatMessagePayload, plan: EylemPlani, sebep: string): Promise<void> {
  const p: any = platformManager.getPlatform(message.platform);
  const hedef = message.user.username;

  if (plan.ban) {
    const anahtar = `${message.platform}:${hedef.toLowerCase()}`;
    const simdi = Date.now();
    if (!denemeZamaniGeldi(sonBanDenemesi.get(anahtar), simdi, BAN_TEKRAR_ARASI_MS)) return;
    sonBanDenemesi.set(anahtar, simdi);
    if (sonBanDenemesi.size > 1000) sonBanDenemesi.clear();

    if (typeof p?.banUser !== 'function') {
      seyrekUyar(`karaliste:ban-yok:${message.platform}`, `[Kara liste] ${message.platform} adaptöründe kalıcı ban yok`);
      return;
    }
    const sonuc = await p.banUser(hedef, `Kara liste: ${sebep}`.slice(0, 100));
    if (sonuc?.ok) {
      shieldModeService.addAuditLog('SHARED_BAN_ENFORCED', 'Kara liste', `${message.platform} platformunda kalıcı banlandı. Sebep: ${sebep}`, hedef, 'danger');
    } else {
      const hata = sonuc?.hata || 'bilinmeyen hata';
      shieldModeService.addAuditLog('SHARED_BAN_FAILED', 'Kara liste', `${message.platform} banı uygulanamadı: ${hata}`, hedef, 'warn');
      eventBus.emitSendError(message.platform, `Kara liste banı uygulanamadı (@${hedef}): ${hata}`);
    }
    return;
  }

  if (plan.sil) {
    const mesajId = (message as any).id || (message as any).messageId;
    if (typeof p?.deleteMessage !== 'function' || !mesajId) return;
    const sonuc = await p.deleteMessage(String(mesajId));
    if (!sonuc?.ok) {
      seyrekUyar(`karaliste:sil:${message.platform}`, `[Kara liste] ${message.platform} mesajı silinemedi`, sonuc?.hata);
    }
  }
}
