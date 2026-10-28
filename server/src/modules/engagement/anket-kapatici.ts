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
export function suresiDolanlariKapat(simdi = Date.now()): Array<{ id: string; title: string; options: string[]; votes: unknown[]; bitis: number }> {
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
    kapananlar.push({ id: p.id, title: p.title, options, votes, bitis: Number(p.ends_at) });
  }
  return kapananlar;
}

/** Sonuç yalnız bitişi son 1 dakikadaysa duyurulur */
export function sonucDuyurulmali(bitis: number, simdi = Date.now()): boolean {
  return simdi - bitis <= 60_000;
}

/** Bağlı yayın platformları (Discord hariç) */
export function yayinSohbetleri(pm: { getAllStatuses(): Record<string, any>; getPlatform(ad: string): { isConnected(): boolean } | undefined }): string[] {
  return Object.keys(pm.getAllStatuses()).filter((ad) => ad !== 'discord' && pm.getPlatform(ad)?.isConnected());
}

export function anketKapaticiyiBaslat(): void {
  if (calisiyor) return;
  calisiyor = setInterval(async () => {
    try {
      const kapanan = suresiDolanlariKapat();
      if (!kapanan.length) return;
      const { wsHub } = await import('../../ws/server.js');
      const { eventBus } = await import('../../core/event-bus.js');
      const { anketSonucMetni } = await import('./anket.js');
      const { platformManager } = await import('../../platforms/manager.js');
      for (const p of kapanan) {
        wsHub.broadcastTo(['all'], { type: 'poll_ended', poll: { ...p, question: p.title, endsAt: Date.now() } });
        // Süre dolunca sonuç sohbete de yazılır (eskiden yalnız OBS'te görünüyordu). Bot kapalıyken
        // dolan eski anket açılışta sessizce kapanır: ertesi gün sohbete dünkü sonuç düşmesin.
        if (!sonucDuyurulmali(p.bitis)) continue;
        const oylar = p.options.map(() => 0);
        for (const v of p.votes as Array<{ option_index: number; count: number }>) if (v.option_index < oylar.length) oylar[v.option_index] = Number(v.count) || 0;
        const metin = anketSonucMetni({ title: p.title, options: p.options, oylar });
        // Yayın sohbetlerine; Discord sunucusu yayındaki anketin sonucunu almaz
        for (const ad of yayinSohbetleri(platformManager)) eventBus.emitBotMessage({ platform: ad as any, channel: '', message: metin });
      }
    } catch {
      /* tablo yoksa ya da DB meşgulse bir sonraki turda */
    }
  }, 5000);
  calisiyor.unref?.();
}
