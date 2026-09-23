/**
 * StreamAxT — yayın durumu yoklayıcısı
 * Developed by AxthrowA
 *
 * `yayinDurumu()` tanımlayan her bağlı platformu (Kick, Twitch, YouTube)
 * dakikada bir sorar ve sonucu canlı durum servisine bildirir. TikTok ve
 * Trovo kendi olaylarıyla bildirdiği için burada yoklanmaz.
 *
 * Bir platform bağlantısı kesilince durumu "bilinmiyor"a çekilir; aksi hâlde
 * kapatılmış bir platform sonsuza dek "yayında" görünebilirdi.
 */
import { platformManager } from '../../platforms/manager.js';
import { canliDurum } from '../../core/live-status.js';

const ARALIK_MS = 60_000;

class CanliYoklayici {
  private zaman: NodeJS.Timeout | null = null;
  private calisiyor = false;

  baslat() {
    if (this.zaman) return;
    // İlk tur, platformlar bağlandıktan biraz sonra
    setTimeout(() => void this.tur(), 5_000);
    this.zaman = setInterval(() => void this.tur(), ARALIK_MS);
  }

  durdur() {
    if (this.zaman) clearInterval(this.zaman);
    this.zaman = null;
  }

  async tur(): Promise<void> {
    if (this.calisiyor) return; // yavaş ağda turlar üst üste binmesin
    this.calisiyor = true;
    try {
      for (const p of platformManager.tumu()) {
        if (typeof p.yayinDurumu !== 'function') continue;
        if (!p.isConnected()) {
          if (canliDurum.platform(p.name)) canliDurum.unut(p.name);
          continue;
        }
        try {
          const b = await p.yayinDurumu();
          if (b) canliDurum.bildir(p.name, b);
        } catch (e: any) {
          console.warn(`[Yayın] ${p.name} durumu okunamadı:`, String(e?.message || e).slice(0, 120));
        }
      }
    } finally {
      this.calisiyor = false;
    }
  }
}

export const canliYoklayici = new CanliYoklayici();
export default canliYoklayici;
