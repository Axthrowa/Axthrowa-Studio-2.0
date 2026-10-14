/**
 * StreamAxT API — Subathon, Hype Treni, hepsi-bir-arada overlay, widget testleri ve ayarları
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { wsHub } from '../../ws/server.js';
import { ttsEngine } from '../../modules/tts/tts.js';
import { subathon } from '../../modules/subathon/subathon.js';
import { hypeTreni } from '../../modules/hype/hype-train.js';
import { WIDGET_KIMLIGI, widgetAyariniTemizle } from '../../modules/widgets/settings-validate.js';
import { seyrekUyar } from '../../core/logger.js';

const router = Router();

// 9.2 Subathon — sayac artik SUNUCUDA. Eskiden tamamen tarayicidaydi:
// iki OBS kaynagi acilinca iki farkli sayac gorunuyor, panel sayaci
// goremiyor ve KICKs olayi hic eklenmiyordu.
router.get('/subathon', (req: Request, res: Response) => {
  res.json(subathon.durumAl());
});

// Hype Treni (B3) — durum sunucuda
router.get('/hype-train', (_req: Request, res: Response) => res.json(hypeTreni.durum()));
router.post('/hype-train/reset', (_req: Request, res: Response) => {
  hypeTreni.sifirla();
  res.json(hypeTreni.durum());
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

// 18. All-in-One Overlay Settings (Single OBS URL: /widgets/overlay)
export function normalizeAllInOneConfig(cfg: any) {
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

/** Hepsi-bir-arada katman ayarı (bozuksa varsayılan). Sesli komutlar da kullanır. */
export function overlayAyariOku(): any {
  const row = db.prepare("SELECT config_json FROM all_in_one_overlay_settings WHERE id = 'default'").get() as any;
  if (row?.config_json) {
    try {
      return normalizeAllInOneConfig(JSON.parse(row.config_json));
    } catch (e) {
      seyrekUyar('overlay:all-in-one', '[Overlay] Hepsi-bir-arada ayarı bozuk — varsayılan kullanılıyor', e);
    }
  }
  return normalizeAllInOneConfig(null);
}

router.get('/overlay/all-in-one', (req: Request, res: Response) => {
  res.json(overlayAyariOku());
});

/** Ayarı kaydeder ve /widgets/overlay açık olan her OBS'e canlı yollar. */
export function overlayAyariYaz(girdi: any): any {
  const config = normalizeAllInOneConfig(girdi);
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
  return config;
}

router.post('/overlay/all-in-one', (req: Request, res: Response) => {
  const config = overlayAyariYaz(req.body);
  res.json({ success: true, config, message: 'All-in-One Overlay ayarları kaydedildi ve OBS güncellendi!' });
});

// 18. Universal Widget Test Trigger Endpoint
/** Widget test tetikleyicisi (Overlay Studio "Test" düğmesi ve sesli komutlar). Gerçek durum değişmez. */
export function widgetTesti(widgetName: string, body: any = {}): void {
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
    // NOT: Aşağıdaki üç test eskiden widget'ın HİÇ dinlemediği mesajları
    // yayınlıyordu (hype_train_progress, subathon_update, now_playing):
    // Test düğmesi hiçbir şey yapmıyordu. Artık widget'ın gerçekten dinlediği
    // biçimde, `test: true` ile gönderiliyor; widget birkaç saniye örneği
    // gösterip gerçek duruma döner — gerçek tren/sayaç/şarkı DEĞİŞMEZ.
    case 'hype-train':
      hypeTreni.testGoster();
      break;
    case 'subathon': {
      const d = subathon.durumAl();
      wsHub.broadcastTo(['all'], {
        type: 'subathon_state',
        data: {
          ...d,
          aktif: true,
          bitisAni: Date.now() + (Number(body.timeRemaining) || 14400) * 1000,
          kalanSaniye: Number(body.timeRemaining) || 14400,
          sonEkleme: { metin: '+5 dk · test aboneliği', saniye: 300, zaman: Date.now() },
          test: true
        }
      });
      break;
    }
    case 'now-playing':
      wsHub.broadcastTo(['all'], {
        type: 'song_started',
        test: true,
        song: {
          title: body.title || 'Test Şarkısı',
          artist: body.artist || 'StreamAxT',
          requestedBy: body.requestedBy || 'TestIzleyici',
          thumbnail: body.coverUrl || '',
          duration: 200
        }
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
}

router.post('/widgets/test/:widgetName', (req: Request, res: Response) => {
  const { widgetName } = req.params;
  widgetTesti(String(widgetName), req.body || {});
  res.json({ success: true, widget: widgetName, message: `${widgetName} testi tetiklendi!` });
});

/** Bir widget'ın kayıtlı ayarı (yoksa / bozuksa boş nesne). */
export function widgetAyariOku(widgetId: string): Record<string, unknown> {
  try {
    const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(`widget_settings_${widgetId}`) as { value: string } | undefined;
    return row?.value ? JSON.parse(row.value) : {};
  } catch {
    return {};
  }
}

/**
 * Widget ayarını doğrulayıp birleştirerek yazar ve OBS'teki katmanlara yayınlar.
 * B2: kimlik, boyut, derinlik, prototip kirletme ve tür denetimi.
 */
export function widgetAyariYaz(
  widgetId: string,
  govde: unknown
): { ok: true; deger: Record<string, unknown>; uyarilar: string[] } | { ok: false; hata: string } {
  if (!WIDGET_KIMLIGI.test(String(widgetId))) return { ok: false, hata: 'Geçersiz widget kimliği' };
  const current = widgetAyariOku(widgetId); // bozuk kayıt: yeni ayar temiz başlar
  const temiz = widgetAyariniTemizle(govde || {}, current);
  if (!temiz.ok) return { ok: false, hata: temiz.hata };
  const updated = { ...current, ...temiz.deger };
  db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(`widget_settings_${widgetId}`, JSON.stringify(updated));
  wsHub.broadcastTo(['all'], { type: 'widget_settings', widgetId, settings: updated });
  return { ok: true, deger: updated, uyarilar: temiz.uyarilar };
}

router.get('/widgets/:widgetId/settings', (req: Request, res: Response) => {
  if (!WIDGET_KIMLIGI.test(String(req.params.widgetId))) return res.status(400).json({ error: 'Geçersiz widget kimliği' });
  res.json(widgetAyariOku(String(req.params.widgetId)));
});

router.post('/widgets/:widgetId/settings', (req: Request, res: Response) => {
  const sonuc = widgetAyariYaz(String(req.params.widgetId), req.body);
  if (!sonuc.ok) return res.status(400).json({ error: sonuc.hata });
  if (sonuc.uyarilar.length) {
    console.warn(`[Widget] ${req.params.widgetId} ayarında düzeltme:`, sonuc.uyarilar.slice(0, 5).join(' · '));
    // Yanıt gövdesi değişmesin (panel ayar nesnesi bekliyor); uyarı başlıkta
    res.setHeader('X-StreamAxT-Uyari', encodeURIComponent(sonuc.uyarilar.slice(0, 3).join(' | ')));
  }
  res.json(sonuc.deger);
});

export default router;
