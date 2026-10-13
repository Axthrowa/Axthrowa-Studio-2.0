/**
 * StreamAxT API — Özel komutlar, zamanlayıcılar, alıntı/sayaç (extras)
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { timerManager } from '../../modules/timers/timers.js';
import { commandManager } from '../../modules/commands/command-manager.js';
import { extras } from '../../modules/extras/extras.js';
import { komutGirdisiniCoz } from '../../modules/commands/command-input.js';

const router = Router();

// 3. Commands CRUD
router.get('/commands', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM commands ORDER BY name ASC').all();
  res.json(rows);
});

// Komut oluşturma/düzenleme. Panel `user_level`/`is_enabled` (yılan),
// eski istemciler `userLevel`/`isEnabled` (deve) gönderiyor — ikisi de kabul
// edilir. ESKİDEN: seçilen rol yok sayılıyor, takma adlar kaydedilmiyor,
// düzenleme her seferinde HTTP 500 veriyordu (command-input.ts).
const KOMUT_SUTUNLARI = [
  'name',
  'response',
  'user_level',
  'cooldown',
  'aliases',
  'is_enabled',
  'description',
  'cooldown_mode',
  'user_cooldown',
  'cost_points',
  'min_level',
  'platforms',
  'trigger_type',
  'access_mode'
] as const;

router.post('/commands', (req: Request, res: Response) => {
  const g = komutGirdisiniCoz(req.body || {});
  if (!g.ok) return res.status(400).json({ error: g.hata });
  const k = g.kayit;

  const cakisan = db.prepare('SELECT id FROM commands WHERE LOWER(name) = ?').get(k.name);
  if (cakisan) return res.status(400).json({ error: `!${k.name} adlı bir komut zaten var` });

  const id = `cmd-${k.name.replace(/\s+/g, '-')}-${Date.now()}`;
  try {
    db.prepare(
      `INSERT INTO commands (id, use_count, ${KOMUT_SUTUNLARI.join(', ')})
       VALUES (?, 0, ${KOMUT_SUTUNLARI.map(() => '?').join(', ')})`
    ).run(id, ...KOMUT_SUTUNLARI.map((c) => (k as any)[c]));
    commandManager.reload();
    res.json({ success: true, id, komut: k });
  } catch (err: any) {
    res.status(400).json({ error: `Komut kaydedilemedi: ${String(err?.message || err).slice(0, 120)}` });
  }
});

router.put('/commands/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const mevcut = db.prepare('SELECT * FROM commands WHERE id = ?').get(id) as any;
  if (!mevcut) return res.status(404).json({ error: 'Komut bulunamadı' });

  // Gövdede olmayan alanlar MEVCUT değerden alınır (kısmi güncelleme)
  const g = komutGirdisiniCoz(req.body || {}, mevcut);
  if (!g.ok) return res.status(400).json({ error: g.hata });
  const k = g.kayit;

  const cakisan = db.prepare('SELECT id FROM commands WHERE LOWER(name) = ? AND id <> ?').get(k.name, id);
  if (cakisan) return res.status(400).json({ error: `!${k.name} adlı başka bir komut var` });

  db.prepare(`UPDATE commands SET ${KOMUT_SUTUNLARI.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
    ...KOMUT_SUTUNLARI.map((c) => (k as any)[c]),
    id
  );
  commandManager.reload();
  res.json({ success: true, komut: k });
});

router.delete('/commands/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM commands WHERE id = ?').run(String(id));
  commandManager.reload();
  res.json({ success: true });
});

// 4. Timers Management
router.get('/timers', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM timers ORDER BY name ASC').all();
  res.json(rows);
});

router.post('/timers', (req: Request, res: Response) => {
  const { name, messages, intervalMinutes = 15, minChatLines = 5, isEnabled = true } = req.body;
  const id = `timer-${Date.now()}`;

  db.prepare(`
    INSERT INTO timers (id, name, messages, interval_minutes, min_chat_lines, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, JSON.stringify(messages), intervalMinutes, minChatLines, isEnabled ? 1 : 0);

  timerManager.reload();
  res.json({ success: true, id });
});

router.put('/timers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, messages, intervalMinutes, minChatLines, isEnabled } = req.body;

  db.prepare(`
    UPDATE timers 
    SET name = ?, messages = ?, interval_minutes = ?, min_chat_lines = ?, is_enabled = ?
    WHERE id = ?
  `).run(name, JSON.stringify(messages), intervalMinutes, minChatLines, isEnabled ? 1 : 0, String(id));

  timerManager.reload();
  res.json({ success: true });
});

router.delete('/timers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM timers WHERE id = ?').run(String(id));
  timerManager.reload();
  res.json({ success: true });
});

router.get('/extras', (_req: Request, res: Response) => {
  res.json({
    settings: extras.getExtrasSettings(),
    quotes: extras.listQuotes(),
    counters: extras.listCounters()
  });
});

router.post('/extras', (req: Request, res: Response) => {
  res.json(extras.saveExtrasSettings(req.body || {}));
});

router.post('/quotes', (req: Request, res: Response) => {
  const { text, author } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json(extras.addQuote(text, author || 'panel'));
});

router.post('/counters', (req: Request, res: Response) => {
  const { name, delta } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(extras.bumpCounter(name, delta ?? 0));
});

export default router;
