/**
 * Ses mikseri hesapları (test edilir): çarpan ↔ dB, fader konumu, ölçer yüzdesi, kırpılma.
 *
 * Fader OBS'in mikserindeki gibi dB ölçeğindedir: üst 0 dB, alt −∞. Konum 0–1 arası; −60 dB altı sessizlik.
 * Gelişmiş Ses Özellikleri'nde düzey +26 dB'ye (çarpan 20) kadar yazılabilir — OBS ile aynı üst sınır.
 */

export const SESSIZLIK_DB = -144;
export const FADER_ALT_DB = -60;
export const AZAMI_CARPAN = 20;

export function carpandanDb(c: number): number {
  return c > 0 ? 20 * Math.log10(c) : -Infinity;
}

export function dbdenCarpan(db: number): number {
  if (!Number.isFinite(db) || db <= FADER_ALT_DB - 40) return 0;
  return Math.min(AZAMI_CARPAN, Math.pow(10, db / 20));
}

/** Fader konumu (0–1) → dB: 0 → −∞, 1 → 0 dB. Konum doğrusal dB (üstte ince ayar kolay). */
export function konumdanDb(k: number): number {
  if (k <= 0) return -Infinity;
  return FADER_ALT_DB * (1 - Math.min(1, k));
}

export function dbdenKonum(db: number): number {
  if (!Number.isFinite(db) || db <= FADER_ALT_DB) return 0;
  return Math.min(1, 1 - db / FADER_ALT_DB);
}

export function dbMetni(db: number): string {
  if (!Number.isFinite(db) || db <= SESSIZLIK_DB + 1) return "−∞ dB";
  const r = Math.round(db * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)} dB`;
}

/** Ölçer çubuğunun yüzdesi (−60 dB … 0 dB) */
export function olcerYuzdesi(db: number): number {
  if (!Number.isFinite(db) || db <= FADER_ALT_DB) return 0;
  return Math.max(0, Math.min(100, (1 - db / FADER_ALT_DB) * 100));
}

/** Kırpılma: tepe 0 dBFS'e çok yakın ya da üstü */
export function kirpiliyor(tepeDb: number): boolean {
  return tepeDb >= -0.5;
}

/** Ölçer bölgesi: yeşil (< −20), sarı (−20…−9), kırmızı (≥ −9) — OBS renk eşikleri */
export function olcerBolgesi(db: number): "yesil" | "sari" | "kirmizi" {
  return db >= -9 ? "kirmizi" : db >= -20 ? "sari" : "yesil";
}

/** Denge (0 sol … 0.5 orta … 1 sağ) metni */
export function dengeMetni(d: number): string {
  if (Math.abs(d - 0.5) < 0.005) return "Orta";
  const y = Math.round(Math.abs(d - 0.5) * 200);
  return d < 0.5 ? `Sol %${y}` : `Sağ %${y}`;
}

export const IZLEME_ADLARI = ["İzleme kapalı", "Yalnız izle (çıkışı sustur)", "İzle ve çıkışa ver"] as const;
