/**
 * AxBoT — Kick takipçi artışı (saf)
 *
 * Kick herkese açık akışta takipçinin adını vermiyor; güvenilir tek bilgi kanalın takipçi sayısı. Sayı önceki
 * en yüksek değeri geçtikçe yeni takipçi sayılır. En yüksek değer tutulduğu için takip edip bırakıp yeniden
 * takip etmek uyarı tekrarlatamaz. İlk okuma yalnız başlangıç noktasıdır: bot açılırken eski takipçiler sayılmaz.
 */
export const TAKIPCI_YOKLAMA_MS = 30_000;
/** Tek seferde en çok bu kadar uyarı: bot uzun süre kapalı kaldıysa ekrana sel gibi uyarı dolmasın */
export const TEK_SEFERDE_EN_COK = 10;

export interface TakipciIzi {
  enYuksek: number | null;
}

/** Yeni sayıyı işler; kaç yeni takipçi uyarısı gerektiğini döndürür. */
export function takipciArtisi(iz: TakipciIzi, sayi: unknown): number {
  const n = Number(sayi);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (iz.enYuksek === null) {
    iz.enYuksek = n;
    return 0;
  }
  if (n <= iz.enYuksek) return 0;
  const fark = n - iz.enYuksek;
  iz.enYuksek = n;
  return Math.min(fark, TEK_SEFERDE_EN_COK);
}
