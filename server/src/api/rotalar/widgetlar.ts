/**
 * AxBoT API — Subathon, Hype Treni, hepsi-bir-arada overlay, widget testleri ve ayarları
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
import { kingSystemService } from '../../modules/games/king-system.js';
import { WIDGET_KIMLIGI, widgetAyariniTemizle } from '../../modules/widgets/settings-validate.js';
import { seyrekUyar } from '../../core/logger.js';
import { canliDurum } from '../../core/live-status.js';
import { kupa } from '../../modules/engagement/kupa.js';
import { etiketVerisi } from '../../modules/widgets/olay-etiketleri.js';
import { takipciSayisi } from '../../modules/widgets/takipci-sayisi.js';
import { carkCevir } from '../../modules/engagement/cark.js';
import { sohbetIstatistik } from '../../modules/community/sohbet-istatistik.js';
import { skorOku, skorYaz } from '../../modules/community/sohbet-araclari.js';

const router = Router();

// 9.2 Subathon — sayac artik SUNUCUDA. Eskiden tamamen tarayicidaydi:
// iki OBS kaynagi acilinca iki farkli sayac gorunuyor, panel sayaci
// goremiyor ve KICKs olayi hic eklenmiyordu.
router.get('/subathon', (req: Request, res: Response) => {
  res.json(subathon.durumAl());
});

// Hype Treni (B3) — durum sunucuda
router.get('/hype-train', (_req: Request, res: Response) => res.json(hypeTreni.durum()));

// Sohbet istatistikleri (kelime bulutu widget'ı ve panel)
router.get('/sohbet-istatistik', (_req: Request, res: Response) => res.json(sohbetIstatistik.ozet()));
router.post('/sohbet-istatistik/sifirla', (_req: Request, res: Response) => {
  sohbetIstatistik.sifirla();
  res.json(sohbetIstatistik.ozet());
});

// Skor tablosu widget'ı: panel/komut değiştirir, OBS anında görür
router.get('/skor-tablosu', (_req: Request, res: Response) => res.json(skorOku()));
router.post('/skor-tablosu', (req: Request, res: Response) => {
  const t = skorYaz(req.body || {});
  wsHub.broadcastTo(['all'], { type: 'skor_tablosu', data: t });
  res.json(t);
});
router.post('/hype-train/reset', (_req: Request, res: Response) => {
  hypeTreni.sifirla();
  res.json(hypeTreni.durum());
});
router.post('/hype-train/start', (_req: Request, res: Response) => {
  hypeTreni.baslat();
  res.json(hypeTreni.durum());
});

// Olay Etiketleri — son olaylar veritabanından (sayfa açılınca "—" kalmasın)
router.get('/event-labels', async (_req: Request, res: Response) => {
  try {
    res.json({ ...etiketVerisi(), takipciSayisi: await takipciSayisi() });
  } catch (e) {
    seyrekUyar('etiket:oku', '[Etiketler] Son olaylar okunamadı', e);
    res.json({});
  }
});

// Bağış Kupası — durum sunucuda (OBS yenilenince içi korunur)
router.get('/cup', (_req: Request, res: Response) => res.json({ ogeler: kupa.liste() }));
router.post('/cup/reset', (_req: Request, res: Response) => {
  kupa.sifirla();
  wsHub.broadcastTo(['all'], { type: 'cup_clear' });
  res.json({ success: true, ogeler: [] });
});

router.post('/subathon/settings', (req: Request, res: Response) => {
  const g = req.body || {};
  const sayi = (v: any, varsayilan: number) => (v === undefined || v === null || v === '' ? varsayilan : Math.max(0, Number(v) || 0));
  const mevcut = subathon.ayarOku();
  const acik = (v: any, varsayilan: boolean) => (typeof v === 'boolean' ? v : varsayilan);
  res.json(
    subathon.ayarYaz({
      baslangicDakika: sayi(g.baslangicDakika, mevcut.baslangicDakika),
      aboneDakika: sayi(g.aboneDakika, mevcut.aboneDakika),
      hediyeAboneDakika: sayi(g.hediyeAboneDakika, mevcut.hediyeAboneDakika),
      bagisDakika: sayi(g.bagisDakika, mevcut.bagisDakika),
      bagisBirimi: Math.max(1, sayi(g.bagisBirimi, mevcut.bagisBirimi)),
      kicksDakika: sayi(g.kicksDakika, mevcut.kicksDakika),
      kicksBirimi: Math.max(1, sayi(g.kicksBirimi, mevcut.kicksBirimi)),
      takipDakika: sayi(g.takipDakika, mevcut.takipDakika),
      maksSaat: sayi(g.maksSaat, mevcut.maksSaat),
      aboneAcik: acik(g.aboneAcik, mevcut.aboneAcik),
      hediyeAcik: acik(g.hediyeAcik, mevcut.hediyeAcik),
      bagisAcik: acik(g.bagisAcik, mevcut.bagisAcik),
      kicksAcik: acik(g.kicksAcik, mevcut.kicksAcik),
      takipAcik: acik(g.takipAcik, mevcut.takipAcik)
    })
  );
});

router.post('/subathon/start', (req: Request, res: Response) => {
  res.json(subathon.baslat(req.body?.dakika));
});

router.post('/subathon/stop', (req: Request, res: Response) => {
  res.json(subathon.durdur());
});

// Duraklatılmış (ya da önceki yayından kalan) süreyle kaldığı yerden sürdür
router.post('/subathon/resume', (_req: Request, res: Response) => {
  res.json(subathon.devam());
});
router.post('/subathon/reset', (_req: Request, res: Response) => {
  res.json(subathon.sifirla());
});

/** Elle sure ekle/cikar: `{ dakika: 5 }` veya `{ dakika: -5 }`. */
router.post('/subathon/add', (req: Request, res: Response) => {
  const dk = Number(req.body?.dakika);
  if (!Number.isFinite(dk) || dk === 0) return res.status(400).json({ error: 'dakika gerekli' });
  res.json(subathon.sureEkle(Math.round(dk * 60), `${dk > 0 ? '+' : ''}${dk} dk · elle`, true));
});

// Tek URL'yi açık tüm OBS kaynaklarında yeniden yükler
// İzleyici Sayacı widget'ı: yayın yoklamasının gördüğü sayılar
router.get('/overlay/izleyici', (_req: Request, res: Response) => {
  const say = (p: string) => canliDurum.platform(p)?.izleyici ?? 0;
  res.json({ kick: say('kick'), twitch: say('twitch'), youtube: say('youtube') });
});

router.post('/overlay/reload', (req: Request, res: Response) => {
  wsHub.broadcastTo(['all'], { type: 'overlay_reload' });
  res.json({ success: true });
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
    emoteCombo: { enabled: true, x: 760, y: 340, width: 400, height: 400, scale: 1 },
    nowPlaying: { enabled: false, x: 1460, y: 960, width: 420, height: 90, scale: 1 },
    theCup: { enabled: false, x: 1580, y: 610, width: 300, height: 430, scale: 1 },
    polls: { enabled: false, x: 1540, y: 180, width: 340, height: 260, scale: 1 },
    wheel: { enabled: false, x: 760, y: 340, width: 400, height: 400, scale: 1 },
    hypeTrain: { enabled: false, x: 685, y: 350, width: 550, height: 130, scale: 1 },
    // Yalnız çekiliş açıkken ve mesaj sabitliyken görünürler; kapalı başlayınca panelden yapılan işlem OBS'e yansımıyordu
    giveaway: { enabled: true, x: 660, y: 380, width: 600, height: 300, scale: 1 },
    pinned: { enabled: true, x: 560, y: 820, width: 800, height: 110, scale: 1 }
  };

  const result: any = { ...defaults, ...(cfg || {}) };
  // Eski kayıt: kombo tam ekran katmandı, taşınamıyordu. Ayarı olmayan tam ekran kutu yeni varsayılana iner
  const kombo = result.emoteCombo;
  if (kombo?.width === 1920 && kombo?.height === 1080 && kombo?.etkiTamEkran === undefined) {
    result.emoteCombo = { ...kombo, ...defaults.emoteCombo, enabled: kombo.enabled, etkiTamEkran: false };
  }
  // Eski varsayılan yerleşim: üstü olay şeridinin altında, altı kutudan taşıyordu
  const sayac = result.viewerCounter;
  if (sayac?.x === 1660 && sayac?.y === 20 && sayac?.width === 220 && sayac?.height === 60) {
    result.viewerCounter = { ...sayac, y: 140, height: 110 };
  }
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
    case 'on-screen-emotes':
      // Kombodan ayrı: yalnız ekranda emote widget'ı alır; sohbetten gelen emote'lar gibi kenardan kenara uçar
      for (let i = 0; i < 8; i++) {
        setTimeout(() => wsHub.broadcastTo(['all'], { type: 'kappagen', test: true, patlama: false, emotes: [{ ad: body.emote || '🔥' }, { ad: '🎉' }] }), i * 250).unref?.();
      }
      break;
    case 'emote-combo':
      // Gerçek kombo gibi: emote art arda gelir, büyür, durunca patlar
      for (let i = 0; i < 7; i++) {
        setTimeout(() => wsHub.broadcastTo(['all'], { type: 'emote_used', emote: body.emote || '🔥' }), i * 350).unref?.();
      }
      break;
    case 'muzik-video':
      wsHub.broadcastTo(['all'], { type: 'muzik_video_test' });
      break;
    case 'the-cup':
      {
        // Yalnız görsel: kupanın kayıtlı içeriği değişmez, widget birkaç saniye sonra kayıtlı hâline döner
        const tur = ({ coin: 'tip', bits: 'kicks', kicks: 'kicks', sub: 'sub', gift: 'gift_sub' } as Record<string, string>)[String(body.tokenType || 'coin')] || 'tip';
        const adet = Math.min(20, Math.max(1, Number(body.count) || 5));
        wsHub.broadcastTo(['all'], { type: 'cup_drop', test: true, data: { type: tur, adet, user: 'Test' } });
      }
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
          artist: body.artist || 'AxBoT',
          requestedBy: body.requestedBy || 'TestIzleyici',
          thumbnail: body.coverUrl || '',
          duration: 200
        }
      });
      break;
    case 'shoutout':
      // Widget gerçek shoutout'taki gibi `data` içinde bekler; eskiden alanlar düz gönderildiği için test görünmüyordu
      wsHub.broadcastTo(['all'], {
        type: 'shoutout',
        data: {
          channel: body.channel || 'StreamMaster',
          platform: body.platform || 'kick',
          oyun: body.oyun || 'Grand Theft Auto VI',
          avatarUrl: body.avatarUrl || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop',
          message: body.message || 'Bu harika yayıncıyı takip etmeyi unutmayın!'
        }
      });
      break;
    case 'credits':
      wsHub.broadcastTo(['all'], {
        type: 'credits_start'
      });
      break;
    case 'wheel':
    case 'wheel-of-fortune':
      {
        // Panelde kayıtlı dilimler ve ağırlıklarıyla (eskiden sabit 0–7)
        const sonuc = carkCevir();
        wsHub.broadcastTo(['all'], { type: 'wheel_spin', payload: { index: sonuc.index, label: sonuc.etiket } });
      }
      break;
    case 'tts':
    case 'cloud-tts':
      ttsEngine.enqueue(body.text || 'AxBoT widget TTS testi. Dil ve ses ayarları uygulandı.', body.user || 'Yayıncı');
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
      wsHub.broadcastTo(['all'], { type: 'viewer_count', test: true, kick: 128, twitch: 64, youtube: 42, total: 234 });
      break;
    // Aşağıdakiler eskiden varsayılana düşüp ilgisiz bir takipçi uyarısı gösteriyordu.
    // Yalnız katmana örnek gider; veritabanındaki anket/çekiliş/talep değişmez.
    case 'polls':
      wsHub.broadcastTo(['all'], {
        type: 'poll_update',
        test: true,
        poll: { question: 'Test anketi: hangi oyun?', options: ['CS2', 'Valorant', 'Minecraft'], votes: { 1: 6, 2: 3, 3: 1 }, endsAt: Date.now() + 20_000 }
      });
      break;
    case 'giveaways':
      wsHub.broadcastTo(['all'], { type: 'giveaway_winner', test: true, payload: { winner: body.username || 'TestIzleyici', adaylar: ['Mira', 'Deniz', 'Kaan', 'Ece', 'Bora', 'Lale', 'Arda', 'Selin'] } });
      break;
    case 'loyalty-redemptions':
      wsHub.broadcastTo(['all'], {
        type: 'loyalty_redeemed',
        data: { id: `test-${Date.now()}`, user: body.username || 'TestIzleyici', rewardTitle: 'Test ödülü', rewardType: 'custom', cost: 500, timestamp: Date.now() }
      });
      break;
    // Galeride testi olmayan widget'lar: yalnız katmana örnek gider, kayıtlı durum değişmez
    case 'chat-overlay': {
      const testId = `test-${Date.now()}`;
      // Örnek mesaj birkaç saniye sonra sohbet katmanından kalkar
      setTimeout(() => wsHub.broadcastTo(['all'], { type: 'chat_deleted', data: { platform: 'kick', id: testId } }), 8000).unref?.();
      wsHub.broadcastTo(['all'], {
        type: 'chat',
        data: {
          id: testId,
          platform: 'kick',
          channel: 'test',
          user: { id: 'test', username: 'testizleyici', displayName: 'TestIzleyici', badges: [], isMod: false, isSub: true, isVip: false, isBroadcaster: false, color: '#22d3ee' },
          message: body.message || 'Merhaba! Bu bir sohbet katmanı testidir 👋',
          timestamp: Date.now()
        }
      });
      break;
    }
    case 'donation-goal':
    case 'follower-goal':
    case 'subscriber-goal':
    case 'kicks-goal':
      // Test hedefi DEĞİŞTİRMEZ: widget birkaç saniye örnek artışı gösterip kayıtlı değere döner
      wsHub.broadcastTo(['all'], { type: 'hedef_testi', widgetId: widgetName, artis: ({ 'donation-goal': 50, 'kicks-goal': 100 } as Record<string, number>)[widgetName] || 1 });
      break;
    case 'event-labels':
      // Etiketler test uyarılarını bilerek yok sayar (gerçek "son takipçi" bozulmasın): test için örnek
      // değerler birkaç saniye gösterilir, sonra gerçek değerlere dönülür
      wsHub.broadcastTo(['all'], { type: 'event_labels_test' });
      break;
    case 'pinned-messages':
      wsHub.broadcastTo(['all'], {
        type: 'pinned_message',
        data: { id: `test-${Date.now()}`, username: 'testizleyici', displayName: 'TestIzleyici', message: 'Sabitlenmiş mesaj testi 📌', platform: 'kick' }
      });
      // Gerçekte sabitlenmiş mesaj geri gelir (eskiden ekran boşaltılıyor, yayındaki sabit mesaj kayboluyordu)
      setTimeout(() => {
        const gercek = db.prepare('SELECT * FROM pinned_messages ORDER BY created_at DESC LIMIT 1').get();
        wsHub.broadcastTo(['all'], { type: 'pinned_message', data: gercek || null });
      }, 8000).unref?.();
      break;
    case 'king':
      wsHub.broadcastTo(['all'], {
        type: 'king_update',
        state: { username: 'testkral', displayName: 'TestKral', pointsBid: 5000, title: 'Test Kralı', crownedAt: Date.now(), test: true }
      });
      // 8 sn sonra gerçek taht (eskiden test kralı bir sonraki gerçek değişikliğe dek ekranda kalıyordu)
      setTimeout(() => {
        // Boş taht da durum olarak gönderilir (widget "Taht boş" kartını gösterir)
        wsHub.broadcastTo(['all'], { type: 'king_update', state: kingSystemService.getKingState() });
      }, 8000).unref?.();
      break;
    case 'scoreboard': {
      // Örnek skor 6 sn görünür, sonra gerçek tablo geri gelir
      const gercek = skorOku();
      wsHub.broadcastTo(['all'], { type: 'skor_tablosu', data: { ...gercek, takimlar: gercek.takimlar.map((t, i) => ({ ...t, skor: t.skor + i + 1 })) } });
      setTimeout(() => wsHub.broadcastTo(['all'], { type: 'skor_tablosu', data: skorOku() }), 6000).unref?.();
      break;
    }
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
    res.setHeader('X-AxBoT-Uyari', encodeURIComponent(sonuc.uyarilar.slice(0, 3).join(' | ')));
  }
  res.json(sonuc.deger);
});

export default router;
