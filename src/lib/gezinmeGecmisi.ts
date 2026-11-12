/**
 * Alt+← / Alt+→ için gezinme geçmişi (A2, saf). Tarayıcı geçmişi gibi: geri gidip yeni sayfa açınca
 * ileri kısmı silinir; aynı sayfa üst üste eklenmez.
 */
export type Gecmis<T> = { liste: T[]; konum: number };

export const GECMIS_UZUNLUGU = 50;

export const bosGecmis = <T,>(): Gecmis<T> => ({ liste: [], konum: -1 });

export function gecmiseEkle<T>(g: Gecmis<T>, sayfa: T, ayni: (a: T, b: T) => boolean): Gecmis<T> {
  const simdiki = g.liste[g.konum];
  if (simdiki !== undefined && ayni(simdiki, sayfa)) return g;
  const liste = [...g.liste.slice(0, g.konum + 1), sayfa].slice(-GECMIS_UZUNLUGU);
  return { liste, konum: liste.length - 1 };
}

/** `yon` -1 geri, +1 ileri. Gidilecek yer yoksa `null`. */
export function gecmisteGit<T>(g: Gecmis<T>, yon: -1 | 1): { gecmis: Gecmis<T>; sayfa: T } | null {
  const konum = g.konum + yon;
  if (konum < 0 || konum >= g.liste.length) return null;
  return { gecmis: { ...g, konum }, sayfa: g.liste[konum] };
}
