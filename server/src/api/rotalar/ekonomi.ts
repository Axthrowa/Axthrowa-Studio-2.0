/**
 * StreamAxT API — Puan sıralaması, seviyeler, sadakat ayarları/ödülleri, ödül kullanımları
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { wsHub } from '../../ws/server.js';
import economyService from '../../modules/economy/economy.js';
import { seviyeler } from '../../modules/levels/levels.js';
import { istatistikler, istatistikSil } from '../../modules/community/istatistik-sil.js';
import { hataMetni } from '../../core/logger.js';

const router = Router();

// 7. Economy & Leaderboard
router.get('/economy/leaderboard', (req: Request, res: Response) => {
  // Puanlar bellekte tutuluyor ve diske seyrek yazılıyor; sıralama bayat
  // kalmasın diye önce hepsini yaz.
  try {
    economyService.flushAll();
  } catch (e) {
    console.warn('[Ekonomi] Sıralama öncesi puanlar diske yazılamadı (liste bayat olabilir):', hataMetni(e));
  }
  const sort = String(req.query.sort || 'points');
  const allowed = ['points', 'watch_time_minutes', 'messages_count'];
  const col = allowed.includes(sort) ? sort : 'points';
  const users = db.prepare(`SELECT * FROM economy ORDER BY ${col} DESC LIMIT 50`).all();
  res.json(users);
});

// 9.1 Seviye / XP sistemi
router.get('/levels/settings', (req: Request, res: Response) => {
  res.json(seviyeler.ayarOku());
});

router.post('/levels/settings', (req: Request, res: Response) => {
  res.json(seviyeler.ayarYaz(req.body || {}));
});

router.get('/levels/leaderboard', (req: Request, res: Response) => {
  res.json(seviyeler.siralama(Number(req.query.limit) || 10));
});

router.get('/levels/:username', (req: Request, res: Response) => {
  res.json(seviyeler.kullanici(String(req.params.username || '')));
});

/** BotRix'teki "Siralamalar > Sifirla" karsiligi. */
router.post('/levels/reset', (req: Request, res: Response) => {
  const neyi = String(req.body?.neyi || 'xp') as 'xp' | 'puan' | 'ikisi';
  if (!['xp', 'puan', 'ikisi'].includes(neyi)) return res.status(400).json({ error: 'neyi: xp | puan | ikisi' });
  res.json(seviyeler.sifirla(neyi));
});

router.get('/istatistikler', (_req: Request, res: Response) => res.json(istatistikler()));

router.post('/istatistikler/sil', (req: Request, res: Response) => {
  if (!istatistikSil(String(req.body?.grup || ''))) return res.status(400).json({ error: 'Bilinmeyen istatistik grubu' });
  res.json({ success: true, gruplar: istatistikler() });
});

// 13. Loyalty Settings & Rewards
router.get('/economy/loyalty-settings', (req: Request, res: Response) => {
  const getVal = (key: string, def: string) => {
    const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key) as any;
    return row ? row.value : def;
  };

  res.json({
    pointsPerMessage: parseInt(getVal('points_per_message', '2'), 10),
    pointsPerInterval: parseInt(getVal('points_per_interval', '15'), 10),
    intervalMinutes: parseInt(getVal('interval_minutes', '5'), 10),
    pointsPerSub: parseInt(getVal('points_per_sub', '500'), 10),
    pointsPerGiftedSub: parseInt(getVal('points_per_gifted_sub', '1000'), 10),
    pointsPerTipUnit: parseInt(getVal('points_per_tip_unit', '50'), 10)
  });
});

router.post('/economy/loyalty-settings', (req: Request, res: Response) => {
  const { pointsPerMessage, pointsPerInterval, pointsPerSub, pointsPerGiftedSub, pointsPerTipUnit } = req.body;
  const upsert = db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  if (pointsPerMessage !== undefined) upsert.run('points_per_message', String(pointsPerMessage));
  if (pointsPerInterval !== undefined) upsert.run('points_per_interval', String(pointsPerInterval));
  if (pointsPerSub !== undefined) upsert.run('points_per_sub', String(pointsPerSub));
  if (pointsPerGiftedSub !== undefined) upsert.run('points_per_gifted_sub', String(pointsPerGiftedSub));
  if (pointsPerTipUnit !== undefined) upsert.run('points_per_tip_unit', String(pointsPerTipUnit));

  res.json({ success: true });
});

router.get('/economy/rewards', (req: Request, res: Response) => {
  const rewards = db.prepare('SELECT * FROM loyalty_rewards').all();
  res.json(rewards);
});

router.post('/economy/rewards', (req: Request, res: Response) => {
  const { id, title, cost, reward_type, payload, is_enabled } = req.body;
  const rewardId = id || `reward-${Date.now()}`;
  db.prepare(`
    INSERT INTO loyalty_rewards (id, title, cost, reward_type, payload, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      cost = excluded.cost,
      reward_type = excluded.reward_type,
      payload = excluded.payload,
      is_enabled = excluded.is_enabled
  `).run(rewardId, title, cost, reward_type, payload || '', is_enabled ? 1 : 0);

  res.json({ success: true, id: rewardId });
});

// 17. Loyalty Redemptions Queue & Actions
router.get('/economy/redemptions', (req: Request, res: Response) => {
  const status = req.query.status ? String(req.query.status) : '';
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM loyalty_redemptions WHERE status = ? ORDER BY created_at DESC LIMIT 100').all(status);
  } else {
    rows = db.prepare('SELECT * FROM loyalty_redemptions ORDER BY created_at DESC LIMIT 100').all();
  }
  res.json(rows);
});

router.post('/economy/redemptions/:id/status', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const status = String(req.body.status || ''); // 'completed' | 'refunded'
  const sonuc = economyService.talepDurumu(id, status);
  if (!sonuc.ok) return res.status(sonuc.kod).json({ success: false, error: sonuc.hata });

  wsHub.broadcastTo(['all', 'dashboard'], {
    type: 'loyalty_redemption_updated',
    id,
    status
  });

  res.json({ success: true, message: `Talep durumu güncellendi: ${status}` });
});

export default router;
