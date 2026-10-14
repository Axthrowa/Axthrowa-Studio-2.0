/**
 * StreamAxT — yapay zekâya sohbette seslenme (saf)
 * Developed by AxthrowA
 *
 * Yaygın botlarda gözlenen (herkese açık belgeler, 2026-10): izleyici mesajı
 * botun adıyla başlatınca (`@Bot soru`) yapay zekâ yanıt verir. StreamAxT'de
 * yalnız `!sor` vardı. Ayar: `ai_mention_enabled` (varsayılan kapalı).
 */

/** Mesaj bot adlarından biriyle başlıyorsa soruyu döner; değilse `null`. */
export function seslenmeAyikla(metin: string, botAdlari: Iterable<string>): string | null {
  const s = String(metin ?? '').trim();
  if (!s.startsWith('@')) return null;
  const m = s.match(/^@([\w.-]{2,40})[\s,:]+(.+)$/su);
  if (!m) return null;
  const ad = m[1].toLowerCase();
  for (const b of botAdlari) {
    if (String(b || '').toLowerCase() === ad) {
      const soru = m[2].trim();
      return soru.length >= 2 ? soru.slice(0, 400) : null;
    }
  }
  return null;
}

/** Kişi başına ve genel bekleme (yapay zekâ kotası ve sohbet seli için). */
export class SeslenmeSiniri {
  private kisi = new Map<string, number>();
  private son = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly kisiMs = 30_000,
    private readonly genelMs = 4_000
  ) {}

  izinVer(kullanici: string, simdi = Date.now()): boolean {
    const k = kullanici.toLowerCase();
    if (simdi - this.son < this.genelMs) return false;
    if (simdi - (this.kisi.get(k) ?? Number.NEGATIVE_INFINITY) < this.kisiMs) return false;
    this.son = simdi;
    this.kisi.set(k, simdi);
    if (this.kisi.size > 2000) this.kisi.delete(this.kisi.keys().next().value as string);
    return true;
  }
}
