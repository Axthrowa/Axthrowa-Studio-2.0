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

/**
 * Şans oyunlarının oranları. Ortalama geri dönüş bahsin ~%92-96'sı: eskiden slot %116, kasa %165,
 * soygun ~%200 veriyordu ve izleyiciler oynayarak sınırsız puan basabiliyordu. Değişiklik `oranlar.test.ts`'ten geçmeli.
 */
export const SLOT_UCLU_CARPAN = 6; // üç aynı simge (olasılık 1/25), bahsin katı olarak geri ödeme
export const SLOT_IKILI_CARPAN = 1.5; // iki aynı simge (olasılık 12/25)
export const YARIS_TEK_KAZANMA = 0.48; // tek yarışçı: kazanırsa bahsin 2 katı
export const BOMBA_CARPANI = 2.85; // 3 kablodan doğrusu: bahsin katı
/** Soygun: başarı = taban + kişi başı %2 (en çok 3 kişi); kazanan bahsini + bahis×kar alır */
export const SOYGUN_EKIP_BONUSU = 0.02;
export const SOYGUN_EKIP_UST = 3;
export const SOYGUN_HEDEFLERI = [
  { name: 'Kuyumcu Dükkanı', multiplier: 0.5, baseSuccess: 0.6 },
  { name: 'Merkez Bankası Kasası', multiplier: 1.15, baseSuccess: 0.4 },
  { name: 'Zırhlı Para Taşıma Aracı', multiplier: 0.75, baseSuccess: 0.5 },
  { name: 'Şehir Kumarhanesi', multiplier: 1.4, baseSuccess: 0.35 },
  { name: 'Dünya Elmas Borsası', multiplier: 2.2, baseSuccess: 0.25 }
];
/** Kasa açma: [üst sınır %, kasa bedelinin katı]; son dilim ayarlardaki ikramiye çarpanını (varsayılan 10) kullanır */
export const KASA_DILIMLERI = { siradan: [55, 0.3], nadir: [83, 1.1], epik: [98, 1.8] } as const;
