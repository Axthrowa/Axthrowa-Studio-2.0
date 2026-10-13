/**
 * StreamAxT — Hype Treni (sunucu)
 * Developed by AxthrowA
 *
 * Denetim B3: Hype Treni durumu her OBS tarayıcı kaynağında AYRI tutuluyordu.
 * İki sahnede iki kaynak açık olunca iki farklı tren görünüyor, kaynak
 * yenilenince (OBS sahne geçişi, önbellek temizliği) tren sıfırlanıyordu.
 * Subathon'da olduğu gibi durum artık sunucuda; widget yalnız gösterir.
 *
 * Girdi: ws/server'ın yayınladığı HER uyarı (`uyari_yayinlandi`) — widget
 * eskiden tam olarak bunu dinliyordu, anlam birebir korunur.
 * Çıktı: `hype_state` (widget_update üzerinden tüm istemcilere).
 */
import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';
import { HYPE_VARSAYILAN, olayPuani, seviyeHedefi, seviyeIlerlet, type HypeAyari } from './hype-math.js';

export * from './hype-math.js';

const AYAR_ANAHTARI = 'widget_settings_hype-train';

export interface HypeDurumu {
  aktif: boolean;
  seviye: number;
  puan: number;
  hedef: number;
  bitisAni: number;
  sonDestek: string | null;
  /** Test gösterimi: widget birkaç saniye sonra gerçek duruma döner. */
  test?: boolean;
}

class HypeTreni {
  private aktif = false;
  private seviye = 1;
  private puan = 0;
  private bitisAni = 0;
  private sonDestek: string | null = null;
  private zaman: NodeJS.Timeout | null = null;

  ayarOku(): HypeAyari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value?: string }
        | undefined;
      const k = r?.value ? JSON.parse(r.value) : {};
      const a = { ...HYPE_VARSAYILAN } as any;
      for (const alan of Object.keys(HYPE_VARSAYILAN)) {
        const n = Number(k[alan]);
        if (k[alan] !== undefined && k[alan] !== '' && Number.isFinite(n)) a[alan] = n;
      }
      return a;
    } catch {
      return { ...HYPE_VARSAYILAN };
    }
  }

  durum(): HypeDurumu {
    const a = this.ayarOku();
    return {
      aktif: this.aktif,
      seviye: this.seviye,
      puan: this.puan,
      hedef: seviyeHedefi(this.seviye, a.levelGoal, a.levelGrowth),
      bitisAni: this.aktif ? this.bitisAni : 0,
      sonDestek: this.sonDestek
    };
  }

  private yayinla(d: HypeDurumu = this.durum()) {
    eventBus.emit('widget_update', { type: 'hype_state', data: d });
  }

  /** Bir uyarı olayı: puan ekler, süreyi tazeler, seviye atlatır. */
  olay(subType: string, data: any): number {
    const a = this.ayarOku();
    const eklenen = olayPuani(subType, data, a);
    if (eklenen <= 0) return 0;

    const ad = data?.displayName || data?.username || 'İzleyici';
    const sonuc = seviyeIlerlet(this.seviye, this.puan, eklenen, a);
    this.seviye = sonuc.seviye;
    this.puan = sonuc.puan;
    this.sonDestek = `${ad} · +${eklenen}`;
    this.aktif = true;
    this.bitisAni = Date.now() + Math.max(10, a.windowSeconds) * 1000;

    if (this.zaman) clearTimeout(this.zaman);
    this.zaman = setTimeout(() => this.sifirla(), Math.max(10, a.windowSeconds) * 1000);

    this.yayinla();
    return eklenen;
  }

  sifirla() {
    if (this.zaman) clearTimeout(this.zaman);
    this.zaman = null;
    this.aktif = false;
    this.seviye = 1;
    this.puan = 0;
    this.bitisAni = 0;
    this.sonDestek = null;
    this.yayinla();
  }

  /**
   * Widget "Test" düğmesi: gerçek treni DEĞİŞTİRMEDEN örnek bir durum
   * gösterir; widget birkaç saniye sonra gerçek duruma döner.
   */
  testGoster() {
    const a = this.ayarOku();
    const hedef = seviyeHedefi(3, a.levelGoal, a.levelGrowth);
    this.yayinla({
      aktif: true,
      seviye: 3,
      puan: Math.round(hedef * 0.65),
      hedef,
      bitisAni: Date.now() + 180_000,
      sonDestek: 'Test_Destekci · +100',
      test: true
    });
  }

  baglaOlaylar() {
    eventBus.on('uyari_yayinlandi', (p: any) => {
      try {
        this.olay(String(p?.subType || ''), p?.data);
      } catch (e) {
        console.warn('[HypeTreni] olay işlenemedi:', e);
      }
    });
  }
}

export const hypeTreni = new HypeTreni();
export default hypeTreni;
