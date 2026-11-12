/**
 * Canlı ekranındaki "Hızlı işlem" düğmeleri: hangileri görünecek, bu bilgisayarda saklanır.
 * Kimlik türleri: `soru`, `temizle` (yerleşik), `bot:<sekme>` (botun sayfası pencerede açılır),
 * `eylem:<kimlik>` (eylem kayıt defterindeki parametresiz eylem doğrudan çalışır).
 */
export type HizliIslem = { id: string; ad: string };

export const HIZLI_KEY = "studio.canli.hizliIslemler";
export const HIZLI_EN_COK = 24;

export const VARSAYILAN_HIZLI: HizliIslem[] = [
  { id: "bot:giveaways", ad: "Çekiliş başlat" },
  { id: "bot:polls", ad: "Anket aç" },
  { id: "soru", ad: "Soru sor" },
  { id: "temizle", ad: "Sohbeti temizle" },
];

const GECERLI = /^(soru|temizle|bot:[a-z]{2,24}|eylem:[\w.:-]{1,64})$/;

/** Kayıtlı metni okur; bozuk ya da tanınmayan kayıtlar atılır, hiçbiri kalmazsa varsayılan döner. */
export function hizliOku(ham: string | null): HizliIslem[] {
  if (!ham) return VARSAYILAN_HIZLI;
  try {
    const okunan = JSON.parse(ham) as unknown;
    if (!Array.isArray(okunan)) return VARSAYILAN_HIZLI;
    const gorulen = new Set<string>();
    const liste = okunan
      .filter((k): k is HizliIslem => !!k && typeof k.id === "string" && typeof k.ad === "string" && GECERLI.test(k.id) && !!k.ad.trim())
      .filter((k) => !gorulen.has(k.id) && !!gorulen.add(k.id))
      .map((k) => ({ id: k.id, ad: k.ad.trim().slice(0, 40) }))
      .slice(0, HIZLI_EN_COK);
    // Boş dizi kullanıcının seçimi olabilir: hepsini kaldırdıysa öyle kalır
    return liste.length || okunan.length === 0 ? liste : VARSAYILAN_HIZLI;
  } catch {
    return VARSAYILAN_HIZLI;
  }
}
