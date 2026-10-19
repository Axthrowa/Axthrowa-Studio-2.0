/**
 * StreamAxT API — Bağışlar, BynoGame, Jumpscare
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
import economyService from '../../modules/economy/economy.js';
import { ttsEngine } from '../../modules/tts/tts.js';
import { hataMetni, seyrekUyar } from '../../core/logger.js';

const router = Router();

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

  wsHub.kupayaDusur('tip', { user: safeName, amount: numAmount });

  try {
    economyService.recordTip(safeName, 'kick', numAmount);
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

export default router;
