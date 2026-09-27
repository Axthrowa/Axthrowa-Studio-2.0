/**
 * Genel özellik formu (OBS `obs_properties` → panel formu) için saf yardımcılar. Kaynak, filtre, geçiş ve kodlayıcı
 * ayarlarının hepsi aynı tanımla gelir; alan türleri motorun `eklenti.rs::ozellik_listesi`'ndeki adlardır.
 */

export type OzellikTuru =
  | "bool"
  | "int"
  | "float"
  | "text"
  | "path"
  | "list"
  | "color"
  | "color_alpha"
  | "button"
  | "font"
  | "editable_list"
  | "frame_rate"
  | "group"
  | "bilinmeyen";

export type Ozellik = {
  ad: string;
  aciklama: string;
  ipucu?: string;
  tur: OzellikTuru;
  gorunur: boolean;
  etkin: boolean;
  min?: number;
  max?: number;
  adim?: number;
  sonek?: string;
  metinTuru?: "normal" | "parola" | "cok_satir" | "bilgi";
  yolTuru?: "dosya" | "kayit_dosyasi" | "klasor";
  liste?: { tur: "duzenlenebilir" | "liste" | "secenek"; bicim: "int" | "float" | "string" | "bool"; ogeler: { ad: string; deger: string | number | boolean; devreDisi: boolean }[] };
  grup?: Ozellik[];
};

export type OzellikTanimi = { ozellikler: Ozellik[]; ayarlar: Record<string, unknown>; gizliDolu?: Record<string, boolean> };

/**
 * OBS renkleri tamsayıdır: 0xAABBGGRR (küçük uçlu RGBA). `<input type="color">` #RRGGBB ister.
 * Negatif sayılar (JSON'da imzalı gelebilir) işaretsize çevrilir.
 */
export function obsRengindenHex(v: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v >>> 0 : 0xff000000;
  const r = n & 0xff;
  const g = (n >>> 8) & 0xff;
  const b = (n >>> 16) & 0xff;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** #RRGGBB → OBS tamsayısı; önceki değerin alfa baytı korunur (yoksa opak). */
export function hextenObsRengi(hex: string, onceki?: unknown): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`geçersiz renk: ${hex}`);
  const v = parseInt(m[1], 16);
  const r = (v >>> 16) & 0xff;
  const g = (v >>> 8) & 0xff;
  const b = v & 0xff;
  const a = typeof onceki === "number" && Number.isFinite(onceki) ? (onceki >>> 24) & 0xff : 0xff;
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function obsRengiAlfa(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? ((v >>> 0) >>> 24) & 0xff : 255;
}

export function alfaDegistir(v: unknown, alfa: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v >>> 0 : 0xff000000;
  const a = Math.max(0, Math.min(255, Math.round(alfa)));
  return ((n & 0x00ffffff) | (a << 24)) >>> 0;
}

/** Sayı alanı: sınırlara sıkıştırır, adıma yuvarlar (int). Geçersizse null. */
export function sayiAlani(metin: string, o: Pick<Ozellik, "tur" | "min" | "max" | "adim">): number | null {
  const n = Number(metin.replace(",", "."));
  if (!Number.isFinite(n) || metin.trim() === "") return null;
  const min = o.min ?? -Infinity;
  const max = o.max ?? Infinity;
  let x = Math.min(max, Math.max(min, n));
  if (o.tur === "int") x = Math.round(x);
  return x;
}

/** Görünür alanları düz listeye açar (gruplar dahil) — arama ve sınama için */
export function duzListe(ozellikler: Ozellik[]): Ozellik[] {
  const out: Ozellik[] = [];
  for (const o of ozellikler) {
    out.push(o);
    if (o.grup) out.push(...duzListe(o.grup));
  }
  return out;
}

/** Bu alan panelde düzenlenebilir mi? (düğme OBS 32.2'de kullanımdan kalktı; yazı tipi/liste düzenleyici henüz yok) */
export function duzenlenebilir(o: Ozellik): boolean {
  return ["bool", "int", "float", "text", "path", "list", "color", "color_alpha"].includes(o.tur) && o.metinTuru !== "bilgi";
}

/** Liste öğesinin değeri ile ayar değerini karşılaştırır (int/float sayı, string metin). */
export function listeSecili(o: Ozellik, deger: unknown): string {
  const ogeler = o.liste?.ogeler ?? [];
  const i = ogeler.findIndex((x) => String(x.deger) === String(deger ?? ""));
  return i >= 0 ? String(i) : "";
}
