/**
 * AxBoT — uyarı kuyruğu durum makinesi
 * Developed by AxthrowA
 *
 * Denetimde bulundu (CURRENT_SYSTEM_AUDIT §11.5): `AlertBoxWidget`
 * `queueEnabled` ve `gapMs` ayarlarına sahipti ama **gerçek bir kuyruk
 * motoru yoktu**. Arka arkaya gelen iki olay birbirini eziyordu.
 *
 * Ayrıca WebSocket yeniden bağlandığında sunucu son olayları tekrar
 * gönderebiliyor ve aynı uyarı iki kez oynuyordu.
 *
 * Bu modül SAF: zamanlayıcı ve React yok, yalnız durum geçişi. Böylece
 * test edilebilir.
 *
 * Yaşam döngüsü:
 *   queued → entering → visible → exiting → completed
 */

export type UyariAsamasi = 'queued' | 'entering' | 'visible' | 'exiting' | 'completed';

export interface UyariOgesi {
  /** Tekrar oynatmayı önleyen benzersiz kimlik. */
  id: string;
  tur: string;
  veri: any;
  /** Toplam ekranda kalma süresi (giriş + görünür + çıkış). */
  sureMs: number;
  /** Giriş/çıkış animasyonu süresi. */
  animMs: number;
  /** Ses varsa süresi — görünür aşama bundan kısa olamaz. */
  sesMs?: number;
}

export interface KuyrukDurumu {
  bekleyen: UyariOgesi[];
  aktif: UyariOgesi | null;
  asama: UyariAsamasi;
  /** Aktif aşamanın bitiş anı (epoch ms). */
  asamaBitis: number;
  /**
   * Aktif uyarının BAŞLADIĞI an (epoch ms). Metin görünüm penceresi
   * (ms–ms) buna göre ölçülür — aşama bitişine göre ölçmek, uyarı
   * başlar başlamaz ~4,5 sn geçmiş saymaya yol açıyordu.
   */
  aktifBaslangic: number;
}

export const BOS_DURUM: KuyrukDurumu = { bekleyen: [], aktif: null, asama: 'completed', asamaBitis: 0, aktifBaslangic: 0 };

/** Son görülen kimlikler — halka tampon. */
export class GorulenKimlikler {
  private sira: string[] = [];
  private kume = new Set<string>();
  constructor(private tavan = 200) {}

  gorduk(id: string): boolean {
    return this.kume.has(id);
  }

  ekle(id: string): void {
    if (this.kume.has(id)) return;
    this.kume.add(id);
    this.sira.push(id);
    while (this.sira.length > this.tavan) {
      const eski = this.sira.shift()!;
      this.kume.delete(eski);
    }
  }

  get boyut(): number {
    return this.kume.size;
  }
}

/**
 * Görünür aşamanın süresi.
 *
 * Toplam süreden giriş ve çıkış düşülür; ses daha uzunsa ses kadar beklenir
 * (uyarı sesi yarıda kesilmesin).
 */
export function gorunurSure(oge: UyariOgesi): number {
  const anim = Math.max(0, oge.animMs || 0);
  const taban = Math.max(200, (oge.sureMs || 5000) - anim * 2);
  const ses = Math.max(0, oge.sesMs || 0);
  // Ses toplam süreden uzunsa görünür aşama sese uyar.
  return Math.max(taban, ses ? ses - anim : 0);
}

/** Bir aşamanın ne kadar süreceği. */
export function asamaSuresi(oge: UyariOgesi, asama: UyariAsamasi): number {
  if (asama === 'entering' || asama === 'exiting') return Math.max(0, oge.animMs || 0);
  if (asama === 'visible') return gorunurSure(oge);
  return 0;
}

/**
 * Kuyruğa ekler.
 *
 * `kuyrukAcik` false ise bekleyenler tutulmaz: yeni olay mevcut uyarıyı
 * ANINDA değiştirir (örnek alınan botta kuyruk ayarı gözlemlenmedi, bizde seçenek).
 */
export function kuyrugaEkle(
  durum: KuyrukDurumu,
  oge: UyariOgesi,
  kuyrukAcik: boolean,
  simdi = Date.now(),
  duraklatildi = false
): KuyrukDurumu {
  // Ekip denetimiyle duraklatılmışken hiçbir uyarı başlamaz; kuyruk kapalı kipte bile bekletilir
  if (duraklatildi) {
    return { ...durum, bekleyen: [...durum.bekleyen, oge] };
  }
  if (!kuyrukAcik) {
    return {
      bekleyen: [],
      aktif: oge,
      asama: 'entering',
      asamaBitis: simdi + asamaSuresi(oge, 'entering'),
      aktifBaslangic: simdi
    };
  }

  if (!durum.aktif) {
    return {
      bekleyen: durum.bekleyen,
      aktif: oge,
      asama: 'entering',
      asamaBitis: simdi + asamaSuresi(oge, 'entering'),
      aktifBaslangic: simdi
    };
  }

  return { ...durum, bekleyen: [...durum.bekleyen, oge] };
}

/**
 * Zaman ilerlettiğinde bir sonraki duruma geçer.
 *
 * `gapMs` iki uyarı arasındaki boşluk — çıkış bittikten sonra bu kadar
 * beklenir, sonra sıradaki başlar.
 */
export function ilerlet(durum: KuyrukDurumu, gapMs: number, simdi = Date.now(), duraklatildi = false): KuyrukDurumu {
  if (!durum.aktif) {
    // Boştayken bekleyen varsa ve boşluk dolduysa başlat (duraklatılmışsa bekler; ekrandaki uyarı yine biter)
    if (!duraklatildi && durum.bekleyen.length && simdi >= durum.asamaBitis) {
      const [ilk, ...kalan] = durum.bekleyen;
      return {
        bekleyen: kalan,
        aktif: ilk,
        asama: 'entering',
        asamaBitis: simdi + asamaSuresi(ilk, 'entering'),
        aktifBaslangic: simdi
      };
    }
    return durum;
  }

  if (simdi < durum.asamaBitis) return durum;

  const oge = durum.aktif;
  if (durum.asama === 'entering') {
    return { ...durum, asama: 'visible', asamaBitis: simdi + asamaSuresi(oge, 'visible') };
  }
  if (durum.asama === 'visible') {
    return { ...durum, asama: 'exiting', asamaBitis: simdi + asamaSuresi(oge, 'exiting') };
  }
  if (durum.asama === 'exiting') {
    // Bitti: sıradakine geç (boşluk kadar bekleyerek)
    return {
      bekleyen: durum.bekleyen,
      aktif: null,
      asama: 'completed',
      asamaBitis: simdi + Math.max(0, gapMs || 0),
      aktifBaslangic: 0
    };
  }

  return durum;
}

/** Aktif uyarıyı atlar (panelden "atla" düğmesi). */
export function atla(durum: KuyrukDurumu, simdi = Date.now()): KuyrukDurumu {
  if (!durum.aktif) return durum;
  return { ...durum, asama: 'exiting', asamaBitis: simdi };
}

/** Kuyruğu boşaltır. */
export function temizle(durum: KuyrukDurumu): KuyrukDurumu {
  return {
    ...BOS_DURUM,
    aktif: durum.aktif,
    asama: durum.asama,
    asamaBitis: durum.asamaBitis,
    aktifBaslangic: durum.aktifBaslangic
  };
}

/**
 * Metin görünüm penceresi (örnek alınan bot: "Metin görünümü ms – ms").
 * 0–0 = her zaman görünür. Yalnız başlangıç verilirse o andan sonuna kadar,
 * yalnız bitiş verilirse baştan o ana kadar.
 */
export function metinPenceresiAcik(gecenMs: number, basMs: number, bitMs: number): boolean {
  const bas = Math.max(0, Number(basMs) || 0);
  const bit = Math.max(0, Number(bitMs) || 0);
  if (!bas && !bit) return true;
  if (bas && gecenMs < bas) return false;
  if (bit && gecenMs >= bit) return false;
  return true;
}

/**
 * Metnin görünürlüğü bir sonraki kez ne zaman değişir (ms)?
 * Widget tam o anda yeniden çizilsin diye; değişmeyecekse null.
 */
export function sonrakiMetinSiniri(gecenMs: number, basMs: number, bitMs: number): number | null {
  const sinirlar = [Number(basMs) || 0, Number(bitMs) || 0].filter((x) => x > 0 && x > gecenMs);
  if (!sinirlar.length) return null;
  return Math.max(0, Math.min(...sinirlar) - gecenMs);
}

/**
 * Bir sonraki tik ne kadar sonra gerekli?
 * Sürekli `setInterval` yerine tam gerektiğinde uyanmak için.
 */
export function sonrakiTik(durum: KuyrukDurumu, simdi = Date.now()): number | null {
  if (!durum.aktif && !durum.bekleyen.length) return null;
  return Math.max(16, durum.asamaBitis - simdi);
}

/**
 * Olay ayarı mı, genel ayar mı? Her olay kaydı veritabanında hazır değerle (bounce, stacked, shine) gelir;
 * bu yüzden widget'taki genel seçim hiç uygulanmıyordu. Olay yalnız hazır değerden farklıysa kendi seçimidir.
 */
export function olayYoksaGenel(olay: unknown, genel: unknown, hazir: string): string {
  const o = String(olay || '');
  return o && o !== hazir ? o : String(genel || hazir);
}

/** Sunucuya giden kuyruk raporu (U3): panel "sırada ne var" görsün. Değişmediyse aynı `anahtar` döner. */
export function kuyrukRaporu(d: KuyrukDurumu): { anahtar: string; ileti: { action: 'uyari_kuyrugu'; aktif: unknown; bekleyen: unknown[] } } {
  const oge = (o: UyariOgesi) => ({ id: o.id, eventType: o.tur, title: String(o.veri?.title ?? ''), message: String(o.veri?.message ?? ''), isTest: o.veri?.isTest === true });
  const aktif = d.aktif && d.asama !== 'completed' ? oge(d.aktif) : null;
  const bekleyen = d.bekleyen.map(oge);
  return { anahtar: [aktif?.id ?? '-', ...bekleyen.map((b) => b.id)].join('|'), ileti: { action: 'uyari_kuyrugu', aktif, bekleyen } };
}
