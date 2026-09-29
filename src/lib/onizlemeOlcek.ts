/**
 * Önizleme ölçekleme (OBS "Preview Scaling"): pencereye sığdır, tuvalin kendi boyutu (%100) ya da sığdırılmış
 * boyuta göre yakınlaştırma. Hesaplar saf: bileşen yalnız sonucu uygular.
 */
export type OlcekKipi = { tur: "sigdir" } | { tur: "tuval" } | { tur: "yakin"; oran: number };

export const EN_AZ_ORAN = 0.25;
export const EN_COK_ORAN = 8;

/** Alan (kap) içinde tuval kutusunun CSS piksel boyutu */
export function kutuBoyutu(alan: { g: number; y: number }, tuval: [number, number], kip: OlcekKipi): { g: number; y: number } {
  const oran = tuval[0] / tuval[1];
  const sigan = Math.min(alan.g, alan.y * oran);
  const g = kip.tur === "tuval" ? tuval[0] : kip.tur === "yakin" ? sigan * kip.oran : sigan;
  return { g: Math.max(0, Math.floor(g)), y: Math.max(0, Math.floor(g / oran)) };
}

/** Bir tekerlek adımı (ya da menü) sonrası yakınlık: sığdırılmış boyuta göre oran, 1,25 kat adımlarla */
export function yakinlastir(alan: { g: number; y: number }, tuval: [number, number], kip: OlcekKipi, yon: 1 | -1): OlcekKipi {
  const sigan = kutuBoyutu(alan, tuval, { tur: "sigdir" }).g;
  const simdiki = sigan > 0 ? kutuBoyutu(alan, tuval, kip).g / sigan : 1;
  const yeni = Math.min(EN_COK_ORAN, Math.max(EN_AZ_ORAN, simdiki * (yon > 0 ? 1.25 : 0.8)));
  return Math.abs(yeni - 1) < 0.01 ? { tur: "sigdir" } : { tur: "yakin", oran: yeni };
}

/** Etiket metni: sığdırılmışta boş, diğerlerinde yüzde (tuval pikseline göre) */
export function olcekMetni(alan: { g: number; y: number }, tuval: [number, number], kip: OlcekKipi): string {
  if (kip.tur === "sigdir") return "";
  return `%${Math.round((kutuBoyutu(alan, tuval, kip).g / tuval[0]) * 100)}`;
}
