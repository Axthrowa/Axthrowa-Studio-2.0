/**
 * Sohbet oyunlarının bahis miktarı: "hepsi"/sayı okuma, en az/en çok ve bakiye denetimi.
 * Eskiden soygun, yarış, yazı-tura, zar ve rulette ayrı ayrı kopyalanmıştı.
 */
export interface BahisKurali {
  /** Mesajdaki ad (`@kisi`) */
  kisi: string;
  /** Geçersiz girdide yazılacak açıklama + örnek */
  ornek: string;
  /** "minimum <ad>: X Puan" iletisindeki ad (ör. "soygun bahsi") */
  ad?: string;
  /** Miktar yazılmazsa; yoksa geçersiz sayılır */
  varsayilan?: number;
  min?: number;
  max?: number;
  /** "hepsi" en az bu kadar (soygun/yarış 10) */
  hepsiEnAz?: number;
}

export type BahisSonucu = { miktar: number } | { hata: string };

export function bahisOku(girdi: string | undefined, puan: number, k: BahisKurali): BahisSonucu {
  const g = girdi?.toLowerCase();
  let miktar: number;
  if (g === 'hepsi' || g === 'all') miktar = Math.max(k.hepsiEnAz ?? 0, puan);
  else if (g) miktar = parseInt(g, 10);
  else miktar = k.varsayilan ?? NaN;

  if (!Number.isFinite(miktar) || miktar <= 0) return { hata: `@${k.kisi}, ${k.ornek}` };
  if (k.min && miktar < k.min) return { hata: `@${k.kisi}, minimum ${k.ad ?? 'bahis'}: ${k.min} Puan!` };
  if (k.max && miktar > k.max) return { hata: `@${k.kisi}, maksimum ${k.ad ?? 'bahis'}: ${k.max} Puan!` };
  if (puan < miktar) return { hata: `@${k.kisi}, yeterli puanın yok! Bakiyen: ${puan} 💰` };
  return { miktar };
}
