/**
 * StreamAxT API — Şarkı isteği, TTS (filtre, ses, kuyruk), şarkı sözleri
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { songRequest } from '../../modules/songrequest/songrequest.js';
import { multiEngineTTS } from '../../modules/tts/tts-engine.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { ttsEngine } from '../../modules/tts/tts.js';
import { muzikHost } from '../../modules/muzik/index.js';
import { sozleriGetir } from '../../modules/muzik/sozler.js';

const router = Router();

// 6. Song Request Queue & Desktop Player
router.get('/songrequest/queue', (req: Request, res: Response) => {
  const current = songRequest.getCurrentSong();
  const queue = songRequest.getQueueList();
  res.json({ current, queue });
});

// "Şu An Çalan" OBS widget'ı bu ucu istiyordu ama yoktu (404): çalan şarkı
// OBS'te yalnız `song_started` olayı anında görünüyor, sayfa yenilenince
// ya da sonradan açılınca kayboluyordu.
router.get('/songrequest/current', (req: Request, res: Response) => {
  // ?video=1: Şarkı Klipleri widget'ı için kuyruktaki ilk YouTube isteği
  res.json((req.query.video === '1' ? songRequest.klipSirasi() : songRequest.getCurrentSong()) || null);
});

// Şarkı Klipleri widget'ı: video bitti → sıradakine geç (yalnız bitti denen şarkı hâlâ çalıyorsa)
router.post('/songrequest/bitti', (req: Request, res: Response) => {
  res.json({ success: songRequest.klipBitti(String(req.body?.id || '')) });
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

// 8.95 TTS filtreleri — neler okunsun, hangi sinirlar gecerli?
router.get('/tts/filters', (req: Request, res: Response) => {
  res.json(ttsEngine.filtreAyarlari());
});

router.post('/tts/filters', (req: Request, res: Response) => {
  res.json(ttsEngine.filtreYaz(req.body || {}));
});

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

// 7. Canlı şarkı sözleri: GERÇEKTEN çalan parça (Spotify/YTMD), yoksa istek kuyruğu.
// İlerleme bilgisi de döner: widget zaman damgalı sözleri şarkıyla senkron gösterir.
router.get('/lyrics/current', async (req: Request, res: Response) => {
  const calan = muzikHost.simdiCalan();
  const istek = songRequest.getCurrentSong();
  const elle = String(req.query.title || '').slice(0, 200);
  const title = elle || calan?.title || istek?.title || '';
  const artist = elle ? String(req.query.artist || '').slice(0, 200) : calan?.artist || '';
  if (!title) {
    return res.json({ title: '', artist: '', synced: false, bulundu: false, lines: [], kaynak: null });
  }
  const soz = await sozleriGetir(title, artist, calan?.duration || 0);
  res.json({
    ...soz,
    // Başlıkta çalan parçanın özgün adı (lrclib Türkçe karakterleri düşürebiliyor)
    title: elle ? soz.title : calan?.title || soz.title,
    artist: elle ? soz.artist : calan?.artist || soz.artist,
    kaynak: elle ? 'elle' : calan ? calan.source : 'istek',
    // Senkron için: ilerleme + örnekleme anı (widget aradaki süreyi ekler)
    progressMs: calan?.progress ?? null,
    updatedAt: calan?.updatedAt ?? null,
    isPlaying: calan?.isPlaying ?? null,
    durationMs: calan?.duration ?? null
  });
});

export default router;
