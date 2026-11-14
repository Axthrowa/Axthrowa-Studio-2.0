/**
 * Y4: VOD saklama hatırlatıcısı. Kick VOD'u 7 gün (doğrulanmış hesapta 30 gün) saklar; YouTube 12 saati aşan yayını
 * arşivlemeyebilir. Yerel kayıt kapalıysa yayın başında, silinmeye 2 gün kala Studio açılışında uyarır.
 */
import type { StreamSession } from "./api/botApi";

export const KAYIT_KAPALI_UYARISI =
  "Yerel kayıt kapalı: Kick VOD'u 7 gün (doğrulanmış hesapta 30 gün) saklar, YouTube 12 saati aşan yayını arşivlemeyebilir. Saklamak istiyorsan kaydı OBS'ten başlat.";

const GUN = 86_400_000;
const KICK_SAKLAMA_GUN = 7;
const ONCEDEN_GUN = 2;
const ANAHTAR = "studio.vodHatirlatildi";

/**
 * Bitişinin üstünden 5–7 gün geçmiş ve daha önce hatırlatılmamış yayınlar için birer metin.
 * shortcut: platform oturumda tutulmadığı için her yayın Kick'teymiş gibi hatırlatılır (30 günlük doğrulanmış hesap da
 * 5. gün uyarı alır); oturuma platform yazılınca yalnız Kick yayınlarına daraltılmalı.
 */
export function vodHatirlatmalari(oturumlar: StreamSession[], simdi: number, gorulen: ReadonlySet<string>): { id: string; metin: string }[] {
  return oturumlar
    .filter((s) => s.ended_at && !gorulen.has(s.id))
    .filter((s) => {
      const gecen = simdi - (s.ended_at as number);
      return gecen >= (KICK_SAKLAMA_GUN - ONCEDEN_GUN) * GUN && gecen < KICK_SAKLAMA_GUN * GUN;
    })
    .map((s) => {
      const kalan = Math.max(1, Math.ceil((s.ended_at as number) / GUN + KICK_SAKLAMA_GUN - simdi / GUN));
      const tarih = new Date(s.started_at).toLocaleDateString("tr-TR");
      return { id: s.id, metin: `${tarih} tarihli yayının${s.title ? ` (${s.title})` : ""} Kick VOD'u ${kalan} gün içinde silinir. Saklamak istiyorsan indir.` };
    });
}

export function gorulenleriOku(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(ANAHTAR) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function gorulenleriYaz(idler: Iterable<string>): void {
  try {
    // Son 100 yeter: daha eskiler zaten pencerenin dışında
    localStorage.setItem(ANAHTAR, JSON.stringify([...idler].slice(-100)));
  } catch {
    /* tekrar hatırlatılır, veri kaybı yok */
  }
}
