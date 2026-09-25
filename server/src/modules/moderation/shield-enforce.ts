/**
 * StreamAxT — Kalkan modunun uygulanması
 * Developed by AxthrowA
 *
 * Kurallar `shield-rules.ts`'te (saf, testli). Burada: ihlal eden mesaj bot
 * tarafından yok sayılır, sayılır ve — seçiliyse — platformda silinir. OBS
 * sohbet katmanından gizleme `ws/server.ts`'te (`kalkanda` işareti).
 */
import type { ChatMessagePayload } from '../../core/event-bus.js';
import { seyrekUyar } from '../../core/logger.js';
import { platformManager } from '../../platforms/manager.js';
import { yetenek } from '../../platforms/capabilities.js';
import { shieldModeService } from './shield-mode.js';
import { KALKAN_IHLAL_ADI } from './shield-rules.js';

/**
 * Mesaj kalkana takılıyorsa `true` döner (çağıran işlemeyi bırakır). Platform
 * çağrısı beklenmez: baskın anında sohbet işleme hattı ağ isteğiyle tıkanmasın.
 */
export function kalkaniUygula(message: ChatMessagePayload): boolean {
  const ihlal = shieldModeService.ihlal(message);
  if (!ihlal) return false;
  shieldModeService.engellendi();

  if (shieldModeService.getSettings().platformdaSil) {
    if (yetenek(message.platform).moderasyon.mesajSil) void platformdaSil(message, KALKAN_IHLAL_ADI[ihlal]);
    else seyrekUyar(`kalkan:sil-yok:${message.platform}`, `[Kalkan] ${message.platform} mesaj silmeyi desteklemiyor; yalnız yok sayıldı`);
  }
  return true;
}

async function platformdaSil(message: ChatMessagePayload, kural: string): Promise<void> {
  const p: any = platformManager.getPlatform(message.platform);
  const mesajId = (message as any).id || (message as any).messageId;
  if (typeof p?.deleteMessage !== 'function' || !mesajId) return;
  const sonuc = await p.deleteMessage(String(mesajId));
  if (!sonuc?.ok) {
    // Baskında yüzlerce mesaj olabilir: denetim günlüğünü değil, seyrek uyarıyı kullan
    seyrekUyar(`kalkan:sil:${message.platform}`, `[Kalkan] ${message.platform} mesajı silinemedi (${kural})`, sonuc?.hata);
  }
}
