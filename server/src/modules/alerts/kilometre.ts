/**
 * Oturum kilometre taşları (B4): yayın içinde 10., 25., 50., 100. takipçi ve abone; Kicks toplamı 100, 500,
 * 1000, 5000. Eşik geçilince ayrı "milestone" uyarısı çıkar. Yayın başlayınca sıfırlanır.
 * Saf: yalnız sayar ve geçilen eşikleri söyler.
 */
export type KilometreTuru = 'follow' | 'sub' | 'kicks';

export const ESIKLER: Record<KilometreTuru, readonly number[]> = {
  follow: [10, 25, 50, 100],
  sub: [10, 25, 50, 100],
  kicks: [100, 500, 1000, 5000]
};

const AD: Record<KilometreTuru, string> = { follow: 'takipçi', sub: 'abone', kicks: 'Kicks' };

export class OturumSayaci {
  private toplam: Record<KilometreTuru, number> = { follow: 0, sub: 0, kicks: 0 };

  /** `baslangic`: önceki çalışmadan kalan toplamlar (K3); bozuk alan 0 sayılır */
  constructor(baslangic?: unknown) {
    const b = (baslangic ?? {}) as Record<string, unknown>;
    for (const t of Object.keys(this.toplam) as KilometreTuru[]) {
      const v = Math.floor(Number(b[t]));
      if (v > 0) this.toplam[t] = v;
    }
  }

  durum(): Record<KilometreTuru, number> {
    return { ...this.toplam };
  }

  /** Miktarı ekler; bu eklemeyle geçilen eşikleri (küçükten büyüğe) döndürür. */
  ekle(tur: KilometreTuru, miktar: number): number[] {
    const m = Math.max(0, Math.floor(Number(miktar) || 0));
    if (!m) return [];
    const once = this.toplam[tur];
    this.toplam[tur] = once + m;
    return ESIKLER[tur].filter((e) => once < e && e <= once + m);
  }

  sifirla() {
    this.toplam = { follow: 0, sub: 0, kicks: 0 };
  }
}

/**
 * K3: yayın açıldı olayında sayaç sıfırlanmalı mı? Bot yayın ortasında yeniden başladıysa (ilk gözlem)
 * ve yayın bilinen bir yayınsa sayım sürer; arada yeni yayın başladıysa ya da bot zaten açıkken açıldıysa sıfırlanır.
 */
export function kilometreSifirlansinMi(p: { platform?: string; yayinId?: string; baslangic?: unknown; ilkGozlem?: boolean }, bilinenler: string[]): { sifirla: boolean; anahtar: string } {
  const kimlik = p.yayinId || (p.baslangic ? String(p.baslangic) : '');
  const anahtar = kimlik ? `${p.platform || ''}:${kimlik}` : '';
  if (p.ilkGozlem && (!anahtar || bilinenler.includes(anahtar))) return { sifirla: false, anahtar };
  return { sifirla: true, anahtar };
}

/** Uyarı metni: takip/abone için kişiyi, Kicks için toplamı öne çıkarır. */
export function kilometreMetni(tur: KilometreTuru, esik: number, kisi: string): string {
  return tur === 'kicks' ? `Bu yayında ${esik} Kicks toplandı! Son gönderen: ${kisi}` : `Bu yayının ${esik}. ${AD[tur]}: ${kisi}!`;
}
