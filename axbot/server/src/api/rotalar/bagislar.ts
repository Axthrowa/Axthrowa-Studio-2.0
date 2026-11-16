/**
 * AxBoT API — Bağışlar, BynoGame, Jumpscare
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { randomBytes, randomUUID as uuidv4, timingSafeEqual } from 'crypto';
import { wsHub } from '../../ws/server.js';
import economyService from '../../modules/economy/economy.js';
import { ttsEngine } from '../../modules/tts/tts.js';
import { hataMetni, seyrekUyar } from '../../core/logger.js';
import { hedefOlayiIsle } from '../../modules/goals/hedefler.js';
import { settingsCache } from '../../core/settings-cache.js';

const router = Router();

const BAGIS_TOKEN = 'bagis_webhook_token';
const BAGIS_UCLARI = new Set(['/api/donations/bynogame', '/api/donations/webhook']);

/**
 * Bağış sitesi `localhost`a ulaşamaz, bildirim tünelden gelir (Host'u tünelin adıdır). Host denetimi
 * yalnız bu iki uç ve doğru anahtar için aşılır: API'nin geri kalanı tünelden yine görünmez.
 */
export function disBagisIstegiMi(yontem: string, yol: string, token: unknown): boolean {
  if (yontem !== 'POST' || !BAGIS_UCLARI.has(yol) || typeof token !== 'string') return false;
  const a = Buffer.from(token);
  const b = Buffer.from(settingsCache.get(BAGIS_TOKEN));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

router.get('/donations/webhook-ayar', (_req: Request, res: Response) => {
  let token = settingsCache.get(BAGIS_TOKEN);
  if (!token) {
    token = randomBytes(24).toString('hex');
    settingsCache.set(BAGIS_TOKEN, token);
  }
  res.json({ token, disAdres: settingsCache.get('bagis_dis_adres') });
});

router.post('/donations/webhook-ayar', (req: Request, res: Response) => {
  const ham = String(req.body?.disAdres ?? '').trim();
  let disAdres = '';
  if (ham) {
    try {
      const u = new URL(ham);
      if (u.protocol !== 'https:') throw new Error('https');
      disAdres = u.origin;
    } catch {
      return res.status(400).json({ error: 'Adres https:// ile başlamalı.' });
    }
  }
  settingsCache.set('bagis_dis_adres', disAdres);
  res.json({ disAdres });
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
  } catch (e) {
    seyrekUyar('ayar:jumpscare_settings', '[Bağış] Jumpscare ayarı okunamadı — varsayılan kullanılıyor', e);
  }
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
  let nested = raw.data || raw.donation || raw.payload || raw.message?.[0] || raw.event || {};
  // Ko-fi veriyi `data` alanında JSON METNİ olarak gönderir
  if (typeof nested === 'string') {
    try {
      nested = JSON.parse(nested);
    } catch {
      nested = {};
    }
  }
  return { ...nested, ...raw };
}

/** "1.250,50" → 1250.5, "1,250.50" → 1250.5, "12,5 TL" → 12.5. Eskiden ilk ikisi NaN → 0 TL bağış oluyordu. */
export function tutarOku(ham: unknown): number {
  let s = String(ham ?? '').replace(/[^\d.,-]/g, '');
  if (s.includes(',')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  }
  return Number(s) || 0;
}

export function parseIncomingDonation(raw: any, query: any = {}) {
  const body = flattenDonationPayload({ ...query, ...(raw || {}) });
  const donorName = String(
    pickDonationField(body, [
      'donorName', 'user_name', 'username', 'user', 'name', 'donator', 'donator_name', 'from_name',
      'gonderen', 'from', 'payer_name', 'displayName', 'display_name'
    ]) || 'Gizli Bağışçı'
  );
  const amountRaw = pickDonationField(body, [
    'amount', 'total', 'donation', 'donation_amount', 'tutar', 'price', 'mc_gross', 'sum'
  ]);
  const amount = tutarOku(amountRaw);
  const currency = String(pickDonationField(body, ['currency', 'para_birimi', 'mc_currency']) || 'TL');
  // Ko-fi'de bağışçı "gizli" dediyse mesaj yayında gösterilmez, okunmaz
  const message = body.is_public === false ? '' : String(
    pickDonationField(body, ['message', 'user_message', 'mesaj', 'note', 'comment', 'msg']) || ''
  );
  const platform = String(pickDonationField(body, ['platform', 'source', 'provider']) || 'bynogame');
  return { donorName, amount, currency, message, platform };
}

export const processDonation = (donorName: string, amount: number, currency: string = 'TL', message: string = '', platform: string = 'bynogame', test = false) => {
  const donationId = uuidv4();
  const numAmount = Math.max(0, Number(amount) || 0);
  const safeName = donorName || 'Gizli Bağışçı';
  const safeCurrency = currency || 'TL';
  const safeMessage = message || '';

  db.prepare(`
    INSERT INTO donations (id, donor_name, amount, currency, message, platform, created_at, alert_shown, jumpscare_triggered)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(donationId, safeName, numAmount, safeCurrency, safeMessage, platform, Date.now());

  // Olay kaydı: eskiden yalnız donations tablosuna yazılıyordu; "Son bağış" etiketi, kapanış jeneriği
  // ve olay akışı BynoGame/webhook bağışlarını hiç görmüyordu. Simülasyon test işaretli (etiketlere yazılmaz).
  db.prepare(
    'INSERT INTO stream_events (id, platform, event_type, username, display_name, message, amount, currency, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), platform, 'tip', safeName, safeName, safeMessage || null, numAmount, safeCurrency, test ? JSON.stringify({ isTest: true }) : null, Date.now());

  const alertData = wsHub.buildAlertPayload('tip', {
    user: safeName,
    amount: numAmount,
    currency: safeCurrency,
    message: safeMessage
  }, test);

  wsHub.sohbetOlayi('bagis', safeName, `${numAmount} ${safeCurrency} bağışladı${safeMessage ? ': ' + safeMessage : ''}`);
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

  wsHub.kupayaDusur('tip', { user: safeName, amount: numAmount });
  // Bu bağışlar olay yolundan geçmez: bağış hedefi ayrıca ilerletilir (simülasyon saymaz)
  hedefOlayiIsle('tip', { amount: numAmount, isTest: test });

  try {
    // Simülasyon sadakat puanı vermez (her deneme 5000 puan yazıyordu)
    if (!test) economyService.recordTip(safeName, 'kick', numAmount);
  } catch (e) {
    console.warn('[Ekonomi] Bağış sadakat kaydına işlenemedi:', hataMetni(e));
  }

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
// GET yok: köken denetimi yalnız yazma yöntemlerinde; GET'i her site <img> ile tetikleyip sahte bağış (TTS, jumpscare) yaratabiliyordu.

router.post('/donations/webhook', (req: Request, res: Response) => {
  try {
    const parsed = parseIncomingDonation(req.body, req.query);
    // BynoGame ucuyla aynı kural: tutarsız bağış yayına "0 TL" uyarısı ve TTS olarak düşmesin
    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz bağış tutarı' });
    }
    const result = processDonation(parsed.donorName, parsed.amount, parsed.currency, parsed.message, parsed.platform || 'custom');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Bağış işlenemedi' });
  }
});

router.post('/donations/simulate', (req: Request, res: Response) => {
  try {
    const { donorName = 'Cömertİzleyici', amount = 100, currency = 'TL', message = 'Harika yayın, devamını dilerim!', platform = 'bynogame' } = req.body || {};
    const result = processDonation(String(donorName), Number(amount), String(currency), String(message || ''), String(platform), true);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Simülasyon başarısız' });
  }
});

export default router;
