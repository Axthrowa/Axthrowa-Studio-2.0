/** T-bar bırakma sonucu (motorun kuralının arayüz karşılığı: uçlara 0,02'den yakın bırakma geçişi bitirir) */
export const TBAR_UC = 0.02;

export type TbarSonucu = "tamamlandi" | "geri-alindi" | "ortada";

export function tbarBirakSonucu(konum: number, motorEtkin: boolean): TbarSonucu {
  if (motorEtkin) return "ortada";
  return konum >= 1 - TBAR_UC ? "tamamlandi" : "geri-alindi";
}
