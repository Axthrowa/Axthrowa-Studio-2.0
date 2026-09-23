/**
 * StreamAxT — durum değişince panele anında gönderme
 * Developed by AxthrowA
 *
 * Etkileşim ekranı (tahmin / kuyruk / puan düşüşü) durumu 2-4 sn'de bir
 * YOKLAYARAK öğreniyordu: gecikmeli görünüyor ve panel açıkken sürekli
 * istek atıyordu (KNOWN_LIMITATIONS C12). Artık durum değiştiren her
 * yöntemden sonra güncel durum WebSocket ile yayınlanır; panel yoklamayı
 * yalnız yedek olarak ve seyrek yapar.
 *
 * Yayın 50 ms birleştirilir: puan düşüşünde onlarca izleyici aynı anda
 * yazınca her mesaj için ayrı yayın yapılmasın.
 */
import { eventBus } from './event-bus.js';

/** Birleştirilmiş (debounce) durum yayıncısı üretir. */
export function durumYayinci(tip: string, oku: () => unknown, gecikmeMs = 50): () => void {
  let zaman: NodeJS.Timeout | null = null;
  return () => {
    if (zaman) return;
    zaman = setTimeout(() => {
      zaman = null;
      try {
        // ws/server `widget_update` olayını tüm istemcilere iletir
        eventBus.emit('widget_update', { type: tip, data: oku() });
      } catch (e) {
        console.warn(`[Durum] ${tip} yayınlanamadı:`, e);
      }
    }, gecikmeMs);
  };
}

/**
 * Verilen yöntemleri, çalıştıktan sonra `bildir` çağıracak şekilde sarar.
 * Örneğin kendi içinden `this.bitir()` diyen zamanlayıcı da sarılmış
 * yöntemi çağırır (örnek özelliği prototipi gölgeler) — hiçbir yol kaçmaz.
 */
export function degisinceBildir<T extends object>(nesne: T, yontemler: Array<keyof T & string>, bildir: () => void): void {
  for (const ad of yontemler) {
    const asil = (nesne as any)[ad];
    if (typeof asil !== 'function') continue;
    (nesne as any)[ad] = function (this: unknown, ...argumanlar: unknown[]) {
      const sonuc = asil.apply(nesne, argumanlar);
      try {
        bildir();
      } catch {
        /* bildirim hatası asıl işi bozmasın */
      }
      return sonuc;
    };
  }
}
