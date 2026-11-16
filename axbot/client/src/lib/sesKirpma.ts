/**
 * Ses kırpma: başlangıç ve en fazla çalma süresi adresin `#t=başla,bitir` parçasında tutulur.
 * Tarayıcı (OBS dahil) bu parçayı kendisi uygular; ayrı ayar veya veritabanı alanı gerekmez.
 */
const PARCA = /#t=([\d.]*)(?:,([\d.]*))?$/;

export function kirpmaOku(url: string): { temiz: string; baslangic: number; sure: number } {
  const m = String(url || '').match(PARCA);
  if (!m) return { temiz: String(url || ''), baslangic: 0, sure: 0 };
  const baslangic = Number(m[1]) || 0;
  const bitis = Number(m[2]) || 0;
  return { temiz: String(url).slice(0, m.index), baslangic, sure: bitis > baslangic ? Math.round((bitis - baslangic) * 10) / 10 : 0 };
}

/** sure 0 = sonuna kadar çalar. İkisi de 0 ise parça kaldırılır. */
export function kirpmaYaz(url: string, baslangic: number, sure: number): string {
  const { temiz } = kirpmaOku(url);
  const b = Math.max(0, Math.round((Number(baslangic) || 0) * 10) / 10);
  const s = Math.max(0, Math.round((Number(sure) || 0) * 10) / 10);
  if (!temiz || (!b && !s)) return temiz;
  return `${temiz}#t=${b}${s ? `,${Math.round((b + s) * 10) / 10}` : ''}`;
}
