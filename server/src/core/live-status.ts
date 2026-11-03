/**
 * AxBoT — canlı yayın durumu servisi
 * Developed by AxthrowA
 *
 * Her platform yayın durumunu buraya BİLDİRİR (Kick/Twitch/YouTube yoklama
 * ile, TikTok/Trovo kendi olaylarıyla). Servis:
 *   • platform başına son durumu tutar,
 *   • açıldı/kapandı geçişinde `stream_online` / `stream_offline` yayar
 *     (Discord duyurusu, erişim kipli komutlar bunu kullanır),
 *   • her değişimde `stream_status` yayar (panel canlı gösterir),
 *   • `!uptime` için gerçek yayın başlangıcını verir.
 *
 * Saf hesaplar `live-status-math.ts`'te.
 */
import { eventBus } from './event-bus.js';
import { gecis, genelDurum, type GenelDurum, type PlatformYayinDurumu, type YayinBilgisi } from './live-status-math.js';

export * from './live-status-math.js';

class CanliYayinDurumu {
  private durumlar = new Map<string, PlatformYayinDurumu>();

  /** Bir platformun güncel durumunu işler. */
  bildir(platform: string, b: YayinBilgisi): void {
    const p = String(platform || '').toLowerCase();
    if (!p) return;
    const onceki = this.durumlar.get(p);

    const yeni: PlatformYayinDurumu = {
      platform: p,
      canli: !!b.canli,
      baslangic: b.canli ? (b.baslangic ?? onceki?.baslangic ?? null) : null,
      izleyici: b.canli ? Math.max(0, Number(b.izleyici) || 0) : 0,
      baslik: String(b.baslik ?? onceki?.baslik ?? ''),
      kategori: String(b.kategori ?? onceki?.kategori ?? ''),
      yayinId: b.canli ? String(b.yayinId ?? onceki?.yayinId ?? '') : '',
      kanal: String(b.kanal ?? onceki?.kanal ?? ''),
      guncelleme: Date.now()
    };
    this.durumlar.set(p, yeni);

    const g = gecis(onceki?.canli, yeni.canli);
    if (g === 'acildi') {
      console.log(`[Yayın] ${p} AÇIK${yeni.kanal ? ` (${yeni.kanal})` : ''}`);
      eventBus.emit('stream_online', {
        platform: p,
        channel: yeni.kanal,
        yayinId: yeni.yayinId,
        baslangic: yeni.baslangic,
        // Bot yayın ortasında açıldıysa ilk gözlem de "açıldı" sayılır;
        // tekrar duyuruyu yayın kimliği engeller.
        ilkGozlem: !onceki,
        timestamp: Date.now()
      });
    } else if (g === 'kapandi') {
      console.log(`[Yayın] ${p} KAPANDI`);
      eventBus.emit('stream_offline', { platform: p, channel: yeni.kanal, timestamp: Date.now() });
    }

    const degisti =
      !onceki ||
      onceki.canli !== yeni.canli ||
      onceki.izleyici !== yeni.izleyici ||
      onceki.baslik !== yeni.baslik ||
      onceki.kategori !== yeni.kategori;
    if (degisti) eventBus.emit('stream_status', this.ozet());
  }

  /** Platform bağlantısı kesildi: durumu bilinmez sayılır. */
  unut(platform: string): void {
    const p = String(platform || '').toLowerCase();
    const onceki = this.durumlar.get(p);
    if (!onceki) return;
    this.durumlar.delete(p);
    if (onceki.canli) eventBus.emit('stream_offline', { platform: p, channel: onceki.kanal, timestamp: Date.now() });
    eventBus.emit('stream_status', this.ozet());
  }

  genel(): GenelDurum {
    return genelDurum([...this.durumlar.values()]);
  }

  platform(p: string): PlatformYayinDurumu | undefined {
    return this.durumlar.get(String(p || '').toLowerCase());
  }

  ozet(): GenelDurum & { platformlar: PlatformYayinDurumu[] } {
    return { ...this.genel(), platformlar: [...this.durumlar.values()] };
  }

  /** Testler için. */
  sifirla(): void {
    this.durumlar.clear();
  }
}

export const canliDurum = new CanliYayinDurumu();
export default canliDurum;
