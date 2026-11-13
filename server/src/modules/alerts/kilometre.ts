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

/** Uyarı metni: takip/abone için kişiyi, Kicks için toplamı öne çıkarır. */
export function kilometreMetni(tur: KilometreTuru, esik: number, kisi: string): string {
  return tur === 'kicks' ? `Bu yayında ${esik} Kicks toplandı! Son gönderen: ${kisi}` : `Bu yayının ${esik}. ${AD[tur]}: ${kisi}!`;
}
