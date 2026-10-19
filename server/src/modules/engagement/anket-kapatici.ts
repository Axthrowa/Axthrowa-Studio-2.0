/**
 * StreamAxT — süresi dolan anketi kapatır
 * Developed by AxthrowA
 *
 * Eskiden anket süresi dolunca HİÇBİR şey olmuyordu: `is_active` 1 kalıyor,
 * oy verilmeye devam ediliyor ve overlay "Anket bitti" kartını sonsuza dek
 * gösteriyordu (yeniden açılan OBS sayfası eski anketi tekrar getiriyordu).
 */
import { db } from '../../db/index.js';

let calisiyor: NodeJS.Timeout | null = null;

/** Süresi dolan aktif anketleri kapatır; kapananları (son sonuçlarla) döndürür. */
export function suresiDolanlariKapat(simdi = Date.now()): Array<{ id: string; title: string; options: string[]; votes: unknown[] }> {
  const satirlar = db
    .prepare('SELECT * FROM polls WHERE is_active = 1 AND ends_at IS NOT NULL AND ends_at > 0 AND ends_at <= ?')
    .all(simdi) as any[];
  const kapananlar = [];
  for (const p of satirlar) {
    db.prepare('UPDATE polls SET is_active = 0 WHERE id = ?').run(p.id);
    let options: string[] = [];
    try {
      options = JSON.parse(p.options || '[]');
    } catch {
      /* bozuk seçenek listesi */
    }
    const votes = db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(p.id);
    kapananlar.push({ id: p.id, title: p.title, options, votes });
  }
  return kapananlar;
}

export function anketKapaticiyiBaslat(): void {
  if (calisiyor) return;
  calisiyor = setInterval(async () => {
    try {
      const kapanan = suresiDolanlariKapat();
      if (!kapanan.length) return;
      const { wsHub } = await import('../../ws/server.js');
      for (const p of kapanan) {
        wsHub.broadcastTo(['all'], { type: 'poll_ended', poll: { ...p, question: p.title, endsAt: Date.now() } });
      }
    } catch {
      /* tablo yoksa ya da DB meşgulse bir sonraki turda */
    }
  }, 5000);
  calisiyor.unref?.();
}
