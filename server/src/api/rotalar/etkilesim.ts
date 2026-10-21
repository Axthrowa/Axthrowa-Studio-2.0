/**
 * StreamAxT API — Çekiliş, tahmin, kuyruk, puan düşüşü, anket, krallık
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { giveaway } from '../../modules/giveaways/giveaways.js';
import { wsHub } from '../../ws/server.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { kingSystemService } from '../../modules/games/king-system.js';
import { tahminler } from '../../modules/engagement/predictions.js';
import { kuyruk } from '../../modules/engagement/queue.js';
import { puanDususu } from '../../modules/engagement/point-drops.js';
import { hataMetni } from '../../core/logger.js';
import { anketKapaticiyiBaslat } from '../../modules/engagement/anket-kapatici.js';

const router = Router();
anketKapaticiyiBaslat();

// Modül olaylarını açık panellere ve OBS kaynaklarına yayınla
kingSystemService.on('king_crowned', (state) => {
  wsHub.broadcastTo(['all'], { type: 'king_update', state });
});
kingSystemService.on('king_reset', (state) => {
  wsHub.broadcastTo(['all'], { type: 'king_update', state });
});

// 8. Giveaways
router.get('/giveaways', (req: Request, res: Response) => {
  const active = giveaway.getActiveGiveaway();
  const entries = giveaway.getEntries();
  const pastGiveaways = db.prepare('SELECT * FROM giveaways WHERE is_active = 0 ORDER BY created_at DESC LIMIT 10').all();
  res.json({ active, entries, pastGiveaways });
});

router.post('/giveaways/create', (req: Request, res: Response) => {
  const { title, keyword = '!katil', subBonusMultiplier = 2.0, costPoints = 0, durationMinutes = 10, winnerCount = 1, maxEntries = 0, subOnly = false, minWatchMinutes = 0 } = req.body;
  const created = giveaway.createGiveaway(title, keyword, subBonusMultiplier, costPoints);
  let uyari: string | undefined;
  if (created?.id) {
    try {
      db.prepare('UPDATE giveaways SET duration_minutes=?, winner_count=?, max_entries=?, follower_only=?, sub_only=?, min_watch_minutes=? WHERE id=?')
        // "Yalnız takipçi" yok: Kick sohbet iletisi takip durumunu taşımaz, doğrulanamazdı (sütun 0 kalır)
        .run(durationMinutes, winnerCount, maxEntries, 0, subOnly ? 1 : 0, minWatchMinutes, created.id);
    } catch (e) {
      // Eskiden sessizdi: süre, kazanan sayısı ve katılım şartları kaybolur,
      // çekiliş varsayılanlarla açılırdı — yayıncı fark etmezdi.
      uyari = 'Çekiliş açıldı ama ek ayarlar (süre, kazanan sayısı, katılım şartları) kaydedilemedi.';
      console.error('[Çekiliş] Ek ayarlar yazılamadı:', hataMetni(e));
    }
  }
  res.json({ success: true, giveaway: giveaway.getActiveGiveaway(), ...(uyari ? { uyari } : {}) });
});

router.post('/giveaways/draw', (req: Request, res: Response) => {
  const winner = giveaway.pickWinner();
  if (winner) {
    // Notify OBS wheel widget
    wsHub.broadcastTo(['wheel', 'dashboard', 'all'], {
      type: 'giveaway_winner',
      winner
    });
  }
  res.json({ winner });
});

// 8.7 Etkilesim: tahminler, kuyruk, puan dususlari
router.get('/predictions', (req: Request, res: Response) => res.json(tahminler.durum()));

router.post('/predictions', (req: Request, res: Response) => {
  const r = tahminler.olustur(
    String(req.body?.baslik || ''),
    Array.isArray(req.body?.secenekler) ? req.body.secenekler : [],
    Number(req.body?.kilitDakika) || 0
  );
  res.status('hata' in r ? 400 : 200).json(r);
});

router.post('/predictions/lock', (req: Request, res: Response) => res.json(tahminler.kilitle() || { hata: 'Açık tahmin yok' }));
router.post('/predictions/resolve', (req: Request, res: Response) => {
  const r = tahminler.sonuclandir(String(req.body?.secenek || ''));
  res.status(r.ok ? 200 : 400).json(r);
});
router.post('/predictions/cancel', (req: Request, res: Response) => res.json(tahminler.iptal()));

router.get('/queue', (req: Request, res: Response) => res.json({ liste: kuyruk.liste(), ayar: kuyruk.ayarOku() }));
router.post('/queue/settings', (req: Request, res: Response) => res.json(kuyruk.ayarYaz(req.body || {})));
router.post('/queue/open', (req: Request, res: Response) => res.json(kuyruk.ac()));
router.post('/queue/close', (req: Request, res: Response) => res.json(kuyruk.kapat()));
router.post('/queue/next', (req: Request, res: Response) => res.json(kuyruk.sonraki() || { bos: true }));
router.post('/queue/clear', (req: Request, res: Response) => res.json({ silinen: kuyruk.temizle() }));
router.delete('/queue/:kullanici', (req: Request, res: Response) =>
  res.json({ ok: kuyruk.ayril(String(req.params.kullanici || '')) })
);

router.get('/point-drops', (req: Request, res: Response) => res.json(puanDususu.durum()));
router.post('/point-drops/settings', (req: Request, res: Response) => res.json(puanDususu.ayarYaz(req.body || {})));
router.post('/point-drops/start', (req: Request, res: Response) => {
  const r = puanDususu.baslat();
  res.status(r.ok ? 200 : 400).json(r);
});
router.post('/point-drops/stop', (req: Request, res: Response) => res.json(puanDususu.durdur()));

// 14. Polls (On-Screen & Chat Voting)
router.get('/polls/active', (req: Request, res: Response) => {
  const poll = db.prepare('SELECT * FROM polls WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
  if (!poll) return res.json({ active: false });

  const votes = db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(poll.id) as any[];
  res.json({
    active: true,
    poll: {
      ...poll,
      options: JSON.parse(poll.options),
      votes
    }
  });
});

router.post('/polls/create', (req: Request, res: Response) => {
  const title = String(req.body?.title ?? '').trim().slice(0, 200);
  const options: string[] = Array.isArray(req.body?.options)
    ? req.body.options.map((o: unknown) => String(o ?? '').trim().slice(0, 100)).filter(Boolean).slice(0, 10)
    : [];
  // NaN/negatif süre anketi anında kapatıyor ya da hiç kapatmıyordu
  const durationSeconds = Math.min(3600, Math.max(10, Math.floor(Number(req.body?.durationSeconds)) || 60));
  const command = /^![\p{L}\p{N}_]{1,20}$/u.test(String(req.body?.command || '')) ? String(req.body.command) : '!oy';
  if (!title || options.length < 2) {
    return res.status(400).json({ error: 'Başlık ve en az 2 seçenek gerekli.' });
  }

  db.prepare('UPDATE polls SET is_active = 0 WHERE is_active = 1').run();

  const id = `poll-${Date.now()}`;
  const endsAt = Date.now() + Number(durationSeconds) * 1000;
  db.prepare(`
    INSERT INTO polls (id, title, options, is_active, created_at, duration_seconds, ends_at, command)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, title, JSON.stringify(options), Date.now(), durationSeconds, endsAt, command);

  wsHub.broadcastTo(['all'], {
    type: 'poll_started',
    poll: { id, title, question: title, options, votes: [], endsAt, durationSeconds }
  });

  res.json({ success: true, id });
});

router.post('/polls/end', (req: Request, res: Response) => {
  db.prepare('UPDATE polls SET is_active = 0 WHERE is_active = 1').run();
  wsHub.broadcastTo(['all'], { type: 'poll_ended' });
  res.json({ success: true });
});

// 5. Krallık (King System)
router.get('/king', (req: Request, res: Response) => {
  res.json(kingSystemService.getKingState());
});

router.post('/king/claim', async (req: Request, res: Response) => {
  const { username, displayName, pointsBid, avatarUrl, title } = req.body;
  if (!username || !pointsBid) {
    return res.status(400).json({ error: 'Kullanıcı adı ve puan gereklidir' });
  }
  const result = await kingSystemService.claimThrone(String(username), displayName ? String(displayName) : String(username), Number(pointsBid), avatarUrl ? String(avatarUrl) : undefined, title ? String(title) : undefined);
  if (result.success) {
    shieldModeService.addAuditLog('KING_CROWNED', String(username), `${username} ${pointsBid} puan basarak yeni kral oldu!`);
  }
  res.json(result);
});

router.post('/king/reset', (req: Request, res: Response) => {
  const { moderator = 'Yayıncı' } = req.body;
  const state = kingSystemService.resetThrone(String(moderator));
  shieldModeService.addAuditLog('KING_RESET', String(moderator), 'Yayın krallığı sıfırlandı.');
  res.json({ success: true, state });
});

router.post('/polls/vote', (req: Request, res: Response) => {
  const { username, option } = req.body;
  const poll = db.prepare('SELECT * FROM polls WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
  if (!poll) return res.status(400).json({ error: 'Aktif anket yok' });
  const opts = JSON.parse(poll.options || '[]');
  const idx = Number(option) - 1;
  if (idx < 0 || idx >= opts.length) return res.status(400).json({ error: 'Geçersiz seçenek' });
  try {
    db.prepare('INSERT INTO poll_votes (id, poll_id, username, option_index, voted_at) VALUES (?, ?, ?, ?, ?)').run(`vote-${Date.now()}`, poll.id, String(username).toLowerCase(), idx, Date.now());
  } catch {
    return res.json({ success: false, error: 'Zaten oy verdin' });
  }
  const votes = db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(poll.id);
  wsHub.broadcastTo(['all'], { type: 'poll_update', poll: { ...poll, options: opts, votes, endsAt: poll.ends_at } });
  res.json({ success: true });
});

export default router;
