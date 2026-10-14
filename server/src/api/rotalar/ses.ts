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
import axios from 'axios';
import { songRequest } from '../../modules/songrequest/songrequest.js';
import { multiEngineTTS } from '../../modules/tts/tts-engine.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';
import { ttsEngine } from '../../modules/tts/tts.js';
import { seyrekUyar } from '../../core/logger.js';

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
  res.json(songRequest.getCurrentSong() || null);
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
    // Ağ/servis hatası: aşağıdaki "söz bulunamadı" yanıtına düşülür
    seyrekUyar('sarki-sozu', '[Şarkı sözü] Söz servisine ulaşılamadı', err, 300_000);
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

export default router;
