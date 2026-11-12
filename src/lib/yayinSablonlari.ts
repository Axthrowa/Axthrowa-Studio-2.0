/**
 * Yayın bilgisi şablonları (U8): başlık + kategori adı + etiketler. Kategori kimliği platforma özel olduğundan
 * şablon kategoriyi ADIYLA tutar; uygularken her platformda aranıp eşleştirilir.
 * Panel ayarlarında `yayinSablonlari` olarak durur.
 */
export type YayinSablonu = { ad: string; baslik: string; kategori: string; etiketler: string[] };

const metin = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Ayardan gelen ham değeri doğrular; bozuk öğeler atılır, ad tekrarında ilki kalır. */
export function sablonlariOku(ham: unknown): YayinSablonu[] {
  if (!Array.isArray(ham)) return [];
  const goruldu = new Set<string>();
  const out: YayinSablonu[] = [];
  for (const o of ham.slice(0, 50)) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const ad = metin(r.ad, 60);
    if (!ad || goruldu.has(ad.toLocaleLowerCase("tr"))) continue;
    goruldu.add(ad.toLocaleLowerCase("tr"));
    const etiketler = Array.isArray(r.etiketler) ? r.etiketler.map((e) => metin(e, 25)).filter(Boolean).slice(0, 10) : [];
    out.push({ ad, baslik: metin(r.baslik, 140), kategori: metin(r.kategori, 100), etiketler });
  }
  return out;
}

/** Aynı adlı şablonu değiştirir, yoksa sona ekler. */
export function sablonKaydet(liste: YayinSablonu[], s: YayinSablonu): YayinSablonu[] {
  const k = s.ad.toLocaleLowerCase("tr");
  const i = liste.findIndex((x) => x.ad.toLocaleLowerCase("tr") === k);
  return i < 0 ? [...liste, s] : liste.map((x, j) => (j === i ? s : x));
}

/**
 * Şablondaki kategori adına uyan adayı seçer: önce tam (büyük/küçük harf duyarsız) eşleşme; `ilkeDus` ise yoksa
 * aramanın ilk sonucu (Kick/Twitch araması). YouTube'un sabit listesinde ilk öğe ilgisiz olur, orada kapalı.
 */
export function kategoriEslestir<T extends { ad: string }>(ad: string, adaylar: T[], ilkeDus = true): T | null {
  const k = ad.trim().toLocaleLowerCase("tr");
  if (!k) return null;
  return adaylar.find((a) => a.ad.trim().toLocaleLowerCase("tr") === k) ?? (ilkeDus ? adaylar[0] ?? null : null);
}
