/**
 * StreamAxT API — AutoMod, sohbet temizleme, Kalkan modu, sohbet kurtarma
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { wsHub } from '../../ws/server.js';
import { autoMod } from '../../modules/automod/automod.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { chatRescueService } from '../../modules/ai/chat-rescue.js';

const router = Router();

// Modül olaylarını açık panellere ve OBS kaynaklarına yayınla
shieldModeService.on('activated', (data) => {
  wsHub.broadcastTo(['all'], { type: 'shield_mode_update', active: true, moderator: data.moderator });
});
shieldModeService.on('deactivated', (data) => {
  wsHub.broadcastTo(['all'], { type: 'shield_mode_update', active: false, moderator: data.moderator });
});

chatRescueService.on('rescue_triggered', (data) => {
  wsHub.broadcastTo(['all'], {
    type: 'chat_message',
    id: uuidv4(),
    platform: 'streamaxt',
    user: {
      username: 'StreamAxT',
      displayName: '🤖 StreamAxT (Sohbet Kurtarma)',
      roles: ['bot', 'mod'],
      badges: ['bot']
    },
    message: data.message,
    timestamp: Date.now()
  });
});

// 5. AutoMod Settings
router.get('/automod', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM automod_settings WHERE id = 1').get() as any;
  if (row) {
    row.links_whitelist = JSON.parse(row.links_whitelist || '[]');
    row.blacklist_words = JSON.parse(row.blacklist_words || '[]');
  }
  const adv = db.prepare("SELECT value FROM bot_settings WHERE key = 'automod_advanced'").get() as { value: string } | undefined;
  try { row.advanced = adv?.value ? JSON.parse(adv.value) : {}; } catch { row.advanced = {}; }
  res.json(row);
});

router.post('/automod', (req: Request, res: Response) => {
  const {
    caps_enabled, caps_min_length, caps_max_percent,
    emotes_enabled, emotes_max, links_enabled, links_whitelist,
    symbols_enabled, symbols_max_percent, blacklist_words,
    ai_moderation_enabled, ai_toxicity_threshold, advanced
  } = req.body;

  db.prepare(`
    UPDATE automod_settings SET
      caps_enabled = ?, caps_min_length = ?, caps_max_percent = ?,
      emotes_enabled = ?, emotes_max = ?, links_enabled = ?, links_whitelist = ?,
      symbols_enabled = ?, symbols_max_percent = ?, blacklist_words = ?,
      ai_moderation_enabled = ?, ai_toxicity_threshold = ?
    WHERE id = 1
  `).run(
    caps_enabled ? 1 : 0, caps_min_length, caps_max_percent,
    emotes_enabled ? 1 : 0, emotes_max, links_enabled ? 1 : 0, JSON.stringify(links_whitelist || []),
    symbols_enabled ? 1 : 0, symbols_max_percent, JSON.stringify(blacklist_words || []),
    ai_moderation_enabled ? 1 : 0, ai_toxicity_threshold
  );

  // Kural basina ihlal eylemi (BotRix parity, GAP §4). Alan gonderilmemisse
  // MEVCUT deger korunur — eski panel surumu yeni ayarlari silmesin.
  const kurallar: Array<'caps' | 'emotes' | 'links' | 'symbols' | 'blacklist' | 'repeat'> = [
    'caps', 'emotes', 'links', 'symbols', 'blacklist', 'repeat'
  ];

  // Tekrarlanan mesaj kuralı (B9) — gönderilmeyen alan korunur
  const rb = req.body || {};
  if (rb.repeat_enabled !== undefined) {
    db.prepare('UPDATE automod_settings SET repeat_enabled = ? WHERE id = 1').run(rb.repeat_enabled ? 1 : 0);
  }
  if (rb.repeat_count !== undefined) {
    db.prepare('UPDATE automod_settings SET repeat_count = ? WHERE id = 1').run(Math.min(20, Math.max(2, Number(rb.repeat_count) || 3)));
  }
  if (rb.repeat_window !== undefined) {
    db.prepare('UPDATE automod_settings SET repeat_window = ? WHERE id = 1').run(Math.min(3600, Math.max(5, Number(rb.repeat_window) || 30)));
  }
  const eylemler = req.body?.actions || {};
  for (const k of kurallar) {
    const a = eylemler[k];
    if (!a) continue;
    if (a.action !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_action = ? WHERE id = 1`).run(String(a.action));
    }
    if (a.timeout !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_timeout = ? WHERE id = 1`).run(Number(a.timeout) || 60);
    }
    if (a.message !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_message = ? WHERE id = 1`).run(String(a.message));
    }
    if (a.bypass !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_bypass = ? WHERE id = 1`).run(
        JSON.stringify(Array.isArray(a.bypass) ? a.bypass : [])
      );
    }
  }

  autoMod.reload();
  if (advanced) {
    db.prepare(`INSERT INTO bot_settings (key, value) VALUES ('automod_advanced', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(advanced));
  }
  res.json({ success: true });
});

// 16. Chat Clear Action (One-click)
router.post('/chat/clear', (req: Request, res: Response) => {
  wsHub.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'clear_chat' });
  res.json({ success: true, message: 'Canlı sohbet başarıyla temizlendi' });
});

// 3. Shield Mode & Moderation Security
router.get('/moderation/shield', (req: Request, res: Response) => {
  res.json(shieldModeService.getSettings());
});

router.post('/moderation/shield/activate', (req: Request, res: Response) => {
  const { moderator = 'Yayıncı' } = req.body;
  const updated = shieldModeService.activate(moderator);
  // Auto clear raid messages if enabled
  if (updated.autoClearRaidMessages) {
    wsHub.broadcastTo(['all'], { type: 'clear_chat' });
  }
  res.json({ success: true, settings: updated });
});

router.post('/moderation/shield/deactivate', (req: Request, res: Response) => {
  const { moderator = 'Yayıncı' } = req.body;
  const updated = shieldModeService.deactivate(moderator);
  res.json({ success: true, settings: updated });
});

router.get('/moderation/audit-logs', (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const filter = req.query.action ? String(req.query.action) : undefined;
  const logs = shieldModeService.getAuditLogs(limit, filter);
  res.json(logs);
});

router.get('/moderation/shared-bans', (req: Request, res: Response) => {
  res.json(shieldModeService.getSharedBans());
});

router.post('/moderation/shared-bans', (req: Request, res: Response) => {
  const { username, reason = 'Spam/Raid hesabı', addedBy = 'Moderatör' } = req.body;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı zorunludur' });
  const ok = shieldModeService.addSharedBan(username, reason, addedBy);
  res.json({ success: ok });
});

router.delete('/moderation/shared-bans/:username', (req: Request, res: Response) => {
  const username = String(req.params.username || '');
  const removedBy = String(req.body.removedBy || 'Moderatör');
  const ok = shieldModeService.removeSharedBan(username, removedBy);
  res.json({ success: ok });
});

// 4. Sohbet Kurtarma (Chat Rescue)
router.get('/chat-rescue/settings', (req: Request, res: Response) => {
  res.json(chatRescueService.getSettings());
});

router.post('/chat-rescue/settings', (req: Request, res: Response) => {
  const updated = chatRescueService.saveSettings(req.body);
  res.json(updated);
});

router.post('/chat-rescue/trigger', async (req: Request, res: Response) => {
  try {
    const message = await chatRescueService.triggerRescue('manual');
    shieldModeService.addAuditLog('CHAT_RESCUE_TRIGGERED', 'Yayıncı', `Sohbet kurtarma mesajı yayınlandı: ${message}`);
    res.json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Sohbet kurtarılamadı' });
  }
});

export default router;
