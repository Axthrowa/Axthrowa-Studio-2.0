/** Şarkı isteği kuralları ve kuyruk sıralaması: saf işlevler. */

const HARFLER: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', '̇': '' };

function katla(metin: string): string {
  return metin.toLocaleLowerCase('tr').replace(/[çğıöşü̇]/g, (h) => HARFLER[h]);
}

/** Satır başına bir sözcük ya da şarkı adı; tek harfli satır her şeyi engellemesin diye sayılmaz */
export function engelListesi(ham: string): string[] {
  return ham
    .split(/\r?\n/)
    .map((s) => katla(s.trim()))
    .filter((s) => s.length >= 2);
}

/** Metin engel listesindeki bir satırı içeriyor mu (Türkçe harf ve büyük/küçük fark etmez) */
export function engelliMi(metin: string, ham: string): boolean {
  const k = katla(metin);
  return engelListesi(ham).some((s) => k.includes(s));
}

/** YouTube izleme sayfasından süre (sn); bulunamazsa 0 */
export function youtubeSuresi(html: string): number {
  return Number(String(html).match(/"lengthSeconds":"(\d+)"/)?.[1]) || 0;
}

/**
 * Yeni sıranın `created_at` değerleri: kuyruk bu alana göre okunduğu için sütun eklemeden sıra değişir.
 * Bilinmeyen kimlik yok sayılır, listede verilmeyen kayıt sona kalır; değerler kesin artan olur.
 */
export function siraDegerleri(mevcut: Array<{ id: string; created_at: number }>, yeniSira: string[]): Array<{ id: string; created_at: number }> {
  const bilinen = new Set(mevcut.map((k) => k.id));
  const istenen = [...new Set(yeniSira)].filter((id) => bilinen.has(id));
  const kalan = mevcut.filter((k) => !istenen.includes(k.id)).map((k) => k.id);
  const zamanlar = mevcut.map((k) => k.created_at).sort((a, b) => a - b);
  let onceki = -Infinity;
  return [...istenen, ...kalan].map((id, i) => {
    onceki = Math.max(zamanlar[i], onceki + 1);
    return { id, created_at: onceki };
  });
}
