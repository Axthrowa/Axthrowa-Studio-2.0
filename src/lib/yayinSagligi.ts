/**
 * Durum çubuğu sağlık karesi (OBS: yayın sağlığına göre renkli kare). Etkin yayın çıktılarından:
 * kırmızı — başarısız hedef ya da düşen kare > %5; sarı — yeniden bağlanan hedef ya da düşen kare > %1; yeşil — sağlıklı.
 * Etkin yayın yoksa `null` (kare gösterilmez).
 */
export type Saglik = "yesil" | "sari" | "kirmizi";

export function yayinSagligi(cikislar: { tur: string; etkin: boolean; kare: number; dusen_kare: number; durum: string }[]): Saglik | null {
  const yayin = cikislar.filter((c) => c.tur === "rtmp" && (c.etkin || c.durum === "basarisiz" || c.durum === "yeniden_baglaniyor"));
  if (!yayin.length) return null;
  if (yayin.some((c) => c.durum === "basarisiz")) return "kirmizi";
  const kare = yayin.reduce((t, c) => t + c.kare, 0);
  const dusen = yayin.reduce((t, c) => t + c.dusen_kare, 0);
  const oran = kare > 0 ? dusen / kare : 0;
  if (oran > 0.05) return "kirmizi";
  if (yayin.some((c) => c.durum === "yeniden_baglaniyor") || oran > 0.01) return "sari";
  return "yesil";
}
