/**
 * AxBoT API — Sohbet olay mesajları, AI asistan, sohbet overlay ayarı, sabit mesaj, izleyici notları
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { wsHub } from '../../ws/server.js';
import { widgetAyariOku, widgetAyariYaz } from './widgetlar.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { geminiCoHost } from '../../modules/ai/gemini.js';
import { sohbetUyarilari } from '../../modules/chat-alerts/chat-alerts.js';
import { takipAdaylari, varsayilanTakipMetinleri, TAKIP_TEMA_ADLARI, TEMA_ADLARI, TEMA_MESAJLARI } from '../../modules/chat-alerts/temalar.js';
import { seyrekUyar } from '../../core/logger.js';
import { platformManager } from '../../platforms/manager.js';
import { AvatarOnbellek, avatarIstegiGecerli } from '../../modules/chat-avatar/avatar-onbellek.js';
import { kullaniciKarti } from '../../modules/moderation/kullanici-karti.js';

const router = Router();

const avatarlar = new AvatarOnbellek(async (platform, ad) => (await platformManager.getPlatform(platform)?.avatarBul?.(ad)) ?? null);

// Sohbet satırları ve OBS sohbeti <img> ile buraya gelir; resim platformun kendi adresinden yüklenir
router.get('/chat/avatar/:platform/:ad', async (req: Request, res: Response) => {
  const platform = String(req.params.platform);
  const ad = String(req.params.ad);
  if (!avatarIstegiGecerli(platform, ad)) return res.status(400).end();
  const url = await avatarlar.getir(platform, ad);
  if (!url) return res.set('Cache-Control', 'public, max-age=600').status(404).end();
  res.set('Cache-Control', 'public, max-age=3600').redirect(302, url);
});

// 9.0 Sohbet tarafi olay mesajlari
router.get('/chat-alerts', (req: Request, res: Response) => {
  res.json(sohbetUyarilari.ayarOku());
});

// Temalı mesajlar (Star Wars, Harry Potter…): seçim ve örnekler
router.get('/chat-alerts/tema', (_req: Request, res: Response) => {
  res.json({ tema: sohbetUyarilari.temaOku(), temalar: TEMA_ADLARI, ornekler: TEMA_MESAJLARI });
});
router.post('/chat-alerts/tema', (req: Request, res: Response) => {
  res.json({ tema: sohbetUyarilari.temaYaz(String(req.body?.tema || 'yok')) });
});

// Yeni takipçi karşılaması: temalar ve örnek mesajlar
const karsilamaDurumu = () => {
  const duzenlenen = sohbetUyarilari.takipMetinleriOku();
  return {
    secili: sohbetUyarilari.takipTemalariOku(),
    temalar: Object.entries(TAKIP_TEMA_ADLARI).map(([id, ad]) => ({
      id,
      ad,
      ornekler: takipAdaylari([id], duzenlenen),
      varsayilan: varsayilanTakipMetinleri(id),
      duzenlendi: id in duzenlenen
    }))
  };
};
router.get('/chat-alerts/karsilama', (_req: Request, res: Response) => {
  res.json(karsilamaDurumu());
});
/** Bir temanın karşılama metinleri: `{ tema, metinler: string[] }`; `metinler: null` gömülü metinlere döndürür */
router.post('/chat-alerts/karsilama/metinler', (req: Request, res: Response) => {
  sohbetUyarilari.takipMetinleriYaz(String(req.body?.tema || ''), req.body?.metinler ?? null);
  res.json(karsilamaDurumu());
});
router.post('/chat-alerts/karsilama', (req: Request, res: Response) => {
  res.json({ secili: sohbetUyarilari.takipTemalariYaz(req.body?.temalar) });
});

router.post('/chat-alerts', (req: Request, res: Response) => {
  res.json(sohbetUyarilari.ayarYaz(req.body || {}));
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

// 12. Chat Overlay Settings
//
// Bu uç eskiden `chat_overlay_settings` adlı AYRI bir kayda yazıyordu; OBS'teki
// sohbet bileşeni ise `widget_settings_chat-overlay` kaydını okuyor. Overlay
// Stüdyo'nun sohbet sekmesinde yapılan değişiklikler bu yüzden OBS'e hiç
// yansımıyordu. Artık tek kayıt var: eski uç, geriye dönük uyumluluk için o
// kaydı okur/yazar (eski kaydın değerleri yalnız okumada taban olarak kalır).
const ESKI_SOHBET_VARSAYILANI = {
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

router.get('/settings/chat-overlay', (req: Request, res: Response) => {
  let eski: Record<string, unknown> = {};
  try {
    const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'chat_overlay_settings'").get() as any;
    eski = row ? JSON.parse(row.value) : {};
  } catch {
    eski = {};
  }
  res.json({ ...ESKI_SOHBET_VARSAYILANI, ...eski, ...widgetAyariOku('chat-overlay') });
});

router.post('/settings/chat-overlay', (req: Request, res: Response) => {
  const sonuc = widgetAyariYaz('chat-overlay', req.body);
  if (!sonuc.ok) return res.status(400).json({ success: false, error: sonuc.hata });
  res.json({ success: true, settings: sonuc.deger });
});

// 15. Pinned Messages (OBS Pinned Message Overlay)
router.get('/pinned', (req: Request, res: Response) => {
  const pinned = db.prepare('SELECT * FROM pinned_messages ORDER BY created_at DESC LIMIT 1').get();
  res.json(pinned || null);
});

router.post('/pinned', (req: Request, res: Response) => {
  // Doğrulama: boş mesaj sabitlenmez, uzunluk ve renk biçimi sınırlı
  const message = String(req.body?.message ?? '').trim().slice(0, 500);
  if (!message) return res.status(400).json({ success: false, error: 'Sabitlenecek mesaj boş.' });
  const platform = /^(kick|twitch|youtube|tiktok|discord|trovo)$/.test(String(req.body?.platform)) ? String(req.body.platform) : 'kick';
  const username = String(req.body?.username ?? '').slice(0, 60);
  const displayName = String(req.body?.displayName ?? '').slice(0, 60);
  const color = /^#[0-9a-f]{3,8}$/i.test(String(req.body?.color)) ? String(req.body.color) : '#8b5cf6';
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

// Mesajı OBS sohbet kutusunda birkaç saniye vurgular (U5). Liste dışındaysa kutu onu vurgulu ekler.
router.post('/chat/highlight', (req: Request, res: Response) => {
  const message = String(req.body?.message ?? '').trim().slice(0, 500);
  if (!message) return res.status(400).json({ success: false, error: 'Vurgulanacak mesaj boş.' });
  const platform = /^(kick|twitch|youtube|tiktok|discord|trovo)$/.test(String(req.body?.platform)) ? String(req.body.platform) : 'kick';
  const veri = {
    id: String(req.body?.id ?? '').slice(0, 120) || `vurgu-${Date.now()}`,
    platform,
    username: String(req.body?.username ?? '').slice(0, 60),
    displayName: String(req.body?.displayName ?? '').slice(0, 60),
    color: /^#[0-9a-f]{3,8}$/i.test(String(req.body?.color)) ? String(req.body.color) : undefined,
    message,
    sure: 15000,
  };
  wsHub.broadcastTo(['chatbox'], { type: 'chat_highlight', data: veri });
  res.json({ success: true });
});

router.delete('/pinned', (req: Request, res: Response) => {
  db.prepare('DELETE FROM pinned_messages').run();
  wsHub.broadcastTo(['all'], { type: 'pinned_message', data: null });
  res.json({ success: true });
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

router.get('/viewers/:username/kart', (req: Request, res: Response) => {
  const username = String(req.params.username || '').replace(/^@/, '').trim().slice(0, 60);
  if (!username) return res.status(400).json({ hata: 'ad yok' });
  const mesajlar = db.prepare(`
    SELECT message, timestamp FROM stream_events
    WHERE username = ? COLLATE NOCASE AND event_type = 'chat' AND message IS NOT NULL AND TRIM(message) <> ''
    ORDER BY timestamp DESC LIMIT 20
  `).all(username) as { message: string; timestamp: number }[];
  const kayitlar = db.prepare(`
    SELECT action, timestamp, details, target FROM audit_logs
    WHERE target = ? COLLATE NOCASE OR target = ?
    ORDER BY timestamp DESC LIMIT 40
  `).all(username, `@${username}`) as { action: string; timestamp: number; details: string | null; target: string | null }[];
  res.json(kullaniciKarti(username, mesajlar, kayitlar));
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
  } catch (e) {
    /* anahtar yok / model hatası → kelime yöntemine düş */
    seyrekUyar('ai:duygu', '[AI] Duygu analizi modeli kullanılamadı — kelime yöntemine düşüldü', e, 300_000);
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

export default router;
