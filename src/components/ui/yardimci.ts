/** İlkel bileşenlerin saf yardımcıları (DOM'suz; birim testleri `ui.test.tsx`). */

/**
 * Sekme / bölümlü denetim / araç çubuğunda ok tuşuyla gidilecek öğe. Kapalı öğeler atlanır,
 * uçlarda başa/sona sarar; Home/End ilk/son açık öğe. İlgisiz tuşta `null`.
 */
export function sonrakiIndeks(
  i: number,
  tus: string,
  kapali: readonly boolean[],
  yon: "yatay" | "dikey" = "yatay"
): number | null {
  const n = kapali.length;
  if (!n) return null;
  const ileri = yon === "yatay" ? "ArrowRight" : "ArrowDown";
  const geri = yon === "yatay" ? "ArrowLeft" : "ArrowUp";
  let adim: number;
  let bas: number;
  if (tus === ileri) [adim, bas] = [1, i];
  else if (tus === geri) [adim, bas] = [-1, i];
  else if (tus === "Home") [adim, bas] = [1, -1];
  else if (tus === "End") [adim, bas] = [-1, n];
  else return null;
  for (let k = 1; k <= n; k++) {
    const j = (((bas + adim * k) % n) + n) % n;
    if (!kapali[j]) return j;
  }
  return null;
}

/** Sayıyı arayüz diline göre yazar: tr `-12,4`, en `-12.4`. Sonsuz eksi `-∞`. */
export function sayiBicim(v: number, locale: string, basamak = 1): string {
  if (v === -Infinity) return "-∞";
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  }).format(v);
}

/** dBFS değerini ölçer doluluğuna çevirir (0–1). `min` altı boş, 0 dBFS dolu. */
export function dbOrani(db: number, min = -60): number {
  if (!Number.isFinite(db)) return db > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, (db - min) / -min));
}

/** Tepe bu değere ulaşınca kanal kırpılmaya yakın sayılır (sarı + uyarı simgesi). */
export const KIRPMA_DBFS = -1;

/** Ham hatayı "Ayrıntılar" bölümü için metne çevirir; kullanıcıya başlık olarak gösterilmez. */
export function hataMetni(hata: unknown): string {
  if (hata == null) return "";
  if (typeof hata === "string") return hata;
  if (hata instanceof Error) return hata.stack && hata.stack.includes(hata.message) ? hata.stack : `${hata.name}: ${hata.message}`;
  try {
    return JSON.stringify(hata, null, 2);
  } catch {
    return String(hata);
  }
}

/** Odaklanabilir öğe seçicisi (diyalog odak tuzağı, araç çubuğu). */
export const ODAKLANABILIR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
