/**
 * StreamAxT — varyant seçimi (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK; test edilebilir olsun diye ayrıldı.
 */

export interface UyariVaryanti {
  id: string;
  eventType: string;
  ad: string;
  aktif: boolean;
  /** Bu varyantın devreye girmesi için gereken en düşük değer. */
  minDeger: number;
  /** Aynı öncelikteki varyantlar arasında seçilme şansı. */
  agirlik: number;
  baslikSablonu: string;
  mesajSablonu: string;
  gorselUrl: string;
  sesUrl: string;
  sesSeviyesi: number;
  sureMs: number;
  animasyon: string;
  vurguRengi: string;
  metinRengi: string;
}

export const VARSAYILAN_VARYANT: Omit<UyariVaryanti, 'id' | 'eventType'> = {
  ad: 'Yeni varyant',
  aktif: true,
  minDeger: 0,
  agirlik: 1,
  baslikSablonu: '',
  mesajSablonu: '',
  gorselUrl: '',
  sesUrl: '',
  sesSeviyesi: 0.7,
  sureMs: 5000,
  animasyon: 'bounce',
  vurguRengi: '#3EEDFE',
  metinRengi: '#ffffff'
};

/**
 * Uygun varyantı seçer.
 *
 * `rastgele` testte belirlenimci olabilsin diye dışarıdan verilebilir.
 */
export function varyantSec(
  varyantlar: UyariVaryanti[],
  deger: number,
  rastgele: () => number = Math.random
): UyariVaryanti | null {
  const d = Math.max(0, Number(deger) || 0);
  const uygun = varyantlar.filter((v) => v.aktif && d >= (Number(v.minDeger) || 0));
  if (!uygun.length) return null;

  // En yüksek eşik kazanır: 1000₺ bağış "0+" varyantına düşmesin
  const enYuksek = Math.max(...uygun.map((v) => Number(v.minDeger) || 0));
  const adaylar = uygun.filter((v) => (Number(v.minDeger) || 0) === enYuksek);
  if (adaylar.length === 1) return adaylar[0];

  const toplam = adaylar.reduce((t, v) => t + Math.max(0, Number(v.agirlik) || 0), 0);
  if (toplam <= 0) return adaylar[Math.floor(rastgele() * adaylar.length)];

  let r = rastgele() * toplam;
  for (const v of adaylar) {
    r -= Math.max(0, Number(v.agirlik) || 0);
    if (r <= 0) return v;
  }
  return adaylar[adaylar.length - 1];
}

