/**
 * StreamAxT — anket başlatma/bitirme (panel ve sohbet komutu ortak)
 * Developed by AxthrowA
 *
 * Eskiden anket yalnız panelden açılabiliyordu; mantık rota gövdesindeydi. Sohbet
 * komutu (`!anketac`) aynı yolu kullansın diye buraya taşındı.
 */
import { db } from '../../db/index.js';
import { hataMetni } from '../../core/logger.js';

export interface AnketGirdisi {
  title?: unknown;
  options?: unknown;
  durationSeconds?: unknown;
  command?: unknown;
}

export type AnketSonucu = { ok: true; id: string; title: string; options: string[]; durationSeconds: number; command: string } | { ok: false; hata: string };

export async function anketBaslat(g: AnketGirdisi): Promise<AnketSonucu> {
  const title = String(g.title ?? '').trim().slice(0, 200);
  const options: string[] = Array.isArray(g.options)
    ? g.options.map((o: unknown) => String(o ?? '').trim().slice(0, 100)).filter(Boolean).slice(0, 10)
    : [];
  // NaN/negatif süre anketi anında kapatıyor ya da hiç kapatmıyordu
  const durationSeconds = Math.min(3600, Math.max(10, Math.floor(Number(g.durationSeconds)) || 60));
  const command = /^![\p{L}\p{N}_]{1,20}$/u.test(String(g.command || '')) ? String(g.command) : '!oy';
  if (!title || options.length < 2) return { ok: false, hata: 'Başlık ve en az 2 seçenek gerekli.' };

  db.prepare('UPDATE polls SET is_active = 0 WHERE is_active = 1').run();
  const id = `poll-${Date.now()}`;
  const endsAt = Date.now() + durationSeconds * 1000;
  db.prepare(`
    INSERT INTO polls (id, title, options, is_active, created_at, duration_seconds, ends_at, command)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, title, JSON.stringify(options), Date.now(), durationSeconds, endsAt, command);

  // Tek URL yerleşiminde anket katmanı kapalıysa anket OBS'te hiç görünmüyordu: başlayınca açılır
  // (widget anket yokken kendini gizler, açık kalması zararsız). Rota modülü komut yöneticisiyle
  // döngü kurmasın diye geç yüklenir.
  try {
    const { overlayAyariOku, overlayAyariYaz } = await import('../../api/rotalar/widgetlar.js');
    const yerlesim = overlayAyariOku();
    if (!yerlesim?.polls?.enabled) overlayAyariYaz({ ...yerlesim, polls: { ...yerlesim.polls, enabled: true } });
  } catch (e) {
    console.warn('[Anket] Katman açılamadı:', hataMetni(e));
  }

  const { wsHub } = await import('../../ws/server.js');
  wsHub.broadcastTo(['all'], {
    type: 'poll_started',
    poll: { id, title, question: title, options, votes: [], endsAt, durationSeconds }
  });
  return { ok: true, id, title, options, durationSeconds, command };
}

/** Açık anketi kapatır; sonuçları döndürür (açık anket yoksa null). */
export async function anketBitir(): Promise<{ title: string; options: string[]; oylar: number[] } | null> {
  const poll = db.prepare('SELECT * FROM polls WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
  db.prepare('UPDATE polls SET is_active = 0 WHERE is_active = 1').run();
  const { wsHub } = await import('../../ws/server.js');
  wsHub.broadcastTo(['all'], { type: 'poll_ended' });
  if (!poll) return null;
  let options: string[] = [];
  try {
    options = JSON.parse(poll.options || '[]');
  } catch {
    /* bozuk seçenek listesi */
  }
  const oylar = options.map(() => 0);
  for (const v of db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(poll.id) as any[]) {
    if (v.option_index >= 0 && v.option_index < oylar.length) oylar[v.option_index] = Number(v.count) || 0;
  }
  return { title: poll.title, options, oylar };
}

/**
 * Sohbet komutu: `!anketac [süre] Soru | Seçenek 1 | Seçenek 2 …`
 * Süre isteğe bağlı ilk sözcük: `90` (saniye, en çok 600), `90sn`, `2dk`.
 */
export function anketKomutuCoz(args: string[]): { soru: string; secenekler: string[]; sure: number } | { hata: string } {
  let sozcukler = [...args];
  let sure = 60;
  const m = /^(\d{1,4})(sn|dk)?$/i.exec(sozcukler[0] || '');
  // Birimsiz sayı yalnız 600'e kadar süre sayılır: "2026 en iyi oyun?" sorunun parçası
  if (m && (m[2] || Number(m[1]) <= 600) && sozcukler.join(' ').includes('|')) {
    const n = Number(m[1]);
    sure = /^dk$/i.test(m[2] || '') ? n * 60 : n;
    sozcukler = sozcukler.slice(1);
  }
  const parcalar = sozcukler.join(' ').split('|').map((p) => p.trim()).filter(Boolean);
  if (parcalar.length < 3) return { hata: 'Kullanım: !anketac [süre] Soru | Seçenek 1 | Seçenek 2  (örn: !anketac 2dk Hangi oyun? | Valorant | CS2)' };
  return { soru: parcalar[0], secenekler: parcalar.slice(1), sure };
}

/** Kapanış duyurusu: "🏆 Valorant (5 oy, %62)" ya da beraberlik */
export function anketSonucMetni(s: { title: string; options: string[]; oylar: number[] }): string {
  const toplam = s.oylar.reduce((a, b) => a + b, 0);
  if (!toplam) return `📊 "${s.title}" anketi bitti — hiç oy gelmedi.`;
  const en = Math.max(...s.oylar);
  const kazananlar = s.options.filter((_, i) => s.oylar[i] === en);
  const yuzde = Math.round((en / toplam) * 100);
  return kazananlar.length > 1
    ? `📊 "${s.title}" bitti: berabere — ${kazananlar.join(' / ')} (${en}'er oy, toplam ${toplam})`
    : `📊 "${s.title}" bitti: 🏆 ${kazananlar[0]} (${en} oy, %${yuzde}, toplam ${toplam})`;
}
