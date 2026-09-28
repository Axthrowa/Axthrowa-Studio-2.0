/**
 * Araçlar › Çıkış zamanlayıcısı (OBS "Output Timer"): yayın ve/veya kayıt belirtilen süre sonra kendiliğinden durur.
 * Zamanlayıcı bu pencerede çalışır (OBS'te de arayüze bağlıdır); saf hesaplar burada, test edilir.
 */

export type Zamanlayici = { yayinBitis: number | null; kayitBitis: number | null };

export const BOS: Zamanlayici = { yayinBitis: null, kayitBitis: null };

/** Süre (saat, dakika, saniye) → milisaniye; geçersiz ya da sıfırsa null */
export function sureMs(saat: number, dakika: number, saniye: number): number | null {
  const toplam = (saat * 3600 + dakika * 60 + saniye) * 1000;
  return Number.isFinite(toplam) && toplam > 0 && toplam <= 24 * 3600 * 1000 ? toplam : null;
}

/** Kalan süre metni (ss:dd:ss); bitmişse "00:00:00" */
export function kalanMetin(bitis: number, simdi: number): string {
  const s = Math.max(0, Math.ceil((bitis - simdi) / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`;
}

/** Süresi dolan ve çıktısı hâlâ açık olan işler (durdurulacaklar); dolanlar zamanlayıcıdan düşer */
export function dolanlar(z: Zamanlayici, simdi: number, canli: boolean, kayitta: boolean): { durdur: ("yayin" | "kayit")[]; kalan: Zamanlayici } {
  const durdur: ("yayin" | "kayit")[] = [];
  const kalan = { ...z };
  if (z.yayinBitis !== null && simdi >= z.yayinBitis) {
    if (canli) durdur.push("yayin");
    kalan.yayinBitis = null;
  }
  if (z.kayitBitis !== null && simdi >= z.kayitBitis) {
    if (kayitta) durdur.push("kayit");
    kalan.kayitBitis = null;
  }
  return { durdur, kalan };
}
