/**
 * StreamAxT — tahmin hesapları (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK: test edilebilir olsun ve test koşarken çalışan
 * sunucunun SQLite kilidine takılmasın diye ayrıldı.
 */

export type TahminDurumu = 'acik' | 'kilitli' | 'kapandi' | 'iptal';

export interface Tahmin {
  id: string;
  baslik: string;
  secenekler: string[];
  durum: TahminDurumu;
  kazananIndex: number | null;
  acilis: number;
  kapanis: number | null;
  /** Otomatik kilitlenme anı (epoch ms); yoksa elle kilitlenir. */
  kilitAni: number | null;
}

export interface TahminBahsi {
  kullanici: string;
  gorunenAd: string;
  secenekIndex: number;
  puan: number;
}

/**
 * Havuz dağıtımı.
 *
 * Kazananlar TÜM havuzu (kaybedenlerin puanı dahil) kendi bahis oranlarına
 * göre bölüşür. Kuruş farkları kaybolmasın diye artık en çok bahis yapana
 * verilir.
 */
export function odulDagit(
  bahisler: TahminBahsi[],
  kazananIndex: number
): Array<{ kullanici: string; kazanc: number }> {
  const toplamHavuz = bahisler.reduce((t, b) => t + Math.max(0, b.puan), 0);
  const kazananlar = bahisler.filter((b) => b.secenekIndex === kazananIndex && b.puan > 0);
  if (!kazananlar.length || toplamHavuz <= 0) {
    // Kazanan yoksa herkese iade — puan buharlaşmasın
    return bahisler.map((b) => ({ kullanici: b.kullanici, kazanc: Math.max(0, b.puan) }));
  }

  const kazananToplam = kazananlar.reduce((t, b) => t + b.puan, 0);
  const sonuc = kazananlar.map((b) => ({
    kullanici: b.kullanici,
    kazanc: Math.floor((b.puan / kazananToplam) * toplamHavuz)
  }));

  // Yuvarlamadan artan puanı en büyük bahse ekle
  const dagitilan = sonuc.reduce((t, s) => t + s.kazanc, 0);
  const artan = toplamHavuz - dagitilan;
  if (artan > 0 && sonuc.length) {
    const enBuyuk = kazananlar.reduce((a, b) => (b.puan > a.puan ? b : a));
    const hedef = sonuc.find((s) => s.kullanici === enBuyuk.kullanici);
    if (hedef) hedef.kazanc += artan;
  }

  return sonuc;
}

/**
 * Türkçe metni karşılaştırma için normalleştirir.
 *
 * Gerekçe: `'HAYIR'.toLowerCase()` JavaScript'te `'hayir'` verir ama
 * `'Hayır'.toLowerCase()` `'hayır'` verir — noktasız ı yüzünden büyük
 * harfle yazan izleyicinin oyu EŞLEŞMİYORDU. Ayrıca Türkçe klavyesi
 * olmayan izleyici "hayir" yazar. İkisi de kabul edilmeli.
 */
export function trKarsilastir(metin: string): string {
  return String(metin || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

/** Seçenek adından index. `yes`, `1`, tam ad veya baş harf kabul edilir. */
export function secenekBul(secenekler: string[], girdi: string): number {
  const g = trKarsilastir(girdi);
  if (!g) return -1;

  const sayi = Number(g);
  if (Number.isInteger(sayi) && sayi >= 1 && sayi <= secenekler.length) return sayi - 1;

  const tam = secenekler.findIndex((s) => trKarsilastir(s) === g);
  if (tam >= 0) return tam;

  return secenekler.findIndex((s) => trKarsilastir(s).startsWith(g));
}

