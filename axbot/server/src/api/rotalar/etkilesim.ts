/**
 * AxBoT API — Çekiliş, tahmin, kuyruk, puan düşüşü, anket, krallık
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { baslangicDuyurusu, giveaway, kazananDuyurusu } from '../../modules/giveaways/giveaways.js';
import { eventBus } from '../../core/event-bus.js';
import { wsHub } from '../../ws/server.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { kingSystemService } from '../../modules/games/king-system.js';
import { tahminler } from '../../modules/engagement/predictions.js';
import { kuyruk } from '../../modules/engagement/queue.js';
import { puanDususu } from '../../modules/engagement/point-drops.js';
import { anketKapaticiyiBaslat } from '../../modules/engagement/anket-kapatici.js';
import { anketBaslat, anketBitir } from '../../modules/engagement/anket.js';

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
  const { title, keyword = '!katil', subBonusMultiplier = 1, costPoints = 0, durationMinutes = 10, winnerCount = 1, maxEntries = 0, subOnly = false, minWatchMinutes = 0 } = req.body;
  const r = giveaway.baslat({ title, keyword, subBonusMultiplier, costPoints, durationMinutes, winnerCount, maxEntries, subOnly, minWatchMinutes });
  if (r.giveaway) {
    eventBus.emitBotMessage({ platform: 'all', message: baslangicDuyurusu(r.giveaway) });
    wsHub.broadcastTo(['all'], { type: 'giveaway_started', giveaway: r.giveaway });
  }
  res.json({ success: true, giveaway: r.giveaway, ...(r.uyari ? { uyari: r.uyari } : {}) });
});

router.post('/giveaways/draw', (req: Request, res: Response) => {
  const baslik = giveaway.getActiveGiveaway()?.title || '';
  const winner = giveaway.pickWinner();
  if (winner) {
    // Notify OBS wheel widget
    wsHub.broadcastTo(['wheel', 'dashboard', 'all'], {
      type: 'giveaway_winner',
      winner
    });
    eventBus.emitBotMessage({ platform: 'all', message: kazananDuyurusu(baslik, winner) });
  }
  res.json({ winner });
});

router.post('/giveaways/update', (req: Request, res: Response) => {
  const onceki = giveaway.getActiveGiveaway();
  const g = giveaway.guncelle(req.body || {});
  if (!g) return res.status(404).json({ success: false, error: 'Açık çekiliş yok.' });
  if (onceki.keyword !== g.keyword) eventBus.emitBotMessage({ platform: 'all', message: `📢 Çekiliş katılım kelimesi değişti: sohbete ${g.keyword} yaz!` });
  wsHub.broadcastTo(['all'], { type: 'giveaway_join' });
  res.json({ success: true, giveaway: g });
});

router.post('/giveaways/reroll', (req: Request, res: Response) => {
  const winner = giveaway.yenidenCek();
  if (!winner) return res.status(404).json({ winner: null, error: 'Yeniden çekilecek katılımcı kalmadı.' });
  wsHub.broadcastTo(['wheel', 'dashboard', 'all'], { type: 'giveaway_winner', winner });
  eventBus.emitBotMessage({ platform: 'all', message: `🔁 Yeniden çekildi. ${kazananDuyurusu(winner.baslik, winner)}` });
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

router.post('/polls/create', async (req: Request, res: Response) => {
  const r = await anketBaslat(req.body || {});
  if (!r.ok) return res.status(400).json({ error: r.hata });
  res.json({ success: true, id: r.id });
});

router.post('/polls/end', async (req: Request, res: Response) => {
  await anketBitir();
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
