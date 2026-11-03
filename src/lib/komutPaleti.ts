/**
 * Ctrl+K komut paletinin arama mantığı. Saf: Türkçe harfler sorunsuz eşleşir ("cekilis" Çekiliş'i bulur),
 * adın başında geçen sonuç öne gelir.
 */
export type Komut = {
  id: string;
  ad: string;
  grup: string;
  /** Adda geçmeyen arama sözcükleri */
  anahtar?: string;
  /** Yayını etkileyen eylem: çalışmadan önce ikinci kez onay ister */
  onay?: boolean;
  /** Şu an çalıştırılamıyorsa nedeni */
  engel?: string | null;
  calistir: () => void | Promise<unknown>;
};

const HARFLER: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", "̇": "" };

export function katla(metin: string): string {
  return metin.toLocaleLowerCase("tr").replace(/[çğıöşü̇]/g, (h) => HARFLER[h]);
}

/** Sorgunun bütün sözcüklerini içeren komutlar; en iyi eşleşme önce, eşitlikte verilen sıra korunur. */
export function komutAra(liste: Komut[], sorgu: string): Komut[] {
  const sozcukler = katla(sorgu).split(/\s+/).filter(Boolean);
  if (!sozcukler.length) return liste;
  const puan = (k: Komut) => {
    const ad = katla(k.ad);
    if (ad.startsWith(sozcukler[0])) return 0;
    return ad.split(/\s+/).some((s) => s.startsWith(sozcukler[0])) ? 1 : 2;
  };
  return liste
    .filter((k) => {
      const metin = katla(`${k.ad} ${k.grup} ${k.anahtar || ""}`);
      return sozcukler.every((s) => metin.includes(s));
    })
    .map((k, i) => ({ k, i, p: puan(k) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.k);
}
