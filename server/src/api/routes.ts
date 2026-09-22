import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { platformManager } from '../platforms/manager.js';
import { kickPlatform } from '../platforms/kick.js';
import { songRequest } from '../modules/songrequest/songrequest.js';
import { giveaway } from '../modules/giveaways/giveaways.js';
import { wsHub } from '../ws/server.js';
import { timerManager } from '../modules/timers/timers.js';
import { getStreamUptime } from '../core/variable-parser.js';
import { commandManager } from '../modules/commands/command-manager.js';
import { autoMod } from '../modules/automod/automod.js';
import { settingsCache } from '../core/settings-cache.js';
import { gamesEngine } from '../modules/games/games.js';
import { triviaEngine } from '../modules/games/trivia-engine.js';
import { GoogleGenAI } from '@google/genai';
import { multiEngineTTS } from '../modules/tts/tts-engine.js';
import { shieldModeService } from '../modules/moderation/shield-mode.js';
import { chatRescueService } from '../modules/ai/chat-rescue.js';
import { kingSystemService } from '../modules/games/king-system.js';
import { geminiCoHost } from '../modules/ai/gemini.js';
import economyService from '../modules/economy/economy.js';
import { ttsEngine } from '../modules/tts/tts.js';
import { syncTriviaBank } from '../modules/games/trivia-sync.js';
import { extras } from '../modules/extras/extras.js';
import crypto from 'crypto';
import { temizle, gizliMi, yeniSirDegeri, maskeDegeriMi } from '../core/security/redact.js';
import { degiskenKatalogu, degiskenSayisi, baglamOlustur, degiskenleriCoz } from '../core/variables/index.js';
import { YETENEKLER } from '../platforms/capabilities.js';
import { subathon } from '../modules/subathon/subathon.js';
import { seviyeler } from '../modules/levels/levels.js';
import { sohbetUyarilari } from '../modules/chat-alerts/chat-alerts.js';
import { medya, MAKS_BOYUT, MAKS_TOPLAM } from '../modules/media/media.js';
import { varyantlar } from '../modules/alerts/variants.js';
import { EYLEM_SECENEKLERI, TIMEOUT_KADEMELERI } from '../modules/automod/enforcement.js';

const router = Router();
let kickPkceVerifier = '';

// Broadcast StreamAxT module events to connected dashboards and OBS overlays
kingSystemService.on('king_crowned', (state) => {
  wsHub.broadcastTo(['all'], { type: 'king_update', state });
});
kingSystemService.on('king_reset', (state) => {
  wsHub.broadcastTo(['all'], { type: 'king_update', state });
});

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


// 1. System Overview & Status
router.get('/status', (req: Request, res: Response) => {
  const platforms = platformManager.getAllStatuses();
  const commandsCount = (db.prepare('SELECT COUNT(*) as cnt FROM commands').get() as any).cnt;
  const timersCount = (db.prepare('SELECT COUNT(*) as cnt FROM timers WHERE is_enabled = 1').get() as any).cnt;
  const queueCount = (db.prepare('SELECT COUNT(*) as cnt FROM song_queue WHERE is_played = 0').get() as any).cnt;
  const activeGiveaway = giveaway.getActiveGiveaway();

  res.json({
    uptime: getStreamUptime(),
    platforms,
    stats: {
      commandsCount,
      timersCount,
      queueCount,
      hasActiveGiveaway: Boolean(activeGiveaway)
    }
  });
});

// 2. Platforms Management
router.get('/platforms', (req: Request, res: Response) => {
  // GUVENLIK: bu uc eskiden `SELECT *` sonucunu oldugu gibi donduruyordu;
  // yanit Kick OAuth tokenini DUZ METIN tasiyordu. Artik maskelenir ve
  // panele yalniz "tokenVar: true/false" bilgisi gider.
  const channels = temizle(db.prepare('SELECT * FROM channels').all());
  const liveStatuses = platformManager.getAllStatuses();
  res.json({ channels, liveStatuses });
});

router.post('/platforms/save', async (req: Request, res: Response) => {
  const { platform, channelName, accountId, token, refreshToken, isActive } = req.body;

  if (!platform || !channelName) {
    return res.status(400).json({ error: 'Platform ve kanal ismi zorunludur' });
  }

  const existing = db.prepare('SELECT * FROM channels WHERE platform = ?').get(platform) as any;
  if (existing) {
    // Panel artik gercek tokeni gormuyor; alan bos veya maskeli geldiginde
    // KAYITLI deger korunur. Aksi halde her kaydetme tokeni silerdi.
    const yeniToken = yeniSirDegeri(token, existing.token ?? null);
    const yeniRefresh = yeniSirDegeri(refreshToken, existing.refresh_token ?? null);
    db.prepare(`
      UPDATE channels 
      SET channel_name = ?, account_id = ?, token = ?, refresh_token = ?, is_active = ?
      WHERE platform = ?
    `).run(channelName, accountId || null, yeniToken, yeniRefresh, isActive ? 1 : 0, platform);
  } else {
    db.prepare(`
      INSERT INTO channels (id, platform, channel_name, account_id, token, refresh_token, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), platform, channelName, accountId || null, token || null, refreshToken || null, isActive ? 1 : 0, Date.now());
  }

  // Reconnect platform
  if (isActive) {
    await platformManager.reconnect(platform);
  } else {
    await platformManager.disconnect(platform);
  }

  res.json({ success: true });
});

// Kick Platform Specific Endpoints (Connect, Verification, Test Message, OAuth)
router.post('/platforms/kick/connect', async (req: Request, res: Response) => {
  const { channelName, token, clientId, clientSecret, code } = req.body;
  const slug = (channelName || '').trim().toLowerCase();

  if (!slug) {
    return res.status(400).json({ success: false, error: 'Kick kanal adı gereklidir' });
  }

  let finalToken = (token || '').trim();

  // If OAuth code and credentials provided, exchange for access token
  const oauthCode = code || (token && !token.startsWith('Bearer') && token.length > 20 && !token.includes('.') ? token : '');
  if (oauthCode && clientId && clientSecret) {
    try {
      const redirectUri = 'http://localhost:3001/api/auth/kick/callback';
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('code', oauthCode);
      if (kickPkceVerifier) {
        params.append('code_verifier', kickPkceVerifier);
      }

      const tokenRes = await axios.post('https://id.kick.com/oauth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });

      if (tokenRes.data?.access_token) {
        finalToken = tokenRes.data.access_token;
      }
    } catch (err: any) {
      console.warn('[Kick Connect] OAuth token exchange error:', err?.response?.data || err.message);
    }
  }

  // Verify channel existence & chatroom ID
  const verification = await kickPlatform.verifyChannel(slug, finalToken);
  if (!verification.success) {
    return res.status(400).json({
      success: false,
      error: verification.error || 'Kick kanalı doğrulanamadı. Kullanıcı adını kontrol edin.'
    });
  }

  // Save to database
  const existing = db.prepare("SELECT * FROM channels WHERE platform = 'kick'").get() as any;
  if (existing) {
    db.prepare(`
      UPDATE channels 
      SET channel_name = ?, account_id = ?, token = ?, is_active = 1
      WHERE platform = 'kick'
    `).run(slug, String(verification.broadcasterUserId || ''), finalToken);
  } else {
    db.prepare(`
      INSERT INTO channels (id, platform, channel_name, account_id, token, is_active, created_at)
      VALUES (?, 'kick', ?, ?, ?, 1, ?)
    `).run(uuidv4(), slug, String(verification.broadcasterUserId || ''), finalToken, Date.now());
  }

  // Save kick credentials in bot_settings if provided
  if (clientId) settingsCache.set('kick_client_id', clientId);
  if (clientSecret) settingsCache.set('kick_client_secret', clientSecret);

  // Reconnect Kick platform immediately
  await platformManager.reconnect('kick');

  res.json({
    success: true,
    message: `Kick kanalı @${slug} başarıyla bağlandı! Canlı sohbet ve olay dinleyicisi aktif.`,
    verification
  });
});

router.post('/platforms/kick/verify', async (req: Request, res: Response) => {
  const channelSlug = (req.body.channelSlug || req.body.channelName || '').trim();
  let token = (req.body.token || '').trim();
  if (!channelSlug) {
    return res.status(400).json({ success: false, error: 'Kanal adı gereklidir' });
  }
  // Panel artik tokeni gormuyor: bos veya maskeli geldiginde kayitli token
  // sunucu tarafinda okunur. Dogrulama boylece calismaya devam eder.
  if (!token || maskeDegeriMi(token)) {
    const kayit = db.prepare("SELECT token FROM channels WHERE platform = 'kick'").get() as { token?: string } | undefined;
    token = (kayit?.token || '').trim();
  }
  const result = await kickPlatform.verifyChannel(channelSlug, token);
  res.json(result);
});

router.post('/platforms/kick/test-message', async (req: Request, res: Response) => {
  const { message, channel } = req.body;
  const channelName = channel || kickPlatform.getStatus().channel || '';
  const testMsg = message || '🟢 [StreamAxT] Kick API & Chat bağlantısı başarıyla doğrulandı! Bot aktif.';
  const result = await kickPlatform.sendKickMessage(channelName, testMsg);
  res.json(result);
});

router.get('/platforms/kick/auth-url', (req: Request, res: Response) => {
  const clientId = ((req.query.clientId as string) || settingsCache.get('kick_client_id') || '').trim();
  if (!clientId || clientId === 'stream-axt-bot') {
    return res.status(400).json({ 
      error: 'Kick Client ID girilmedi! Lütfen kick.com/settings/developer adresinden oluşturduğunuz App Client ID\'yi girin.' 
    });
  }
  const redirectUri = (req.query.redirectUri as string) || 'http://localhost:3001/api/auth/kick/callback';
  
  // PKCE & State Generation
  kickPkceVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(kickPkceVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const scope = encodeURIComponent('chat:write channel:read user:read');
  const authUrl = `https://id.kick.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=${encodeURIComponent(state)}&prompt=login`;
  res.json({ authUrl, clientId, redirectUri, codeVerifier: kickPkceVerifier, state });
});

router.get('/auth/kick/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.send(`
      <!DOCTYPE html>
      <html><body style="font-family:sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="background:#1e293b;padding:32px;border-radius:16px;text-align:center;max-width:400px;border:1px solid rgba(239,68,68,0.3);">
          <h2 style="color:#ef4444;margin-top:0;">Kick Yetkilendirme Hatası</h2>
          <p style="color:#94a3b8;font-size:14px;">${error || 'Yetki kodu alınamadı.'}</p>
          <button onclick="window.close()" style="margin-top:16px;padding:10px 20px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Pencereyi Kapat</button>
        </div>
      </body></html>
    `);
  }

  const clientId = settingsCache.get('kick_client_id') || '';
  const clientSecret = settingsCache.get('kick_client_secret') || '';
  const redirectUri = 'http://localhost:3001/api/auth/kick/callback';
  let accessToken = '';

  if (clientId && clientSecret && kickPkceVerifier) {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('code', String(code));
      params.append('code_verifier', kickPkceVerifier);

      const tokenRes = await axios.post('https://id.kick.com/oauth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });

      if (tokenRes.data?.access_token) {
        accessToken = tokenRes.data.access_token;
        const refreshToken = tokenRes.data.refresh_token || null;
        const expiresAt = Date.now() + ((tokenRes.data.expires_in || 3600) * 1000);
        const kickRow = db.prepare("SELECT * FROM channels WHERE platform = 'kick'").get() as any;
        if (kickRow) {
          db.prepare("UPDATE channels SET token = ?, refresh_token = ?, token_expires_at = ?, is_active = 1 WHERE platform = 'kick'").run(accessToken, refreshToken, expiresAt);
          await platformManager.reconnect('kick');
        } else {
          let autoSlug = 'kick_streamer';
          let autoUserId = '';
          try {
            const userCheck = await axios.get('https://api.kick.com/public/v1/users', {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 5000
            });
            const userData = userCheck.data?.data?.[0];
            if (userData?.name) {
              autoSlug = String(userData.name).toLowerCase();
              autoUserId = String(userData.user_id || '');
            }
          } catch {}

          db.prepare(`
            INSERT INTO channels (id, platform, channel_name, account_id, token, refresh_token, token_expires_at, is_active, created_at)
            VALUES (?, 'kick', ?, ?, ?, ?, ?, 1, ?)
          `).run(uuidv4(), autoSlug, autoUserId, accessToken, refreshToken, expiresAt, Date.now());
          await platformManager.reconnect('kick');
        }
      }
    } catch (err: any) {
      console.warn('[Kick OAuth Callback Exchange]:', err?.response?.data || err.message);
    }
  }

  // Broadcast to all open dashboards (including when authorized from an incognito window)
  wsHub.broadcastTo(['dashboard', 'all'], {
    type: 'kick_auth_success',
    code: String(code),
    token: accessToken
  });

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Kick Yetkilendirmesi - StreamAxT</title></head>
    <body style="font-family:system-ui, -apple-system, sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="background:#1e293b;padding:36px;border-radius:20px;text-align:center;max-width:500px;border:1px solid rgba(83,252,24,0.4);box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <div style="font-size:42px;margin-bottom:12px;">✅</div>
        <h2 style="color:#53fc18;margin:0 0 12px 0;font-size:22px;">${accessToken ? 'Kick Yetkilendirmesi Başarılı!' : 'Kick Yetki Kodu Alındı!'}</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:20px;">
          ${accessToken 
            ? 'Bot hesabınız başarıyla StreamAxT\'ye bağlandı! Erişim anahtarı (Access Token) kaydedildi. Artık botunuz yayın sohbetine mesaj gönderebilir.' 
            : 'Kick yetki kodu StreamAxT sistemine iletildi: <br/><code style="background:#0f172a;padding:4px 8px;border-radius:6px;color:#53fc18;word-break:break-all;">' + code + '</code>'}
        </p>
        <div style="background:rgba(83,252,24,0.08);border:1px dashed rgba(83,252,24,0.3);padding:12px;border-radius:12px;margin-bottom:20px;font-size:13px;color:#cbd5e1;">
          💡 Bu pencereyi (veya Gizli Sekmeyi) kapatıp <b>StreamAxT Paneline</b> dönebilirsiniz. Bağlantı otomatik olarak algılanmıştır.
        </div>
        <button onclick="window.close()" style="padding:12px 28px;background:#53fc18;color:#000;border:none;border-radius:10px;font-weight:900;font-size:14px;cursor:pointer;transition:transform 0.1s;">
          Pencereyi Kapat
        </button>
      </div>
      <script>
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'KICK_AUTH_SUCCESS', code: '${code}', token: '${accessToken || ''}' }, '*');
            setTimeout(() => window.close(), 1800);
          } catch(e) {}
        }
      </script>
    </body></html>
  `);
});

// 3. Commands CRUD
router.get('/commands', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM commands ORDER BY name ASC').all();
  res.json(rows);
});

router.post('/commands', (req: Request, res: Response) => {
  const { name, response, userLevel = 'everyone', cooldown = 5, description = '' } = req.body;
  if (!name || !response) {
    return res.status(400).json({ error: 'Komut adı ve cevabı gereklidir' });
  }

  const cleanName = name.replace(/^!/, '').toLowerCase();
  const id = `cmd-${cleanName}-${Date.now()}`;

  try {
    db.prepare(`
      INSERT INTO commands (id, name, response, user_level, cooldown, aliases, is_enabled, use_count, description)
      VALUES (?, ?, ?, ?, ?, '[]', 1, 0, ?)
    `).run(id, cleanName, response, userLevel, cooldown, description);
    commandManager.reload();
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: 'Bu isimde bir komut zaten var' });
  }
});

router.put('/commands/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, response, userLevel, cooldown, isEnabled, description } = req.body;

  const cleanName = name.replace(/^!/, '').toLowerCase();
  db.prepare(`
    UPDATE commands 
    SET name = ?, response = ?, user_level = ?, cooldown = ?, is_enabled = ?, description = ?
    WHERE id = ?
  `).run(cleanName, response, userLevel, cooldown, isEnabled ? 1 : 0, description, String(id));

  commandManager.reload();
  res.json({ success: true });
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
  const kurallar: Array<'caps' | 'emotes' | 'links' | 'symbols' | 'blacklist'> = [
    'caps', 'emotes', 'links', 'symbols', 'blacklist'
  ];
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

// 6. Song Request Queue & Desktop Player
router.get('/songrequest/queue', (req: Request, res: Response) => {
  const current = songRequest.getCurrentSong();
  const queue = songRequest.getQueueList();
  res.json({ current, queue });
});

router.post('/songrequest/skip', (req: Request, res: Response) => {
  const result = songRequest.skipSong(true);
  res.json(result);
});

router.delete('/songrequest/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM song_queue WHERE id = ?').run(String(id));
  res.json({ success: true });
});

router.post('/songrequest/open-desktop', (req: Request, res: Response) => {
  const { player, title, url } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Şarkı başlığı gereklidir' });
  }
  const targetPlayer = player === 'ytmusic' ? 'ytmusic' : 'spotify';
  const success = songRequest.openDesktopPlayer(targetPlayer, title, url);
  res.json({
    success,
    message: success
      ? `${targetPlayer === 'spotify' ? 'Spotify Desktop' : 'YouTube Music Desktop'} uygulamasına aktarıldı! 🎧`
      : 'Uygulama açılamadı.'
  });
});

// 7. Economy & Leaderboard
router.get('/economy/leaderboard', (req: Request, res: Response) => {
  // Puanlar bellekte tutuluyor ve diske seyrek yazılıyor; sıralama bayat
  // kalmasın diye önce hepsini yaz.
  try { economyService.flushAll(); } catch {}
  const sort = String(req.query.sort || 'points');
  const allowed = ['points', 'watch_time_minutes', 'messages_count'];
  const col = allowed.includes(sort) ? sort : 'points';
  const users = db.prepare(`SELECT * FROM economy ORDER BY ${col} DESC LIMIT 50`).all();
  res.json(users);
});

// 8. Giveaways
router.get('/giveaways', (req: Request, res: Response) => {
  const active = giveaway.getActiveGiveaway();
  const entries = giveaway.getEntries();
  const pastGiveaways = db.prepare('SELECT * FROM giveaways WHERE is_active = 0 ORDER BY created_at DESC LIMIT 10').all();
  res.json({ active, entries, pastGiveaways });
});

router.post('/giveaways/create', (req: Request, res: Response) => {
  const { title, keyword = '!katil', subBonusMultiplier = 2.0, costPoints = 0, durationMinutes = 10, winnerCount = 1, maxEntries = 0, followerOnly = false, subOnly = false, minWatchMinutes = 0 } = req.body;
  const created = giveaway.createGiveaway(title, keyword, subBonusMultiplier, costPoints);
  if (created?.id) {
    try {
      db.prepare('UPDATE giveaways SET duration_minutes=?, winner_count=?, max_entries=?, follower_only=?, sub_only=?, min_watch_minutes=? WHERE id=?')
        .run(durationMinutes, winnerCount, maxEntries, followerOnly ? 1 : 0, subOnly ? 1 : 0, minWatchMinutes, created.id);
    } catch {}
  }
  res.json({ success: true, giveaway: giveaway.getActiveGiveaway() });
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

// 9. Alert Presets (OBS AlertBox)
router.get('/alerts', (req: Request, res: Response) => {
  const presets = db.prepare('SELECT * FROM alert_presets').all();
  res.json(presets);
});

router.post('/alerts/save', (req: Request, res: Response) => {
  const { id, eventType, titleTemplate, messageTemplate, soundUrl, imageUrl, durationMs, fontFamily, textColor, accentColor, animation, soundVolume, isEnabled, layoutMode, textEffect } = req.body;
  const alertId = id || `alert-${eventType || 'custom'}-${Date.now()}`;
  db.prepare(`
    INSERT INTO alert_presets (id, event_type, title_template, message_template, sound_url, image_url, duration_ms, font_family, text_color, accent_color, animation, sound_volume, is_enabled, layout_mode, text_effect)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      event_type = excluded.event_type,
      title_template = excluded.title_template,
      message_template = excluded.message_template,
      sound_url = excluded.sound_url,
      image_url = excluded.image_url,
      duration_ms = excluded.duration_ms,
      font_family = excluded.font_family,
      text_color = excluded.text_color,
      accent_color = excluded.accent_color,
      animation = excluded.animation,
      sound_volume = excluded.sound_volume,
      is_enabled = excluded.is_enabled,
      layout_mode = excluded.layout_mode,
      text_effect = excluded.text_effect
  `).run(
    alertId, eventType || 'follow', titleTemplate, messageTemplate, soundUrl || '', imageUrl || '',
    durationMs || 5000, fontFamily || 'Plus Jakarta Sans', textColor || '#ffffff', accentColor || '#8b5cf6',
    animation || 'bounce', soundVolume ?? 0.7, isEnabled ? 1 : 0, layoutMode || 'stacked', textEffect || 'shine'
  );
  res.json({ success: true, id: alertId });
});

router.post('/alerts/test', (req: Request, res: Response) => {
  const { eventType } = req.body;
  wsHub.triggerTestAlert(eventType || 'follow');
  res.json({ success: true });
});

// 8.8 Uyari varyantlari — ayni olay her geldiginde farkli gorsel/ses.
// Tutara gore de secilir: 1000 TL bagis "0+" varyantina dusmez.
router.get('/alerts/variants', (req: Request, res: Response) => {
  res.json(varyantlar.listele(req.query.eventType ? String(req.query.eventType) : undefined));
});

router.post('/alerts/variants/:eventType', (req: Request, res: Response) => {
  res.json(varyantlar.kaydet(String(req.params.eventType || ''), req.body || {}));
});

router.delete('/alerts/variants/:id', (req: Request, res: Response) => {
  res.json({ ok: varyantlar.sil(String(req.params.id || '')) });
});

// 8.9 Medya kutuphanesi — uyari gorseli ve sesi artik yerel dosyadan
// gelebilir. Onceden yalniz harici URL vardi: internet kesilince uyarilar
// bozuluyordu.
router.get('/media', (req: Request, res: Response) => {
  const tur = req.query.tur ? String(req.query.tur) : undefined;
  res.json({
    ogeler: medya.listele(tur as any),
    toplamBoyut: medya.toplamBoyut(),
    maksBoyut: MAKS_BOYUT,
    maksToplam: MAKS_TOPLAM
  });
});

router.post('/media', (req: Request, res: Response) => {
  const ad = String(req.body?.ad || 'dosya');
  const veri = String(req.body?.veri || '');
  if (!veri) return res.status(400).json({ ok: false, hata: 'veri (base64) gerekli' });
  const sonuc = medya.ekle(ad, veri);
  res.status(sonuc.ok ? 200 : 400).json(sonuc);
});

router.delete('/media/:id', (req: Request, res: Response) => {
  res.json({ ok: medya.sil(String(req.params.id || '')) });
});

/** Dosyanin kendisi. Yol gezinmesi imkansiz: kimlik ile arayip diskten okur. */
router.get('/media/:id/dosya', (req: Request, res: Response) => {
  const oge = medya.bul(String(req.params.id || ''));
  if (!oge) return res.status(404).json({ error: 'Bulunamadı' });
  res.setHeader('Content-Type', oge.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // SVG izinli listede yok; yine de tarayici tur tahmini yapmasin
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(medya.dosyaYolu(oge));
});

// 8.95 TTS filtreleri — neler okunsun, hangi sinirlar gecerli?
router.get('/tts/filters', (req: Request, res: Response) => {
  res.json(ttsEngine.filtreAyarlari());
});

router.post('/tts/filters', (req: Request, res: Response) => {
  res.json(ttsEngine.filtreYaz(req.body || {}));
});

// 9.0 Sohbet tarafi olay mesajlari
router.get('/chat-alerts', (req: Request, res: Response) => {
  res.json(sohbetUyarilari.ayarOku());
});

router.post('/chat-alerts', (req: Request, res: Response) => {
  res.json(sohbetUyarilari.ayarYaz(req.body || {}));
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

// 9.2 Subathon — sayac artik SUNUCUDA. Eskiden tamamen tarayicidaydi:
// iki OBS kaynagi acilinca iki farkli sayac gorunuyor, panel sayaci
// goremiyor ve KICKs olayi hic eklenmiyordu.
router.get('/subathon', (req: Request, res: Response) => {
  res.json(subathon.durumAl());
});

router.post('/subathon/settings', (req: Request, res: Response) => {
  const g = req.body || {};
  const sayi = (v: any, varsayilan: number) => (v === undefined || v === null || v === '' ? varsayilan : Math.max(0, Number(v) || 0));
  const mevcut = subathon.ayarOku();
  res.json(
    subathon.ayarYaz({
      baslangicDakika: sayi(g.baslangicDakika, mevcut.baslangicDakika),
      aboneDakika: sayi(g.aboneDakika, mevcut.aboneDakika),
      hediyeAboneDakika: sayi(g.hediyeAboneDakika, mevcut.hediyeAboneDakika),
      bagisDakika: sayi(g.bagisDakika, mevcut.bagisDakika),
      bagisBirimi: Math.max(1, sayi(g.bagisBirimi, mevcut.bagisBirimi)),
      kicksDakika: sayi(g.kicksDakika, mevcut.kicksDakika),
      kicksBirimi: Math.max(1, sayi(g.kicksBirimi, mevcut.kicksBirimi)),
      maksSaat: sayi(g.maksSaat, mevcut.maksSaat)
    })
  );
});

router.post('/subathon/start', (req: Request, res: Response) => {
  res.json(subathon.baslat(req.body?.dakika));
});

router.post('/subathon/stop', (req: Request, res: Response) => {
  res.json(subathon.durdur());
});

/** Elle sure ekle/cikar: `{ dakika: 5 }` veya `{ dakika: -5 }`. */
router.post('/subathon/add', (req: Request, res: Response) => {
  const dk = Number(req.body?.dakika);
  if (!Number.isFinite(dk) || dk === 0) return res.status(400).json({ error: 'dakika gerekli' });
  res.json(subathon.sureEkle(Math.round(dk * 60), `${dk > 0 ? '+' : ''}${dk} dk · elle`));
});

// 9.3 Yapay zeka asistani — paneldeki sohbet kutusu bunu kullanir.
// Eskiden panel HIC sunucuya gitmiyordu: `setTimeout` ile sabit bir cumle
// gosteriyordu ("hep ayni yaniti veriyor" sikayeti buydu).
router.post('/ai/ask', async (req: Request, res: Response) => {
  const soru = String(req.body?.prompt ?? '').trim();
  const kimden = String(req.body?.sender ?? 'Yayıncı').slice(0, 40);
  if (!soru) return res.status(400).json({ success: false, error: 'prompt gerekli' });
  if (soru.length > 2000) return res.status(400).json({ success: false, error: 'Soru çok uzun (en fazla 2000 karakter).' });

  try {
    const cevap = await geminiCoHost.ask(soru, kimden);
    // `ask` hata durumunda da metin dondurur; uyari isaretini ayirt et.
    const hataMi = typeof cevap === 'string' && cevap.startsWith('⚠️');
    res.json({ success: !hataMi, cevap, model: geminiCoHost.aktifModel() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

// Baglanti testi: anahtar gecerli mi, hangi modeller acik?
router.get('/ai/status', async (req: Request, res: Response) => {
  try {
    res.json(await geminiCoHost.durum());
  } catch (e: any) {
    res.status(500).json({ hazir: false, hata: String(e?.message || e) });
  }
});

// 9.4 Platform yetenekleri — panel desteklenmeyen ayari devre disi gostersin
router.get('/platforms/capabilities', (req: Request, res: Response) => {
  res.json({
    yetenekler: YETENEKLER,
    eylemSecenekleri: EYLEM_SECENEKLERI,
    timeoutKademeleri: TIMEOUT_KADEMELERI
  });
});

// 9.5 Degisken katalogu — panelde komut yazarken hangi degiskenler var
router.get('/variables', (req: Request, res: Response) => {
  res.json({ sayi: degiskenSayisi(), gruplar: degiskenKatalogu() });
});

// Sablon onizleme: komut kaydetmeden nasil gorunecegini dener.
// `isTest: true` ile puan/sayac YAZMAYAN bir calistirma yapilir.
router.post('/variables/preview', async (req: Request, res: Response) => {
  const sablon = String(req.body?.template ?? '');
  if (!sablon) return res.status(400).json({ error: 'template gerekli' });

  const sahteMesaj: any = {
    platform: String(req.body?.platform || 'kick'),
    channel: String(req.body?.channel || 'test'),
    user: {
      username: 'onizleme',
      displayName: 'Önizleme',
      isBroadcaster: true,
      isMod: true,
      isSub: false,
      isVip: false
    },
    message: sablon,
    timestamp: Date.now()
  };

  const args = String(req.body?.args || '').trim().split(/\s+/).filter(Boolean);
  try {
    const ctx = baglamOlustur(sahteMesaj, args, String(req.body?.commandName || 'onizleme'), true);
    const sonuc = await degiskenleriCoz(sablon, ctx);
    res.json({ success: true, sonuc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

// 10. General Bot Settings
router.get('/settings', (req: Request, res: Response) => {
  // GUVENLIK: `kick_client_secret` ve `gemini_api_key` eskiden duz metin
  // donuyordu. Artik maskelenir; panel `<key>Var` alanindan dolu olup
  // olmadigini anlar.
  const rows = db.prepare('SELECT * FROM bot_settings').all() as Array<{ key: string; value: string }>;
  const settingsObj: Record<string, string> = {};
  for (const r of rows) {
    settingsObj[r.key] = r.value;
  }
  res.json(temizle(settingsObj));
});

router.post('/settings', (req: Request, res: Response) => {
  const updates = req.body;
  const upsert = db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const mevcutOku = db.prepare('SELECT value FROM bot_settings WHERE key = ?');
  for (const [key, value] of Object.entries(updates)) {
    // Maskelenmis deger geri gonderildiginde gercek sir "****1234" ile
    // EZILMEMELI; bos gonderim de ayni sekilde mevcut degeri korur.
    if (gizliMi(key)) {
      const mevcut = (mevcutOku.get(key) as { value?: string } | undefined)?.value ?? null;
      const yazilacak = yeniSirDegeri(value, mevcut);
      if (yazilacak === null) continue;
      upsert.run(key, String(yazilacak));
      continue;
    }
    upsert.run(key, String(value));
  }

  settingsCache.reload();
  res.json({ success: true });
});

// 11. Recent Stream Events Feed
router.get('/events', (req: Request, res: Response) => {
  const events = db.prepare('SELECT * FROM stream_events ORDER BY timestamp DESC LIMIT 50').all();
  res.json(events);
});

// 12. Chat Overlay Settings (Image 1 Specifications)
router.get('/settings/chat-overlay', (req: Request, res: Response) => {
  const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'chat_overlay_settings'").get() as any;
  const defaultSettings = {
    maxMessages: 40,
    fontSize: 22,
    showPlatformLogo: true,
    showBadges: true,
    showTimestamp: true,
    highlightSpecial: true,
    fadeMessages: true,
    fadeTimeout: 17,
    smoothMask: true,
    textShadow: true,
    transparentBg: true
  };
  try {
    const parsed = row ? JSON.parse(row.value) : defaultSettings;
    res.json({ ...defaultSettings, ...parsed });
  } catch {
    res.json(defaultSettings);
  }
});

router.post('/settings/chat-overlay', (req: Request, res: Response) => {
  const settings = req.body;
  const val = JSON.stringify(settings);
  db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES ('chat_overlay_settings', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(val);

  // Broadcast to all chatbox widgets instantly
  wsHub.broadcastTo(['chatbox', 'all'], {
    type: 'chat_settings',
    data: settings
  });

  res.json({ success: true, settings });
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
  const { title, options, durationSeconds = 60, command = '!oy' } = req.body;
  if (!title || !options || options.length < 2) {
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

// 15. Pinned Messages (OBS Pinned Message Overlay)
router.get('/pinned', (req: Request, res: Response) => {
  const pinned = db.prepare('SELECT * FROM pinned_messages ORDER BY created_at DESC LIMIT 1').get();
  res.json(pinned || null);
});

router.post('/pinned', (req: Request, res: Response) => {
  const { platform, username, displayName, message, color } = req.body;
  const id = `pin-${Date.now()}`;
  db.prepare('DELETE FROM pinned_messages').run();
  db.prepare(`
    INSERT INTO pinned_messages (id, platform, username, display_name, message, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, platform || 'kick', username || 'Yayinci', displayName || 'Yayıncı', message, color || '#8b5cf6', Date.now());

  wsHub.broadcastTo(['all'], {
    type: 'pinned_message',
    data: { id, platform, username, displayName, message, color }
  });

  res.json({ success: true });
});

router.delete('/pinned', (req: Request, res: Response) => {
  db.prepare('DELETE FROM pinned_messages').run();
  wsHub.broadcastTo(['all'], { type: 'pinned_message', data: null });
  res.json({ success: true });
});

// 16. Chat Clear Action (One-click)
router.post('/chat/clear', (req: Request, res: Response) => {
  wsHub.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'clear_chat' });
  res.json({ success: true, message: 'Canlı sohbet başarıyla temizlendi' });
});

// 17. Chat Minigames API
router.get('/games/settings', (req: Request, res: Response) => {
  res.json(gamesEngine.getSettings());
});

router.post('/games/settings', (req: Request, res: Response) => {
  const updated = gamesEngine.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

router.get('/games/active-lobbies', (req: Request, res: Response) => {
  res.json(gamesEngine.getActiveLobbies());
});

router.post('/games/trigger', (req: Request, res: Response) => {
  const { game } = req.body;
  const msg = gamesEngine.triggerGame(game);
  res.json({ success: true, message: msg });
});

router.post('/games/cancel', (req: Request, res: Response) => {
  const { type } = req.body;
  const ok = gamesEngine.cancelLobby(type);
  res.json({ success: ok });
});

// --- BİL BAKALIM TRIVIA BİLGİ YARIŞMASI API ---
router.get('/trivia/state', (req: Request, res: Response) => {
  res.json(triviaEngine.getState());
});

router.post('/trivia/start', (req: Request, res: Response) => {
  const { mode = 'single', category = 'all', durationSec = 20, questionCount = 5, questionId } = req.body;
  if (mode === 'tournament') {
    triviaEngine.startTournament(category, questionCount, durationSec);
  } else {
    triviaEngine.startQuestion({ category, durationSec, questionId });
  }
  res.json({ success: true, state: triviaEngine.getState() });
});

router.post('/trivia/skip', (req: Request, res: Response) => {
  const ok = triviaEngine.skipQuestion();
  res.json({ success: ok });
});

router.post('/trivia/stop', (req: Request, res: Response) => {
  const ok = triviaEngine.stopGame();
  res.json({ success: ok });
});

router.get('/trivia/questions', (req: Request, res: Response) => {
  const category = (req.query.category as string) || '';
  const search = (req.query.search as string) || '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (category && category !== 'all') {
    whereClauses.push('category = ?');
    params.push(category);
  }
  if (search) {
    whereClauses.push('(question LIKE ? OR option_a LIKE ? OR option_b LIKE ? OR option_c LIKE ? OR option_d LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM trivia_questions ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM trivia_questions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

  res.json({
    total: totalRow.cnt,
    limit,
    offset,
    questions: rows.map(r => ({
      id: r.id,
      category: r.category,
      question: r.question,
      optionA: r.option_a,
      optionB: r.option_b,
      optionC: r.option_c,
      optionD: r.option_d,
      correctOption: r.correct_option,
      points: r.points,
      explanation: r.explanation,
      difficulty: r.difficulty,
      createdAt: r.created_at
    }))
  });
});

router.post('/trivia/questions', (req: Request, res: Response) => {
  const { category, question, optionA, optionB, optionC, optionD, correctOption, points = 100, explanation = '', difficulty = 'medium' } = req.body;
  if (!category || !question || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ success: false, error: 'Tüm şıklar, kategori ve soru metni zorunludur!' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO trivia_questions (id, category, question, option_a, option_b, option_c, option_d, correct_option, points, explanation, difficulty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    category,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption.toUpperCase(),
    points || 100,
    explanation || '',
    difficulty || 'medium',
    Date.now()
  );

  res.json({ success: true, id });
});

router.put('/trivia/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, question, optionA, optionB, optionC, optionD, correctOption, points = 100, explanation = '', difficulty = 'medium' } = req.body;
  
  db.prepare(`
    UPDATE trivia_questions
    SET category = ?, question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, points = ?, explanation = ?, difficulty = ?
    WHERE id = ?
  `).run(
    category,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption.toUpperCase(),
    points,
    explanation,
    difficulty,
    String(id)
  );

  res.json({ success: true });
});

router.delete('/trivia/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM trivia_questions WHERE id = ?').run(String(id));
  res.json({ success: true });
});

router.get('/trivia/stats', (_req: Request, res: Response) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM trivia_questions').get() as { cnt: number };
  const cats = db.prepare('SELECT category, COUNT(*) as cnt FROM trivia_questions GROUP BY category ORDER BY category').all() as Array<{ category: string; cnt: number }>;
  res.json({ total: total.cnt, categories: cats });
});

router.post('/trivia/resync', (_req: Request, res: Response) => {
  try {
    const result = syncTriviaBank(db);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Senkron başarısız' });
  }
});

router.get('/trivia/leaderboard', (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const rows = db.prepare('SELECT * FROM trivia_scores ORDER BY total_score DESC LIMIT ?').all(limit) as any[];
  res.json(rows.map(r => ({
    username: r.username,
    displayName: r.display_name,
    platform: r.platform,
    totalScore: r.total_score,
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    fastestMs: r.fastest_ms,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
    lastPlayed: r.last_played
  })));
});

router.post('/trivia/generate-ai', async (req: Request, res: Response) => {
  const { category = 'Genel Kültür', count = 5, difficulty = 'orta' } = req.body;

  const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
  const apiKey = keyRow?.value || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Gemini API anahtarı ayarlanmamış. Lütfen Ayarlar sayfasından bir Gemini API Key girin.'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Sen Bil Bakalım televizyon yarışmasının profesyonel soru yazarısın.
Lütfen aşağıdaki kurallara göre tam ${count} adet Türkçe soru üret:
- Kategori: "${category}" (Seçenekler: Genel Kültür, Bilgi, Oyun, Film ve Dizi, Coğrafya, Tarih)
- Zorluk seviyesi: "${difficulty}" (kolay, orta veya zor)
- Her sorunun mutlaka 4 şıkkı (A, B, C, D) ve 1 doğru cevabı olmalı.
- Sorular net, ilgi çekici, yanıltıcı olmayan kaliteli yarışma soruları olmalıdır.
- Her soru için Bil Bakalım tarzı 1-2 cümlelik "Bunu Biliyor muydunuz?" açıklaması (explanation) ekle.

Lütfen çıktıyı YALNIZCA geçerli bir JSON dizisi (JSON Array) formatında ver, başka hiçbir markdown veya açıklama yazma:
[
  {
    "category": "${category}",
    "question": "Soru metni?",
    "optionA": "A şıkkı",
    "optionB": "B şıkkı",
    "optionC": "C şıkkı",
    "optionD": "D şıkkı",
    "correctOption": "A",
    "points": 100,
    "explanation": "Doğru cevabın ilginç açıklaması",
    "difficulty": "medium"
  }
]`;

    // Sabit model adı yerine çalışan modeli bul: bazı modeller yeni
    // hesaplara kapalı ve 404 dönüyor.
    const triviaModel = await geminiCoHost.resolveModel(ai);
    const aiRes = await ai.models.generateContent({
      model: triviaModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    let rawText = aiRes.text?.trim() || '';
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedQuestions = JSON.parse(rawText);
    if (!Array.isArray(parsedQuestions)) {
      throw new Error('AI cevabı geçerli bir JSON dizisi formatında değil.');
    }

    const inserted: any[] = [];
    const insertStmt = db.prepare(`
      INSERT INTO trivia_questions (id, category, question, option_a, option_b, option_c, option_d, correct_option, points, explanation, difficulty, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of parsedQuestions) {
      if (q.question && q.optionA && q.optionB && q.optionC && q.optionD && q.correctOption) {
        const id = uuidv4();
        insertStmt.run(
          id,
          q.category || category,
          q.question,
          q.optionA,
          q.optionB,
          q.optionC,
          q.optionD,
          q.correctOption.toUpperCase(),
          q.points || 100,
          q.explanation || '',
          q.difficulty || 'medium',
          Date.now()
        );
        inserted.push({ id, ...q });
      }
    }

    res.json({
      success: true,
      count: inserted.length,
      questions: inserted
    });
  } catch (err: any) {
    console.error('[AI Trivia Generator Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Yapay zeka soruları üretilirken hata oluştu.' });
  }
});

// 18. All-in-One Overlay Settings (Single OBS URL: /widgets/overlay)
function normalizeAllInOneConfig(cfg: any) {
  const defaults = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    testMode: false,
    chat: { enabled: true, x: 40, y: 430, width: 420, height: 610, scale: 1, fontSize: 18, transparent: true, mask: true },
    alerts: { enabled: true, x: 660, y: 60, width: 600, height: 260, scale: 1, durationMs: 5000, soundVolume: 0.7, animation: 'bounce', layoutMode: 'stacked', textEffect: 'wiggle' },
    goals: { enabled: true, x: 40, y: 60, width: 380, height: 60, scale: 1, type: 'follower', target: 100, current: 24, title: 'Takipçi Hedefi' },
    subathon: { enabled: false, x: 1560, y: 60, width: 320, height: 70, scale: 1 },
    trivia: { enabled: false, x: 660, y: 700, width: 600, height: 320, scale: 1 },
    eventLabels: { enabled: true, x: 0, y: 0, width: 1920, height: 44, scale: 1 },
    emoteCombo: { enabled: true, x: 1560, y: 460, width: 320, height: 140, scale: 1 },
    nowPlaying: { enabled: false, x: 1460, y: 960, width: 420, height: 90, scale: 1 },
    theCup: { enabled: false, x: 1580, y: 610, width: 300, height: 430, scale: 1 },
    polls: { enabled: false, x: 1540, y: 180, width: 340, height: 260, scale: 1 },
    wheel: { enabled: false, x: 760, y: 340, width: 400, height: 400, scale: 1 },
    hypeTrain: { enabled: false, x: 685, y: 350, width: 550, height: 85, scale: 1 }
  };

  const result: any = { ...defaults, ...(cfg || {}) };
  for (const key of Object.keys(defaults)) {
    if (key === 'canvasWidth' || key === 'canvasHeight' || key === 'testMode') continue;
    const defW = (defaults as any)[key];
    const userW = (result as any)[key] || {};
    result[key] = {
      ...defW,
      ...userW,
      x: typeof userW.x === 'number' ? userW.x : defW.x,
      y: typeof userW.y === 'number' ? userW.y : defW.y,
      width: typeof userW.width === 'number' ? userW.width : defW.width,
      height: typeof userW.height === 'number' ? userW.height : defW.height,
      scale: typeof userW.scale === 'number' ? userW.scale : defW.scale,
      enabled: typeof userW.enabled === 'boolean' ? userW.enabled : defW.enabled
    };
  }
  return result;
}

router.get('/overlay/all-in-one', (req: Request, res: Response) => {
  const row = db.prepare("SELECT config_json FROM all_in_one_overlay_settings WHERE id = 'default'").get() as any;
  if (row?.config_json) {
    try {
      const parsed = JSON.parse(row.config_json);
      return res.json(normalizeAllInOneConfig(parsed));
    } catch {}
  }
  res.json(normalizeAllInOneConfig(null));
});

router.post('/overlay/all-in-one', (req: Request, res: Response) => {
  const config = normalizeAllInOneConfig(req.body);
  const configJson = JSON.stringify(config);
  const now = Date.now();

  const existing = db.prepare("SELECT id FROM all_in_one_overlay_settings WHERE id = 'default'").get();
  if (existing) {
    db.prepare("UPDATE all_in_one_overlay_settings SET config_json = ?, updated_at = ? WHERE id = 'default'").run(configJson, now);
  } else {
    db.prepare("INSERT INTO all_in_one_overlay_settings (id, config_json, updated_at) VALUES ('default', ?, ?)").run(configJson, now);
  }

  // Live broadcast to all OBS instances displaying /widgets/overlay
  wsHub.broadcastTo(['all'], {
    type: 'all_in_one_overlay_settings',
    config
  });

  res.json({ success: true, config, message: 'All-in-One Overlay ayarları kaydedildi ve OBS güncellendi!' });
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

  const item = db.prepare('SELECT * FROM loyalty_redemptions WHERE id = ?').get(id) as any;
  if (!item) {
    return res.status(404).json({ success: false, error: 'Talep bulunamadı' });
  }

  if (status === 'refunded' && item.status !== 'refunded') {
    // Refund points to user
    db.prepare(`
      UPDATE economy 
      SET points = points + ? 
      WHERE platform = ? AND LOWER(username) = LOWER(?)
    `).run(Number(item.cost) || 0, String(item.platform), String(item.username));
  }

  db.prepare('UPDATE loyalty_redemptions SET status = ? WHERE id = ?').run(status, id);

  wsHub.broadcastTo(['all', 'dashboard'], {
    type: 'loyalty_redemption_updated',
    id,
    status
  });

  res.json({ success: true, message: `Talep durumu güncellendi: ${status}` });
});

// 18. Universal Widget Test Trigger Endpoint
router.post('/widgets/test/:widgetName', (req: Request, res: Response) => {
  const { widgetName } = req.params;
  const body = req.body || {};

  switch (widgetName) {
    case 'emote-combo':
    case 'on-screen-emotes':
      wsHub.broadcastTo(['all'], {
        type: 'emote_used',
        emote: body.emote || '🔥',
        combo: body.combo || 7
      });
      break;
    case 'the-cup':
      wsHub.broadcastTo(['all'], {
        type: 'cup_drop',
        tokenType: body.tokenType || 'coin',
        count: body.count || 5,
        username: body.username || 'TestBağışçı'
      });
      break;
    case 'hype-train':
      wsHub.broadcastTo(['all'], {
        type: 'hype_train_progress',
        level: body.level || 2,
        percent: body.percent || 65,
        secondsLeft: body.secondsLeft || 180
      });
      break;
    case 'subathon':
      wsHub.broadcastTo(['all'], {
        type: 'subathon_update',
        timeRemaining: body.timeRemaining || 14400,
        running: body.running !== false
      });
      break;
    case 'now-playing':
      wsHub.broadcastTo(['all'], {
        type: 'now_playing',
        title: body.title || 'Blinding Lights',
        artist: body.artist || 'The Weeknd',
        coverUrl: body.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop',
        duration: 200,
        progress: 45
      });
      break;
    case 'shoutout':
      wsHub.broadcastTo(['all'], {
        type: 'shoutout',
        channel: body.channel || 'StreamMaster',
        game: body.game || 'Grand Theft Auto VI',
        avatarUrl: body.avatarUrl || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop',
        message: body.message || 'Bu harika yayıncıyı takip etmeyi unutmayın!'
      });
      break;
    case 'credits':
      wsHub.broadcastTo(['all'], {
        type: 'credits_start'
      });
      break;
    case 'wheel':
    case 'wheel-of-fortune':
      wsHub.broadcastTo(['all'], {
        type: 'spin_wheel',
        winnerIndex: Math.floor(Math.random() * 8)
      });
      break;
    case 'tts':
    case 'cloud-tts':
      ttsEngine.enqueue(body.text || 'StreamAxT widget TTS testi. Dil ve ses ayarları uygulandı.', body.user || 'Yayıncı');
      break;
    case 'jumpscare':
      wsHub.broadcastTo(['all'], {
        type: 'jumpscare_trigger',
        settings: body.settings || { isEnabled: true, durationMs: 3000, mediaType: 'image', volume: 1 },
        donor: body.username || 'TestBağışçı',
        amount: body.amount || 100
      });
      break;
    case 'viewer-counter':
      wsHub.broadcastTo(['all'], { type: 'viewer_count', kick: 128, twitch: 64, youtube: 42, total: 234 });
      break;
    case 'activity-feed':
    case 'alert-box':
    case 'follow':
    case 'sub':
    case 'tip':
    case 'raid':
    case 'gift_tiktok':
      wsHub.triggerTestAlert(['follow', 'sub', 'tip', 'raid', 'gift_tiktok'].includes(widgetName) ? widgetName : (body.eventType || 'follow'));
      break;
    default:
      wsHub.triggerTestAlert(body.eventType || 'follow');
      break;
  }

  res.json({ success: true, widget: widgetName, message: `${widgetName} testi tetiklendi!` });
});

router.get('/widgets/:widgetId/settings', (req: Request, res: Response) => {
  const key = `widget_settings_${req.params.widgetId}`;
  try {
    const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key) as { value: string } | undefined;
    res.json(row?.value ? JSON.parse(row.value) : {});
  } catch {
    res.json({});
  }
});

router.post('/widgets/:widgetId/settings', (req: Request, res: Response) => {
  const key = `widget_settings_${req.params.widgetId}`;
  const currentRaw = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key) as { value: string } | undefined;
  const current = currentRaw?.value ? JSON.parse(currentRaw.value) : {};
  const updated = { ...current, ...(req.body || {}) };
  db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(updated));
  wsHub.broadcastTo(['all'], { type: 'widget_settings', widgetId: req.params.widgetId, settings: updated });
  res.json(updated);
});

// ==========================================
// StreamAxT ENHANCED MODULES API
// Developed by AxthrowA
// ==========================================

router.get('/tts/voices', (_req: Request, res: Response) => {
  res.json(multiEngineTTS.getVoiceCatalog());
});

router.get('/tts/settings', (_req: Request, res: Response) => {
  res.json(multiEngineTTS.getSettings());
});

router.post('/tts/settings', (req: Request, res: Response) => {
  const updated = multiEngineTTS.saveSettings(req.body);
  shieldModeService.addAuditLog('TTS_SETTINGS_UPDATED', 'Yayıncı', 'TTS ayarları güncellendi.');
  res.json(updated);
});

router.post('/tts/test', async (req: Request, res: Response) => {
  const { text = 'StreamAxT 5 motorlu kesintisiz TTS sistemi başarıyla çalışıyor!', user = 'Test', settings } = req.body;
  try {
    const item = await multiEngineTTS.synthesizeWithFallback(text, user, settings);
    res.json({ success: !!item, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'TTS sentezlenemedi' });
  }
});

router.get('/tts/queue', (req: Request, res: Response) => {
  res.json(multiEngineTTS.getQueue());
});

router.post('/tts/clear', (req: Request, res: Response) => {
  multiEngineTTS.clearQueue();
  res.json({ success: true, message: 'TTS kuyruğu temizlendi' });
});

// 2. Donations & BynoGame & JumpScare
router.get('/donations/recent', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM donations ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

router.get('/donations/jumpscare', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'jumpscare_settings'").get() as any;
    if (row?.value) {
      return res.json(JSON.parse(row.value));
    }
  } catch {}
  res.json({
    isEnabled: true,
    minAmount: 50,
    mediaType: 'video',
    mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-creepy-monster-in-dark-room-41717-large.mp4',
    audioUrl: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
    durationMs: 4000,
    volume: 1.0
  });
});

router.post('/donations/jumpscare', (req: Request, res: Response) => {
  const currentRaw = db.prepare("SELECT value FROM bot_settings WHERE key = 'jumpscare_settings'").get() as any;
  const current = currentRaw ? JSON.parse(currentRaw.value) : {};
  const updated = { ...current, ...req.body };
  db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES ('jumpscare_settings', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify(updated));
  res.json(updated);
});

function pickDonationField(source: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    const val = source?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return undefined;
}

function flattenDonationPayload(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const nested = raw.data || raw.donation || raw.payload || raw.message?.[0] || raw.event || {};
  return { ...nested, ...raw };
}

function parseIncomingDonation(raw: any, query: any = {}) {
  const body = flattenDonationPayload({ ...query, ...(raw || {}) });
  const donorName = String(
    pickDonationField(body, [
      'donorName', 'user_name', 'username', 'user', 'name', 'donator', 'donator_name',
      'gonderen', 'from', 'payer_name', 'displayName', 'display_name'
    ]) || 'Gizli Bağışçı'
  );
  const amountRaw = pickDonationField(body, [
    'amount', 'total', 'donation', 'donation_amount', 'tutar', 'price', 'mc_gross', 'sum'
  ]);
  const amount = Number(String(amountRaw ?? '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  const currency = String(pickDonationField(body, ['currency', 'para_birimi', 'mc_currency']) || 'TL');
  const message = String(
    pickDonationField(body, ['message', 'user_message', 'mesaj', 'note', 'comment', 'msg']) || ''
  );
  const platform = String(pickDonationField(body, ['platform', 'source', 'provider']) || 'bynogame');
  return { donorName, amount, currency, message, platform };
}

const processDonation = (donorName: string, amount: number, currency: string = 'TL', message: string = '', platform: string = 'bynogame') => {
  const donationId = uuidv4();
  const numAmount = Math.max(0, Number(amount) || 0);
  const safeName = donorName || 'Gizli Bağışçı';
  const safeCurrency = currency || 'TL';
  const safeMessage = message || '';

  db.prepare(`
    INSERT INTO donations (id, donor_name, amount, currency, message, platform, created_at, alert_shown, jumpscare_triggered)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(donationId, safeName, numAmount, safeCurrency, safeMessage, platform, Date.now());

  const alertData = wsHub.buildAlertPayload('tip', {
    user: safeName,
    amount: numAmount,
    currency: safeCurrency,
    message: safeMessage
  }, true);

  wsHub.broadcastTo(['dashboard', 'alertbox', 'goals', 'all'], {
    type: 'alert',
    subType: 'tip',
    alertType: 'tip',
    data: {
      platform: 'kick',
      username: safeName,
      displayName: safeName,
      amount: numAmount,
      currency: safeCurrency,
      message: safeMessage,
      timestamp: Date.now()
    },
    alert: alertData
  });

  wsHub.broadcastTo(['all'], {
    type: 'cup_drop',
    data: { type: 'tip', user: safeName, amount: numAmount, currency: safeCurrency }
  });

  try {
    economyService.recordTip(safeName, 'kick', numAmount);
  } catch {}

  let jumpscareFired = false;
  try {
    const jsRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'jumpscare_settings'").get() as any;
    const jsSettings = jsRow?.value ? JSON.parse(jsRow.value) : { isEnabled: true, minAmount: 50 };
    if (jsSettings.isEnabled && numAmount >= (jsSettings.minAmount || 50)) {
      jumpscareFired = true;
      db.prepare('UPDATE donations SET jumpscare_triggered = 1 WHERE id = ?').run(donationId);
      wsHub.broadcastTo(['all'], {
        type: 'jumpscare_trigger',
        settings: jsSettings,
        donor: safeName,
        amount: numAmount
      });
    }
  } catch (err) {
    console.warn('[JumpScare] Error checking:', err);
  }

  const ttsText = safeMessage
    ? `${safeName} ${numAmount} ${safeCurrency} bağışladı: ${safeMessage}`
    : `${safeName} ${numAmount} ${safeCurrency} bağışladı.`;
  ttsEngine.enqueue(ttsText, safeName);

  return { donationId, donorName: safeName, amount: numAmount, currency: safeCurrency, message: safeMessage, jumpscareFired };
};

const handleBynoWebhook = (req: Request, res: Response) => {
  try {
    const parsed = parseIncomingDonation(req.body, req.query);
    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz bağış tutarı', received: { body: req.body, query: req.query } });
    }
    const result = processDonation(parsed.donorName, parsed.amount, parsed.currency, parsed.message, 'bynogame');
    res.status(200).json({ success: true, result });
  } catch (err: any) {
    console.error('[BynoGame] webhook error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Bağış işlenemedi' });
  }
};

router.post('/donations/bynogame', handleBynoWebhook);
router.get('/donations/bynogame', handleBynoWebhook);

router.post('/donations/webhook', (req: Request, res: Response) => {
  try {
    const parsed = parseIncomingDonation(req.body, req.query);
    const result = processDonation(parsed.donorName, parsed.amount, parsed.currency, parsed.message, parsed.platform || 'custom');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Bağış işlenemedi' });
  }
});

router.post('/donations/simulate', (req: Request, res: Response) => {
  try {
    const { donorName = 'Cömertİzleyici', amount = 100, currency = 'TL', message = 'Harika yayın, devamını dilerim!', platform = 'bynogame' } = req.body || {};
    const result = processDonation(String(donorName), Number(amount), String(currency), String(message || ''), String(platform));
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Simülasyon başarısız' });
  }
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

// 6. Viewer Notes & AI Sentiment
router.get('/viewers/:username/notes', (req: Request, res: Response) => {
  const username = String(req.params.username || '');
  const row = db.prepare('SELECT * FROM viewer_notes WHERE username = ? COLLATE NOCASE').get(username) as any;
  res.json(row || { username, note: '', tags: '[]', sentiment: 'neutral' });
});

router.post('/viewers/:username/notes', (req: Request, res: Response) => {
  const username = String(req.params.username || '');
  const { note = '', tags = [], sentiment = 'neutral' } = req.body;
  const tagsJson = typeof tags === 'string' ? tags : JSON.stringify(tags);

  db.prepare(`
    INSERT INTO viewer_notes (username, note, tags, sentiment, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      note = excluded.note,
      tags = excluded.tags,
      sentiment = excluded.sentiment,
      updated_at = excluded.updated_at
  `).run(username, String(note), tagsJson, String(sentiment), Date.now());

  shieldModeService.addAuditLog('VIEWER_NOTE_SAVED', 'Yayıncı', `@${username} için yayıncı notu güncellendi.`, username);
  res.json({ success: true, username, note, tags, sentiment });
});

router.get('/viewers/:username/sentiment', async (req: Request, res: Response) => {
  const username = String(req.params.username || '');
  // İzleyicinin son sohbet mesajları (eskiden yeniye sıralanır: gidişat önemli).
  const events = db.prepare(`
    SELECT message FROM stream_events
    WHERE username = ? COLLATE NOCASE AND event_type = 'chat' AND message IS NOT NULL AND TRIM(message) <> ''
    ORDER BY timestamp DESC LIMIT 25
  `).all(username) as { message: string }[];

  const messages = events.map((e) => String(e.message)).reverse();

  if (!messages.length) {
    return res.json({
      username,
      sentiment: 'neutral',
      score: 0.5,
      messageCount: 0,
      summary: 'Bu izleyicinin kayıtlı mesajı yok.',
      source: 'yok',
      recent: [],
    });
  }

  // 1) Yapay zeka: bütün mesajları bağlamıyla birlikte değerlendirir.
  try {
    const ai = await geminiCoHost.analyzeSentiment(username, messages);
    if (ai) {
      return res.json({
        username,
        sentiment: ai.sentiment,
        score: ai.score,
        summary: ai.summary,
        messageCount: messages.length,
        source: 'ai',
        recent: messages.slice(-5),
      });
    }
  } catch {
    /* anahtar yok / model hatası → kelime yöntemine düş */
  }

  // 2) Yedek: kelime tabanlı sayım. Eskiden her kelime en fazla 1 sayılıyordu ve
  // "bot" gibi masum sözcükler olumsuz kabul ediliyordu; artık sözcük sınırıyla
  // sayılır ve yeni mesajlar daha ağır basar.
  const POS = ['harika', 'adamsın', 'gg', 'helal', 'mükemmel', 'seviyorum', 'güzel', 'haha', 'lol', 'kral', 'efsane', 'teşekkür', 'sağol', 'süper', 'bravo'];
  const NEG = ['kötü', 'çöp', 'berbat', 'bırak', 'oynama', 'noob', 'sıkıcı', 'aptal', 'salak', 'rezalet', 'saçma', 'nefret'];
  // Regex yerine sözcük ayırma: Türkçe ekler için önek karşılaştırması yeter
  // ("güzeldi", "harikaydı" da sayılır) ve kaçış sorunu doğmaz.
  const sozcukler = (metin: string) => metin.toLocaleLowerCase("tr").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  let pos = 0;
  let neg = 0;
  messages.forEach((msg, i) => {
    // Son mesajlar 2 kat ağırlıklı: kişinin ŞU ANKİ durumu daha önemli.
    const weight = i >= messages.length - 5 ? 2 : 1;
    const kelimeler = sozcukler(msg);
    for (const w of kelimeler) {
      if (POS.some((p) => w.startsWith(p))) pos += weight;
      if (NEG.some((n) => w.startsWith(n))) neg += weight;
    }
  });

  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (pos > neg) sentiment = 'positive';
  else if (neg > pos) sentiment = 'negative';

  const toplam = pos + neg;
  const score = toplam ? Math.max(pos, neg) / toplam : 0.5;
  const summary =
    sentiment === 'positive'
      ? `${messages.length} mesajda olumlu ton baskın (${pos}/${neg}).`
      : sentiment === 'negative'
        ? `${messages.length} mesajda olumsuz ton baskın (${neg}/${pos}).`
        : `${messages.length} mesajda belirgin bir eğilim yok.`;

  res.json({
    username,
    sentiment,
    score,
    summary,
    positives: pos,
    negatives: neg,
    messageCount: messages.length,
    source: 'kelime',
    recent: messages.slice(-5),
  });
});

// 7. Widget Lyrics API (Syncs with Song Request or queries lyrics)
router.get('/lyrics/current', async (req: Request, res: Response) => {
  const currentSong = songRequest.getCurrentSong();
  const queryTitle = (req.query.title as string) || (currentSong ? currentSong.title : '');

  if (!queryTitle) {
    return res.json({
      title: 'Şu an şarkı çalmıyor',
      artist: '',
      synced: false,
      lines: [
        { time: 0, text: '🎵 Şarkı isteğinde bulunun veya bir parça başlatın' },
        { time: 5, text: '✨ Sözler canlı olarak burada akacaktır' }
      ]
    });
  }

  // Clean title for search: remove (Official Video), [MV], feat, etc.
  const cleanTitle = queryTitle
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official video/gi, '')
    .replace(/lyric video/gi, '')
    .replace(/audio/gi, '')
    .trim();

  try {
    // Try lrclib.net free open API for synced lyrics
    const lrcResp = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`, { timeout: 3500 });
    if (lrcResp.data && lrcResp.data.length > 0) {
      const best = lrcResp.data[0];
      if (best.syncedLyrics) {
        // Parse LRC format: [mm:ss.xx] text
        const lrcLines: { time: number; text: string }[] = [];
        const lines = best.syncedLyrics.split('\n');
        for (const line of lines) {
          const match = line.match(/\[(\d+):(\d+\.?\d*)\](.*)/);
          if (match) {
            const mins = parseInt(match[1], 10);
            const secs = parseFloat(match[2]);
            const text = match[3].trim();
            if (text) {
              lrcLines.push({ time: mins * 60 + secs, text });
            }
          }
        }
        if (lrcLines.length > 0) {
          return res.json({
            title: best.trackName || cleanTitle,
            artist: best.artistName || '',
            synced: true,
            lines: lrcLines
          });
        }
      } else if (best.plainLyrics) {
        const plainLines = best.plainLyrics.split('\n').filter(Boolean).map((t: string, i: number) => ({
          time: i * 4,
          text: t.trim()
        }));
        return res.json({
          title: best.trackName || cleanTitle,
          artist: best.artistName || '',
          synced: false,
          lines: plainLines
        });
      }
    }
  } catch (err) {
    // Fallback if network/API fails
  }

  // Graceful fallback lines
  res.json({
    title: cleanTitle,
    artist: '',
    synced: false,
    lines: [
      { time: 0, text: `🎶 ${cleanTitle}` },
      { time: 4, text: 'Sözler hazırlanıyor...' }
    ]
  });
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

