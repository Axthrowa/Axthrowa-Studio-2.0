/**
 * AxBoT API — Platform bağlantıları ve Kick OAuth (PKCE)
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { gizliPenceredeAc } from '../../core/gizli-pencere.js';
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import axios from 'axios';
import { platformManager } from '../../platforms/manager.js';
import { kickPlatform } from '../../platforms/kick.js';
import { odulGovdesi, odulKimligiGecerli } from '../../platforms/kick-oduller.js';
import { wsHub } from '../../ws/server.js';
import { settingsCache } from '../../core/settings-cache.js';
import crypto from 'crypto';
import { temizle, yeniSirDegeri, maskeDegeriMi } from '../../core/security/redact.js';
import { betikJsonu, htmlKacisla } from '../../core/security/html.js';
import { sifrele, sifreleHepsi } from '../../core/security/vault.js';
import { hataMetni } from '../../core/logger.js';
import { kickYonlendirmeAdresi, stateGecerliMi, yeniState, type BekleyenState } from '../../core/security/oauth-state.js';

const router = Router();

let kickPkceVerifier = '';
// Son auth-url çağrısının state'i; geri dönüşte tek kullanımlık doğrulanır
let kickState: BekleyenState | null = null;
// Girilen hesap ne için: bot hesabı (sohbete yazar) mı, yayın kanalı (moderasyon, başlık) mı
let kickHedef: 'bot' | 'kanal' = 'bot';

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
    `).run(channelName, accountId || null, ...sifreleHepsi([yeniToken, yeniRefresh]), isActive ? 1 : 0, platform);
  } else {
    db.prepare(`
      INSERT INTO channels (id, platform, channel_name, account_id, token, refresh_token, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), platform, channelName, accountId || null, ...sifreleHepsi([token || null, refreshToken || null]), isActive ? 1 : 0, Date.now());
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
  const uygulamaId = clientId || settingsCache.get('kick_client_id') || '';
  const uygulamaSirri = clientSecret || settingsCache.get('kick_client_secret') || '';
  if (oauthCode && uygulamaId && uygulamaSirri) {
    try {
      const redirectUri = kickYonlendirmeAdresi();
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', uygulamaId);
      params.append('client_secret', uygulamaSirri);
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
  // Client Secret yokken yetki kodu jetona çevrilemez; kod kaydedilirse panel "bağlandı" der, bot hiç yazamaz
  if (finalToken && verification.tokenGecersiz) {
    return res.status(400).json({
      success: false,
      error: 'Kick bu girişi kabul etmedi (401). Client Secret kutusunu doldurup bot hesabıyla yeniden giriş yapın.'
    });
  }

  // Save to database
  const existing = db.prepare("SELECT * FROM channels WHERE platform = 'kick'").get() as any;
  if (existing) {
    // Boş ya da maskeli alan kayıtlı bot girişini silmez: kanal değiştirmek hesabı unutturuyordu
    const korunan = yeniSirDegeri(finalToken, existing.token ?? null);
    // Başka kanala geçilince eski kanalın girişi bu kanalda kullanılmaz
    if (String(existing.channel_name || '').toLowerCase() !== slug) {
      db.prepare("UPDATE channels SET kanal_token = NULL, kanal_refresh_token = NULL, kanal_token_expires_at = NULL WHERE platform = 'kick'").run();
    }
    db.prepare(`
      UPDATE channels
      SET channel_name = ?, account_id = ?, token = ?, is_active = 1
      WHERE platform = 'kick'
    `).run(slug, String(verification.broadcasterUserId || ''), sifrele(korunan));
  } else {
    db.prepare(`
      INSERT INTO channels (id, platform, channel_name, account_id, token, is_active, created_at)
      VALUES (?, 'kick', ?, ?, ?, 1, ?)
    `).run(uuidv4(), slug, String(verification.broadcasterUserId || ''), sifrele(finalToken), Date.now());
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
  const testMsg = message || '🟢 [AxBoT] Kick API & Chat bağlantısı başarıyla doğrulandı! Bot aktif.';
  const result = await kickPlatform.sendKickMessage(channelName, testMsg);
  res.json(result);
});

/** Giriş sayfası gizli pencerede: tarayıcıda açık yayıncı hesabı bot girişine karışmaz. Yalnız Kick'in izin sayfası açılır. */
router.post('/platforms/kick/gizli-ac', (req: Request, res: Response) => {
  res.json({ acildi: gizliPenceredeAc(String(req.body?.url || '')) });
});

// POST: state/PKCE yeniler; GET'te herhangi bir site <img> ile yarım kalan girişi bozabiliyordu (köken denetimi yalnız yazma isteklerinde)
router.post('/platforms/kick/auth-url', (req: Request, res: Response) => {
  const clientId = ((req.query.clientId as string) || settingsCache.get('kick_client_id') || '').trim();
  if (!clientId || clientId === 'stream-axt-bot') {
    return res.status(400).json({ 
      error: 'Kick Client ID girilmedi! Lütfen kick.com/settings/developer adresinden oluşturduğunuz App Client ID\'yi girin.' 
    });
  }
  // Sorgudan yönlendirme adresi ARTIK kabul edilmiyor: tek geçerli geri dönüş bu sunucunun kendisi
  const redirectUri = kickYonlendirmeAdresi();
  
  // PKCE & State Generation
  kickPkceVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(kickPkceVerifier).digest('base64url');
  kickState = yeniState();
  kickHedef = req.query.hedef === 'kanal' ? 'kanal' : 'bot';
  const state = kickState.deger;

  // Moderasyon (AutoMod zaman aşımı / mesaj silme) ve !title/!game için
  // gereken izinler eklendi. Eski kapsamla alınan token bunları YAPAMAZ:
  // Kick 403 döner ve AutoMod uyarıya düşer. Kullanıcı bir kez yeniden
  // bağlanmalı (Platformlar > Kick). Kaynak: docs.kick.com/getting-started/scopes
  const scope = encodeURIComponent(
    'chat:write channel:read user:read channel:write moderation:ban moderation:chat_message:manage channel:rewards:read channel:rewards:write'
  );
  const authUrl = `https://id.kick.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=${encodeURIComponent(state)}&prompt=login`;
  // PKCE doğrulayıcısı sunucuda kalır (istemci kullanmıyordu; yanıta konmaz)
  res.json({ authUrl, clientId, redirectUri, state });
});

router.get('/auth/kick/callback', async (req: Request, res: Response) => {
  const { code, error, state } = req.query;
  // Bu sunucunun başlatmadığı (ya da süresi geçmiş / zaten kullanılmış) bir
  // yetkilendirmenin geri dönüşü: kod ne değiştirilir ne de panellere iletilir.
  const stateHatasi = !error && code && !stateGecerliMi(kickState, state)
    ? 'Yetkilendirme oturumu doğrulanamadı (süresi dolmuş ya da bu uygulama başlatmamış). Panelden Kick bağlantısını yeniden başlatın.'
    : '';
  if (error || !code || stateHatasi) {
    return res.send(`
      <!DOCTYPE html>
      <html><body style="font-family:sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="background:#1e293b;padding:32px;border-radius:16px;text-align:center;max-width:400px;border:1px solid rgba(239,68,68,0.3);">
          <h2 style="color:#ef4444;margin-top:0;">Kick Yetkilendirme Hatası</h2>
          <p style="color:#94a3b8;font-size:14px;">${htmlKacisla(stateHatasi || error || 'Yetki kodu alınamadı.')}</p>
          <button onclick="window.close()" style="margin-top:16px;padding:10px 20px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Pencereyi Kapat</button>
        </div>
      </body></html>
    `);
  }

  kickState = null; // tek kullanımlık
  const clientId = settingsCache.get('kick_client_id') || '';
  const clientSecret = settingsCache.get('kick_client_secret') || '';
  const redirectUri = kickYonlendirmeAdresi();
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
        if (kickRow && kickHedef === 'kanal') {
          // Yayın kanalı girişi: kanal bu hesap olur, kayıtlı bot hesabına dokunulmaz (bot yoksa bu hesap yazar)
          // Ad okunamazsa kanal adı değişmez; giriş yine kaydedilir (eskiden panel "başarılı" der, jeton kaybolurdu)
          let kanal = '';
          try {
            const u = await axios.get('https://api.kick.com/public/v1/users', { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000 });
            kanal = String(u.data?.data?.[0]?.name || '').toLowerCase();
          } catch (e) {
            console.warn('[Kick OAuth] Kanal hesabının adı okunamadı:', hataMetni(e));
          }
          db.prepare("UPDATE channels SET channel_name = COALESCE(NULLIF(?, ''), channel_name), kanal_token = ?, kanal_refresh_token = ?, kanal_token_expires_at = ?, is_active = 1 WHERE platform = 'kick'")
            .run(kanal, ...sifreleHepsi([accessToken, refreshToken]), expiresAt);
          if (!kickRow.token) db.prepare("UPDATE channels SET token = ?, refresh_token = ?, token_expires_at = ? WHERE platform = 'kick'").run(...sifreleHepsi([accessToken, refreshToken]), expiresAt);
          await platformManager.reconnect('kick');
        } else if (kickRow) {
          db.prepare("UPDATE channels SET token = ?, refresh_token = ?, token_expires_at = ?, is_active = 1 WHERE platform = 'kick'").run(...sifreleHepsi([accessToken, refreshToken]), expiresAt);
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
          } catch (e) {
            // Yetki alındı ama kanal adı çözülemedi: kullanıcı elle girmeli
            console.warn('[Kick OAuth] Kullanıcı bilgisi alınamadı:', hataMetni(e));
          }

          db.prepare(`
            INSERT INTO channels (id, platform, channel_name, account_id, token, refresh_token, token_expires_at, is_active, created_at)
            VALUES (?, 'kick', ?, ?, ?, ?, ?, 1, ?)
          `).run(uuidv4(), autoSlug, autoUserId, ...sifreleHepsi([accessToken, refreshToken]), expiresAt, Date.now());
          await platformManager.reconnect('kick');
        }
      }
    } catch (err: any) {
      console.warn('[Kick OAuth Callback Exchange]:', err?.response?.data || err.message);
    }
  }

  // Açık panellere bildir (gizli pencereden yetkilendirmede de). GÜVENLİK:
  // token artık YAYINLANMIYOR — eskiden ham erişim token'ı widget'lar dahil
  // tüm WebSocket istemcilerine gidiyordu. Sunucu token'ı zaten kaydetti;
  // panel maskeli değeri yeniden okur. Kod yalnız değişim BAŞARISIZSA
  // (istemci sırrı yoksa) eski elle bağlama akışı için gönderilir.
  const bildirim = { type: 'kick_auth_success', ok: !!accessToken, code: accessToken ? undefined : String(code) };
  wsHub.broadcastTo(['dashboard', 'all'], bildirim);

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Kick Yetkilendirmesi - AxBoT</title></head>
    <body style="font-family:system-ui, -apple-system, sans-serif;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="background:#1e293b;padding:36px;border-radius:20px;text-align:center;max-width:500px;border:1px solid rgba(83,252,24,0.4);box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <div style="font-size:42px;margin-bottom:12px;">✅</div>
        <h2 style="color:#53fc18;margin:0 0 12px 0;font-size:22px;">${accessToken ? 'Kick Yetkilendirmesi Başarılı!' : 'Kick Yetki Kodu Alındı!'}</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:20px;">
          ${accessToken 
            ? 'Bot hesabınız başarıyla AxBoT\'a bağlandı! Erişim anahtarı (Access Token) kaydedildi. Artık botunuz yayın sohbetine mesaj gönderebilir.' 
            : 'Kick yetki kodu AxBoT sistemine iletildi: <br/><code style="background:#0f172a;padding:4px 8px;border-radius:6px;color:#53fc18;word-break:break-all;">' + htmlKacisla(code) + '</code>'}
        </p>
        <div style="background:rgba(83,252,24,0.08);border:1px dashed rgba(83,252,24,0.3);padding:12px;border-radius:12px;margin-bottom:20px;font-size:13px;color:#cbd5e1;">
          💡 Bu pencereyi (veya Gizli Sekmeyi) kapatıp <b>AxBoT Paneline</b> dönebilirsiniz. Bağlantı otomatik olarak algılanmıştır.
        </div>
        <button onclick="window.close()" style="padding:12px 28px;background:#53fc18;color:#000;border:none;border-radius:10px;font-weight:900;font-size:14px;cursor:pointer;transition:transform 0.1s;">
          Pencereyi Kapat
        </button>
      </div>
      <script>
        // Sır İÇERMEYEN bildirim (token yok): '*' hedefi bu yüzden güvenli.
        var veri = ${betikJsonu({ type: 'KICK_AUTH_SUCCESS', ok: !!accessToken, code: accessToken ? undefined : String(code) })};
        if (window.opener) {
          try {
            window.opener.postMessage(veri, '*');
            setTimeout(function () { window.close(); }, 1800);
          } catch (e) {}
        }
      </script>
    </body></html>
  `);
});

// B8: Kick kanal ödülleri (oluştur, düzenle, aç/kapat, sil). Kullanımı otomasyonun "ödül" tetiğini çalıştırır.
router.get('/kick/oduller', async (_req: Request, res: Response) => {
  const r = await kickPlatform.odulIstegi('get', '');
  res.status(r.ok ? 200 : 400).json(r);
});

router.post('/kick/oduller', async (req: Request, res: Response) => {
  const g = odulGovdesi(req.body, true);
  if (!g.ok) return res.status(400).json(g);
  const r = await kickPlatform.odulIstegi('post', '', g.govde);
  res.status(r.ok ? 200 : 400).json(r);
});

router.patch('/kick/oduller/:id', async (req: Request, res: Response) => {
  if (!odulKimligiGecerli(String(req.params.id))) return res.status(400).json({ ok: false, hata: 'Geçersiz ödül kimliği' });
  const g = odulGovdesi(req.body, false);
  if (!g.ok) return res.status(400).json(g);
  const r = await kickPlatform.odulIstegi('patch', `/${req.params.id}`, g.govde);
  res.status(r.ok ? 200 : 400).json(r);
});

router.delete('/kick/oduller/:id', async (req: Request, res: Response) => {
  if (!odulKimligiGecerli(String(req.params.id))) return res.status(400).json({ ok: false, hata: 'Geçersiz ödül kimliği' });
  const r = await kickPlatform.odulIstegi('delete', `/${req.params.id}`);
  res.status(r.ok ? 200 : 400).json(r);
});

export default router;
