/**
 * OBS katman sağlığı: hangi widget sayfası (ör. `alertbox`) şu an bağlı, hangisi koptu.
 * Widget'lar soket adresine `katman=<ad>` ekler; panel bunu "OBS" durum noktasında gösterir.
 */

export interface KatmanSatiri {
  katman: string;
  /** Şu an açık sayfa sayısı (bir sayfa birden çok soket açabilir, bir kez sayılır) */
  bagli: number;
  /** Bunlardan OBS tarayıcı kaynağı olanlar */
  obs: number;
  sonBaglanti: number;
  /** Son kopma anı (hiç kopmadıysa 0) */
  sonKopma: number;
}

/** Yalnız güvenli adlar: küçük harf, rakam, tire (izleyiciye açık bir değer değil ama yine de süzülür) */
export function katmanAdiTemizle(ham: string | null | undefined): string | undefined {
  const s = String(ham || '').trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(s) ? s : undefined;
}

export class KatmanIzleyici {
  private gecmis = new Map<string, { sonBaglanti: number; sonKopma: number }>();

  baglandi(katman: string, simdi = Date.now()) {
    const g = this.gecmis.get(katman) ?? { sonBaglanti: 0, sonKopma: 0 };
    g.sonBaglanti = simdi;
    this.gecmis.set(katman, g);
  }

  koptu(katman: string, simdi = Date.now()) {
    const g = this.gecmis.get(katman);
    if (g) g.sonKopma = simdi;
  }

  /** `acik`: şu an açık bağlantılar (katman adı + OBS mi) */
  durum(acik: Iterable<{ katman?: string; obs?: boolean; sayfa?: string }>): KatmanSatiri[] {
    const sayac = new Map<string, { sayfalar: Set<unknown>; obs: Set<unknown> }>();
    for (const c of acik) {
      if (!c.katman) continue;
      const s = sayac.get(c.katman) ?? { sayfalar: new Set(), obs: new Set() };
      // Sayfa kimliği yoksa (eski widget) her bağlantı ayrı sayılır
      const kim = c.sayfa ?? c;
      s.sayfalar.add(kim);
      if (c.obs) s.obs.add(kim);
      sayac.set(c.katman, s);
    }
    return [...this.gecmis.entries()]
      .map(([katman, g]) => ({ katman, bagli: sayac.get(katman)?.sayfalar.size ?? 0, obs: sayac.get(katman)?.obs.size ?? 0, ...g }))
      .sort((a, b) => a.katman.localeCompare(b.katman));
  }
}
