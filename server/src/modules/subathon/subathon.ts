/**
 * StreamAxT — Subathon motoru (sunucu tarafı)
 * Developed by AxthrowA
 *
 * Kullanıcı bildirdi: "subathon ayarları hala yok; abone, hediye, bağış
 * geldiğinde ne kadar süre artacağını ben ayarlayabileyim; hediyeyi Kick ile
 * değiştir; gelen abonelik, bağış, KICKs otomatik olarak süreye eklensin."
 *
 * Önceki durum: sayaç tamamen TARAYICIDA yaşıyordu (`SubathonWidget`).
 * Sonuçları:
 *   - İki OBS kaynağı açılırsa iki FARKLI sayaç görünüyordu
 *   - Panel sayacı göremiyordu, elle süre ekleyemiyordu
 *   - Tarayıcı kapanınca durum `localStorage`'a kalıyordu, sunucu bilmiyordu
 *   - KICKs olayı veri yolunda hiç yoktu, dolayısıyla asla eklenmiyordu
 *
 * Artık tek doğru kaynak burası. Widget yalnız gösterir.
 */
import { hediyeAdedi, eventBus } from '../../core/event-bus.js';
import { db } from '../../db/index.js';
import { seyrekUyar } from '../../core/logger.js';

export interface SubathonAyarlari {
  /** Sayaç açık mı — kapalıyken olaylar süreye eklenmez. */
  aktif: boolean;
  /** Sayaç sıfırdan başlatıldığında verilecek süre (dakika). */
  baslangicDakika: number;
  /** Bir abonelik kaç dakika ekler. */
  aboneDakika: number;
  /** Hediye abonelik başına dakika (Kick'te "gifted sub"). */
  hediyeAboneDakika: number;
  /** `bagisBirimi` kadar bağış başına dakika. */
  bagisDakika: number;
  bagisBirimi: number;
  /** `kicksBirimi` kadar KICKs başına dakika. */
  kicksDakika: number;
  kicksBirimi: number;
  /** Takip başına dakika (0 = takip süre eklemez). */
  takipDakika: number;
  /** Üst sınır (saat). 0 = sınırsız. */
  maksSaat: number;
}

export const VARSAYILAN_AYAR: SubathonAyarlari = {
  aktif: false,
  baslangicDakika: 120,
  aboneDakika: 5,
  hediyeAboneDakika: 5,
  bagisDakika: 10,
  bagisBirimi: 50,
  kicksDakika: 1,
  kicksBirimi: 100,
  takipDakika: 1,
  maksSaat: 24
};

export interface SubathonDurumu {
  aktif: boolean;
  /** Duraklatıldı: kalan süre saklı, "Devam et" ile kaldığı yerden sürer. */
  duraklatildi: boolean;
  /** Bitiş anı (epoch ms). Aktif değilse 0. */
  bitisAni: number;
  kalanSaniye: number;
  /** Bu oturumda eklenen toplam saniye. */
  eklenenSaniye: number;
  sonEkleme: { metin: string; saniye: number; zaman: number } | null;
  ayar: SubathonAyarlari;
}

const AYAR_ANAHTARI = 'subathon_settings';
const DURUM_ANAHTARI = 'subathon_state';

/** Bağış/KICKs tutarını dakikaya çevirir. Birim kadarı başına `dakika`. */
export function birimDakikasi(tutar: number, dakika: number, birim: number): number {
  const b = Math.max(1, Number(birim) || 1);
  const adet = Math.floor(Math.max(0, Number(tutar) || 0) / b);
  return adet * Math.max(0, Number(dakika) || 0);
}

/** Hediye abone adedine göre dakika. */
export function hediyeDakikasi(adet: number, dakika: number): number {
  return Math.max(1, Math.floor(Number(adet) || 1)) * Math.max(0, Number(dakika) || 0);
}

/** Üst sınırı aşmayacak yeni bitiş anı. */
export function yeniBitis(mevcutBitis: number, eklenenSn: number, maksSaat: number, simdi = Date.now()): number {
  const taban = Math.max(mevcutBitis, simdi);
  const hedef = taban + Math.max(0, eklenenSn) * 1000;
  const tavan = Math.max(0, Number(maksSaat) || 0) * 3600 * 1000;
  if (!tavan) return hedef;
  return Math.min(hedef, simdi + tavan);
}

class SubathonMotoru {
  private durum: { aktif: boolean; bitisAni: number; eklenenSaniye: number; duraklatildi?: boolean; kalanSn?: number } = {
    aktif: false,
    bitisAni: 0,
    eklenenSaniye: 0
  };
  private sonEkleme: SubathonDurumu['sonEkleme'] = null;
  private yayinla: ((tip: string, veri: any) => void) | null = null;
  private tik: NodeJS.Timeout | null = null;

  /** WS yayıncısını bağlar (döngüsel bağımlılık olmasın diye dışarıdan verilir). */
  yayinciBagla(fn: (tip: string, veri: any) => void) {
    this.yayinla = fn;
  }

  ayarOku(): SubathonAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) return { ...VARSAYILAN_AYAR, ...JSON.parse(r.value) };
    } catch {
      /* bozuk JSON — varsayılana dön */
    }
    return { ...VARSAYILAN_AYAR };
  }

  ayarYaz(yeni: Partial<SubathonAyarlari>): SubathonAyarlari {
    const birlesik = { ...this.ayarOku(), ...yeni };
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(birlesik));
    this.durumYayinla();
    return birlesik;
  }

  private durumuKaydet() {
    try {
      db.prepare(
        'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).run(DURUM_ANAHTARI, JSON.stringify(this.durum));
    } catch (e) {
      /* yazılamadı — bellekte devam; yeniden başlatmada son kayıtlı süre döner */
      seyrekUyar('subathon:yaz', '[Subathon] Durum diske yazılamadı — bellekte devam ediyor', e, 30_000);
    }
  }

  private durumuYukle() {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(DURUM_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) {
        const d = JSON.parse(r.value);
        this.durum = {
          aktif: Boolean(d.aktif),
          bitisAni: Number(d.bitisAni) || 0,
          eklenenSaniye: Number(d.eklenenSaniye) || 0,
          duraklatildi: Boolean(d.duraklatildi),
          kalanSn: Math.max(0, Number(d.kalanSn) || 0)
        };
        // Bot kapalıyken süre akmaz: kapanmadan önce saklanan kalan süreyle duraklatılmış açılır,
        // yayıncı "Kaldığı yerden başlat" ile sürdürür. Eskiden bitiş mutlak saatti; kapalıyken
        // süre doluyor ve sayaç sıfırlanıyordu.
        if (this.durum.aktif) {
          this.durum.aktif = false;
          this.durum.duraklatildi = (this.durum.kalanSn || 0) > 0;
          this.durum.bitisAni = 0;
        }
      }
    } catch {
      /* bozuk kayıt */
    }
  }

  durumAl(): SubathonDurumu {
    const ayar = this.ayarOku();
    const kalan = this.durum.aktif
      ? Math.max(0, Math.round((this.durum.bitisAni - Date.now()) / 1000))
      : this.durum.duraklatildi
        ? this.durum.kalanSn || 0
        : 0;
    return {
      aktif: this.durum.aktif,
      duraklatildi: !this.durum.aktif && !!this.durum.duraklatildi,
      bitisAni: this.durum.bitisAni,
      kalanSaniye: kalan,
      eklenenSaniye: this.durum.eklenenSaniye,
      sonEkleme: this.sonEkleme,
      ayar
    };
  }

  private durumYayinla() {
    this.yayinla?.('subathon_state', this.durumAl());
  }

  baslat(dakika?: number): SubathonDurumu {
    const ayar = this.ayarOku();
    const sure = Math.max(1, Number(dakika ?? ayar.baslangicDakika) || 1);
    this.durum = { aktif: true, bitisAni: Date.now() + sure * 60000, eklenenSaniye: 0, duraklatildi: false, kalanSn: sure * 60 };
    this.sonEkleme = null;
    this.ayarYaz({ aktif: true });
    this.durumuKaydet();
    this.durumYayinla();
    console.log(`[Subathon] başlatıldı: ${sure} dakika`);
    return this.durumAl();
  }

  /** Duraklatır: kalan süre saklanır (sıfırlanmaz); `devam` kaldığı yerden sürdürür. */
  durdur(): SubathonDurumu {
    if (this.durum.aktif) {
      this.durum.kalanSn = Math.max(0, Math.round((this.durum.bitisAni - Date.now()) / 1000));
      this.durum.duraklatildi = this.durum.kalanSn > 0;
    }
    this.durum.aktif = false;
    this.ayarYaz({ aktif: false });
    this.durumuKaydet();
    this.durumYayinla();
    return this.durumAl();
  }

  /** Duraklatılmış sayacı saklı kalan süreyle sürdürür (önceki yayından kalan dahil). */
  devam(): SubathonDurumu {
    const kalan = this.durum.kalanSn || 0;
    if (this.durum.aktif || !this.durum.duraklatildi || kalan <= 0) return this.durumAl();
    this.durum = { ...this.durum, aktif: true, duraklatildi: false, bitisAni: Date.now() + kalan * 1000 };
    this.ayarYaz({ aktif: true });
    this.durumuKaydet();
    this.durumYayinla();
    return this.durumAl();
  }

  /** Sayacı tamamen sıfırlar (saklı süre de silinir). */
  sifirla(): SubathonDurumu {
    this.durum = { aktif: false, bitisAni: 0, eklenenSaniye: 0, duraklatildi: false, kalanSn: 0 };
    this.sonEkleme = null;
    this.ayarYaz({ aktif: false });
    this.durumuKaydet();
    this.durumYayinla();
    return this.durumAl();
  }

  /** Elle veya olayla süre ekler. Negatif değer süre düşer. */
  sureEkle(saniye: number, metin: string): SubathonDurumu {
    const ayar = this.ayarOku();
    const sn = Math.round(Number(saniye) || 0);
    if (!sn) return this.durumAl();

    // Sayaç kapalıyken gelen destek süreyi BAŞLATMAZ; yayıncı kendi başlatır.
    if (!this.durum.aktif) return this.durumAl();

    this.durum.bitisAni = yeniBitis(this.durum.bitisAni, sn, ayar.maksSaat);
    this.durum.kalanSn = Math.max(0, Math.round((this.durum.bitisAni - Date.now()) / 1000));
    this.durum.eklenenSaniye += Math.max(0, sn);
    this.sonEkleme = { metin, saniye: sn, zaman: Date.now() };

    this.durumuKaydet();
    this.durumYayinla();
    return this.durumAl();
  }

  /**
   * Olay dinleyicilerini bağlar. Abone / hediye abone / bağış / KICKs
   * otomatik olarak süreye eklenir — kullanıcının istediği davranış.
   */
  baglaOlaylar() {
    const ayar = () => this.ayarOku();

    eventBus.on('sub', (p: any) => {
      const a = ayar();
      // Test uyarısı açık subathon'a gerçek süre eklemesin
      if (!a.aktif || (p as any)?.isTest === true) return;
      const ad = p?.displayName || p?.username || 'İzleyici';
      if (p?.isGift) {
        // Kick'te hediye abonelik birden çok kişiye olabilir
        const adet = hediyeAdedi(p);
        const dk = hediyeDakikasi(adet, a.hediyeAboneDakika);
        if (dk > 0) this.sureEkle(dk * 60, `+${dk} dk · ${adet} hediye abone (${ad})`);
      } else {
        if (a.aboneDakika > 0) this.sureEkle(a.aboneDakika * 60, `+${a.aboneDakika} dk · abone (${ad})`);
      }
    });

    eventBus.on('tip', (p: any) => {
      const a = ayar();
      if (!a.aktif || (p as any)?.isTest === true) return;
      const dk = birimDakikasi(p?.amount, a.bagisDakika, a.bagisBirimi);
      if (dk > 0) {
        const ad = p?.displayName || p?.username || 'İzleyici';
        this.sureEkle(dk * 60, `+${dk} dk · ${p?.amount}${p?.currency || ''} bağış (${ad})`);
      }
    });

    eventBus.on('follow', (p: any) => {
      const a = ayar();
      if (!a.aktif || (p as any)?.isTest === true || !(a.takipDakika > 0)) return;
      const ad = p?.displayName || p?.username || 'İzleyici';
      this.sureEkle(a.takipDakika * 60, `+${a.takipDakika} dk · takip (${ad})`);
    });

    eventBus.on('kicks', (p: any) => {
      const a = ayar();
      if (!a.aktif || (p as any)?.isTest === true) return;
      const dk = birimDakikasi(p?.amount, a.kicksDakika, a.kicksBirimi);
      if (dk > 0) {
        const ad = p?.displayName || p?.username || 'İzleyici';
        this.sureEkle(dk * 60, `+${dk} dk · ${p?.amount} KICKs (${ad})`);
      }
    });

    // Saniyede bir değil, 5 saniyede bir yayınla: widget kendi saniyesini
    // sayar, sunucu yalnız doğru bitiş anını bildirir.
    if (this.tik) clearInterval(this.tik);
    this.tik = setInterval(() => {
      if (!this.durum.aktif) return;
      if (this.durum.bitisAni <= Date.now()) {
        this.durum.aktif = false;
        this.durum.duraklatildi = false;
        this.durum.kalanSn = 0;
        this.durumuKaydet();
        console.log('[Subathon] süre doldu');
      } else {
        // Kalan süre 5 sn'de bir saklanır: bot kapanırsa açılışta buradan sürer
        this.durum.kalanSn = Math.max(0, Math.round((this.durum.bitisAni - Date.now()) / 1000));
        this.durumuKaydet();
      }
      this.durumYayinla();
    }, 5000);
  }

  baslangic() {
    this.durumuYukle();
    this.baglaOlaylar();
  }

  durdurTik() {
    if (this.tik) clearInterval(this.tik);
    this.tik = null;
  }
}

export const subathon = new SubathonMotoru();
export default subathon;
