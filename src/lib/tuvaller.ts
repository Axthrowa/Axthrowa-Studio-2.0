/**
 * Tuval adları (yatay, dikey ve kullanıcı tanımlı ek tuvaller). Sahneler yanıtı geldikçe `tuvalleriKaydet` ile
 * güncellenir; bileşenler adları `tuvalAdi` (ya da `TUVAL_ADI[id]`) ile okur.
 */
export type TuvalBilgisi = { id: string; ad: string; genislik: number; yukseklik: number; ek: boolean };

/** Ek tuval kimliği: `tuval-<n>` (sunucudaki kuralla aynı) */
export const EK_TUVAL = /^tuval-[1-9][0-9]{0,5}$/;

const kayit = new Map<string, TuvalBilgisi>();

export function tuvalleriKaydet(liste: TuvalBilgisi[] | undefined): void {
  if (!liste) return;
  for (const [id, t] of kayit) if (t.ek && !liste.some((x) => x.id === id)) kayit.delete(id);
  for (const t of liste) kayit.set(t.id, t);
}

export function tuvalAdi(id: string): string {
  if (id.startsWith("studyo-")) return `${tuvalAdi(id.slice(7))} (önizleme)`;
  return kayit.get(id)?.ad ?? (id === "ana" ? "Yatay" : id === "dikey" ? "Dikey" : id);
}

export function ekTuvaller(): TuvalBilgisi[] {
  return [...kayit.values()].filter((t) => t.ek);
}

/** `TUVAL_ADI[id]` biçimiyle okuyan eski çağrılar için */
export const TUVAL_ADI: Record<string, string> = new Proxy({} as Record<string, string>, { get: (_, k) => tuvalAdi(String(k)) });
