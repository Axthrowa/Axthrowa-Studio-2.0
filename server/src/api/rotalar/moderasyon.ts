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
import { kelimeListesiDerle } from '../../modules/automod/kelime-kurali.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { KALKAN_DESTEKLENMEYEN } from '../../modules/moderation/shield-rules.js';
import { elleModerasyonCoz, kalkanAyariniCoz, MODERASYON_PLATFORMLARI, type ElleEylem } from '../../modules/moderation/moderation-input.js';
import { sohbetModuGovdesi } from '../../platforms/twitch-rules.js';
import { platformManager } from '../../platforms/manager.js';
import { yetenek } from '../../platforms/capabilities.js';
import { chatRescueService } from '../../modules/ai/chat-rescue.js';

const GECERLI_EYLEMLER = new Set(['warn', 'timeout', 'timeout_warn', 'delete', 'delete_warn']);
const GECERLI_MUAF = new Set(['regular', 'sub', 'vip', 'og', 'mod', 'broadcaster']);

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
    // Bilinmeyen eylem/rol kaydedilmez (eskiden her metin olduğu gibi yazılıyordu)
    if (a.action !== undefined && GECERLI_EYLEMLER.has(String(a.action))) {
      db.prepare(`UPDATE automod_settings SET ${k}_action = ? WHERE id = 1`).run(String(a.action));
    }
    if (a.timeout !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_timeout = ? WHERE id = 1`).run(
        Math.min(1_209_600, Math.max(1, Math.floor(Number(a.timeout)) || 60))
      );
    }
    if (a.message !== undefined) {
      db.prepare(`UPDATE automod_settings SET ${k}_message = ? WHERE id = 1`).run(String(a.message).slice(0, 500));
    }
    if (a.bypass !== undefined) {
      const roller = Array.isArray(a.bypass) ? a.bypass.map(String).filter((r: string) => GECERLI_MUAF.has(r)) : [];
      db.prepare(`UPDATE automod_settings SET ${k}_bypass = ? WHERE id = 1`).run(JSON.stringify([...new Set(roller)]));
    }
  }

  if (advanced) {
    db.prepare(`INSERT INTO bot_settings (key, value) VALUES ('automod_advanced', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(advanced));
  }
  // Gelişmiş ayarlar yazıldıktan SONRA tazele (eskiden önce tazeleniyordu; yeni ayar 1 dk gecikiyordu)
  autoMod.reload();
  // Derlenemeyen / riskli (felaket geri izlemeli) kara liste kalıpları panelde gösterilsin
  let gecersizKaliplar: string[] = [];
  try {
    const r = db.prepare('SELECT blacklist_words FROM automod_settings WHERE id = 1').get() as any;
    gecersizKaliplar = kelimeListesiDerle(JSON.parse(r?.blacklist_words || '[]')).gecersiz;
  } catch {
    /* bozuk kayıt */
  }
  res.json({ success: true, gecersizKaliplar });
});

// 16. Chat Clear Action (One-click)
router.post('/chat/clear', (req: Request, res: Response) => {
  wsHub.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'clear_chat' });
  res.json({ success: true, message: 'Canlı sohbet başarıyla temizlendi' });
});

// 3. Shield Mode & Moderation Security
router.get('/moderation/shield', (req: Request, res: Response) => {
  // Uygulanamayan ayarlar arayüzde "desteklenmiyor" diye gösterilsin
  res.json({ ...shieldModeService.getSettings(), engellenenMesaj: shieldModeService.engellenenSayisi(), desteklenmeyen: KALKAN_DESTEKLENMEYEN });
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
  const { username, reason = 'Spam/Raid hesabı', addedBy = 'Moderatör', platform } = req.body || {};
  if (!String(username || '').trim()) return res.status(400).json({ error: 'Kullanıcı adı zorunludur' });
  const ok = shieldModeService.addSharedBan(String(username), String(reason), String(addedBy), platform);
  if (!ok) return res.status(400).json({ error: 'Geçersiz kullanıcı adı' });
  res.json({ success: ok });
});

// Kalkan ayarları (4. tur): eskiden kaydeden bir uç YOKTU; ayarlar yalnız
// varsayılanlarla çalışıyordu. `isActive` burada değişmez (activate/deactivate).
router.post('/moderation/shield/settings', (req: Request, res: Response) => {
  const girdi = kalkanAyariniCoz(req.body);
  if (!Object.keys(girdi).length) return res.status(400).json({ error: 'Geçerli ayar yok' });
  res.json({ success: true, settings: shieldModeService.saveSettings(girdi) });
});

// Panel izleyici kartından elle moderasyon (4. tur). GERÇEK platform eylemi:
// yalnız yayıncının tıklamasıyla çalışır; sonuç denetim günlüğüne yazılır.
async function elleModerasyon(eylem: ElleEylem, req: Request, res: Response) {
  const c = elleModerasyonCoz(req.body, eylem);
  if (!c.ok) return res.status(400).json({ ok: false, hata: c.hata });

  const y = yetenek(c.platform).moderasyon;
  if (!(eylem === 'timeout' ? y.timeout : y.ban)) {
    return res.status(400).json({
      ok: false,
      hata: `${c.platform} ${eylem === 'timeout' ? 'zaman aşımını' : 'kalıcı banı'} desteklemiyor`
    });
  }
  const p: any = platformManager.getPlatform(c.platform);
  const yontem = eylem === 'timeout' ? 'timeoutUser' : eylem === 'ban' ? 'banUser' : 'unbanUser';
  if (!p?.isConnected?.() || typeof p[yontem] !== 'function') {
    return res.status(400).json({ ok: false, hata: `${c.platform} bağlı değil` });
  }

  const sonuc =
    eylem === 'timeout'
      ? await p.timeoutUser(c.ad, c.saniye, c.sebep)
      : eylem === 'ban'
        ? await p.banUser(c.ad, c.sebep)
        : await p.unbanUser(c.ad);

  const ne = eylem === 'timeout' ? `${Math.round(c.saniye / 60)} dk zaman aşımı` : eylem === 'ban' ? 'kalıcı ban' : 'ban kaldırma';
  shieldModeService.addAuditLog(
    `MANUAL_${eylem.toUpperCase()}`,
    'Yayıncı',
    `${c.platform}: ${ne} ${sonuc?.ok ? 'uygulandı' : `başarısız — ${sonuc?.hata || 'bilinmeyen hata'}`}${eylem === 'unban' ? '' : `. Sebep: ${c.sebep}`}`,
    c.ad,
    sonuc?.ok ? (eylem === 'unban' ? 'info' : 'danger') : 'warn'
  );
  res.status(sonuc?.ok ? 200 : 502).json(sonuc?.ok ? { ok: true } : { ok: false, hata: sonuc?.hata || 'bilinmeyen hata' });
}

router.post('/moderation/timeout', (req: Request, res: Response) => void elleModerasyon('timeout', req, res));
router.post('/moderation/ban', (req: Request, res: Response) => void elleModerasyon('ban', req, res));
router.post('/moderation/unban', (req: Request, res: Response) => void elleModerasyon('unban', req, res));

// Kontrol Merkezi sohbetinden tek mesaj silme. GERÇEK platform eylemi: yalnız yayıncının/moderatörün
// tıklamasıyla; yetenek + bağlantı denetimi; sonuç denetim günlüğüne yazılır.
router.post('/moderation/delete-message', async (req: Request, res: Response) => {
  const platform = String(req.body?.platform ?? '').trim().toLowerCase();
  const mesajId = String(req.body?.messageId ?? '').trim();
  if (!(MODERASYON_PLATFORMLARI as readonly string[]).includes(platform)) return res.status(400).json({ ok: false, hata: 'Geçersiz platform' });
  if (!mesajId || mesajId.length > 200 || /[\s\u0000-\u001f]/.test(mesajId)) return res.status(400).json({ ok: false, hata: 'Geçersiz mesaj kimliği' });
  if (!yetenek(platform).moderasyon.mesajSil) return res.status(400).json({ ok: false, hata: `${platform} mesaj silmeyi desteklemiyor` });
  const p: any = platformManager.getPlatform(platform);
  if (!p?.isConnected?.() || typeof p.deleteMessage !== 'function') return res.status(400).json({ ok: false, hata: `${platform} bağlı değil` });
  const sonuc = await p.deleteMessage(mesajId);
  shieldModeService.addAuditLog(
    'MANUAL_DELETE_MESSAGE',
    String(req.body?.actor || 'Yayıncı').slice(0, 40),
    `${platform}: mesaj silme ${sonuc?.ok ? 'uygulandı' : `başarısız — ${sonuc?.hata || 'bilinmeyen hata'}`}`,
    String(req.body?.username || '').slice(0, 60) || undefined,
    sonuc?.ok ? 'info' : 'warn'
  );
  res.status(sonuc?.ok ? 200 : 502).json(sonuc?.ok ? { ok: true } : { ok: false, hata: sonuc?.hata || 'bilinmeyen hata' });
});

// Sohbet modları (yavaş / takipçi / abone / emote / benzersiz). Bugün yalnız Twitch Helix'te API var.
router.post('/moderation/chat-mode', async (req: Request, res: Response) => {
  const platform = String(req.body?.platform ?? '').trim().toLowerCase();
  if (!(MODERASYON_PLATFORMLARI as readonly string[]).includes(platform)) return res.status(400).json({ ok: false, hata: 'Geçersiz platform' });
  if (!yetenek(platform).moderasyon.sohbetModlari) {
    return res.status(400).json({ ok: false, hata: `${platform} sohbet modlarını API ile değiştirmeye izin vermiyor` });
  }
  const g = sohbetModuGovdesi(req.body);
  if (!g.ok) return res.status(400).json({ ok: false, hata: g.hata });
  const p: any = platformManager.getPlatform(platform);
  if (!p?.isConnected?.() || typeof p.sohbetModu !== 'function') return res.status(400).json({ ok: false, hata: `${platform} bağlı değil` });
  const sonuc = await p.sohbetModu(g.govde);
  shieldModeService.addAuditLog(
    'CHAT_MODE_CHANGED',
    String(req.body?.actor || 'Yayıncı').slice(0, 40),
    `${platform}: sohbet modu ${JSON.stringify(g.govde)} ${sonuc?.ok ? 'uygulandı' : `başarısız — ${sonuc?.hata || 'bilinmeyen hata'}`}`,
    undefined,
    sonuc?.ok ? 'info' : 'warn'
  );
  res.status(sonuc?.ok ? 200 : 502).json(sonuc?.ok ? { ok: true, uygulanan: g.govde } : { ok: false, hata: sonuc?.hata || 'bilinmeyen hata' });
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
