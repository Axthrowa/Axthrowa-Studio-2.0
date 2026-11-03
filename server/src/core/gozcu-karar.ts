/**
 * AxBoT — gözcü yeniden başlatma kararı (saf; testli)
 * Developed by AxthrowA
 */

export interface CokmeKaydi {
  zaman: number;
  kod: number | null;
}

/** Alt sürecin "başka bir AxBoT zaten çalışıyor" çıkış kodu */
export const ZATEN_CALISIYOR_KODU = 2;

const PENCERE_MS = 10 * 60_000;
const EN_COK_COKME = 8;

export type GozcuKarari = { tur: 'cik'; kod: number; mesaj?: string } | { tur: 'yeniden'; beklemeMs: number };

export function gozcuKarari(kod: number | null, sinyal: string | null, oncekiler: CokmeKaydi[], simdi: number): GozcuKarari {
  if (kod === 0) return { tur: 'cik', kod: 0 };
  if (kod === ZATEN_CALISIYOR_KODU) {
    return { tur: 'cik', kod: 0, mesaj: 'Başka bir AxBoT zaten çalışıyor; bu kopya kapatıldı.' };
  }
  const yakin = oncekiler.filter((c) => simdi - c.zaman < PENCERE_MS).length;
  if (yakin >= EN_COK_COKME) {
    return { tur: 'cik', kod: 1, mesaj: `Bot 10 dakikada ${yakin + 1} kez çöktü; yeniden başlatma durduruldu. Günlüğe bakın (streamaxt.log).` };
  }
  // 3 sn, 6 sn, 12 sn… en çok 30 sn
  return { tur: 'yeniden', beklemeMs: Math.min(30_000, 3000 * 2 ** Math.min(yakin, 4)) };
}
