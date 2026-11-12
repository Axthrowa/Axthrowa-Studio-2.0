/**
 * AxBoT API — Sistem durumu, genel ayarlar, olay akışı, platform yetenekleri, değişken kataloğu
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { wsHub } from '../../ws/server.js';
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { platformManager } from '../../platforms/manager.js';
import { giveaway } from '../../modules/giveaways/giveaways.js';
import { getStreamUptime } from '../../core/variable-parser.js';
import { canliDurum } from '../../core/live-status.js';
import { settingsCache } from '../../core/settings-cache.js';
import { temizle, gizliMi, yeniSirDegeri } from '../../core/security/redact.js';
import { degiskenKatalogu, degiskenSayisi, baglamOlustur, degiskenleriCoz } from '../../core/variables/index.js';
import { YETENEKLER } from '../../platforms/capabilities.js';
import { sifrele } from '../../core/security/vault.js';
import { ayarGuncellemesiniCoz } from '../../core/settings-input.js';
import { EYLEM_SECENEKLERI, TIMEOUT_KADEMELERI } from '../../modules/automod/enforcement.js';

const router = Router();

// `!bot mute` ile aynı ayar: açıkken yanıtlar ve otomatik mesajlar sohbete gitmez
router.get('/bot/sessiz', (req: Request, res: Response) => {
  res.json({ sessiz: settingsCache.getBoolean('bot_sessiz', false) });
});

router.post('/bot/sessiz', (req: Request, res: Response) => {
  settingsCache.set('bot_sessiz', req.body?.sessiz === true ? '1' : '0');
  res.json({ sessiz: settingsCache.getBoolean('bot_sessiz', false) });
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
    // Botun yayını nasıl gördüğü (platform API yoklaması). `$(uptime)` ve
    // "yalnız yayındayken" komutları buna bağlı; pano rozetinde gösterilir.
    canli: canliDurum.ozet(),
    platforms,
    // Tek URL ya da bir widget OBS'te açık mı (Bağlantılar'daki hazırlık listesi)
    obsKaynaklari: wsHub.obsKaynakSayisi(),
    stats: {
      commandsCount,
      timersCount,
      queueCount,
      hasActiveGiveaway: Boolean(activeGiveaway)
    }
  });
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
  const cozum = ayarGuncellemesiniCoz(req.body);
  if (!cozum.ok) return res.status(400).json({ error: cozum.hata });
  const upsert = db.prepare(`
    INSERT INTO bot_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const mevcutOku = db.prepare('SELECT value FROM bot_settings WHERE key = ?');
  for (const [key, value] of cozum.degerler) {
    // Maskelenmis deger geri gonderildiginde gercek sir "****1234" ile
    // EZILMEMELI; bos gonderim de ayni sekilde mevcut degeri korur.
    if (gizliMi(key)) {
      const mevcut = (mevcutOku.get(key) as { value?: string } | undefined)?.value ?? null;
      const yazilacak = yeniSirDegeri(value, mevcut);
      if (yazilacak === null) continue;
      // S6: sırlar diskte DPAPI ile şifreli
      upsert.run(key, String(sifrele(String(yazilacak))));
      continue;
    }
    upsert.run(key, value);
  }

  settingsCache.reload();
  res.json({ success: true });
});

// 11. Recent Stream Events Feed
// Varsayılan olarak SOHBET HARİÇ: "Canlı Yayın Olay Akışı" ve kapanış jeneriği
// takip/abone/bağış/klip ister; her sohbet mesajı da bu tabloya yazıldığı için
// eskiden son 50 kaydın hepsi sohbetti. `?sohbet=1` eski davranış.
// `?saat=N`: yalnız son N saatin olayları (en çok 500) — kapanış jeneriği bunu kullanır; eskiden
// son 50 olayı tarihe bakmadan alıyor, dünkü yayının takipçileri de jeneriğe düşüyordu.
router.get('/events', (req: Request, res: Response) => {
  const sohbetDahil = req.query.sohbet === '1';
  const saat = Math.min(168, Math.max(0, Number(req.query.saat) || 0));
  const kosul = [sohbetDahil ? '' : "event_type <> 'chat'", saat ? 'timestamp >= ?' : ''].filter(Boolean);
  const events = db
    .prepare(`SELECT * FROM stream_events ${kosul.length ? 'WHERE ' + kosul.join(' AND ') : ''} ORDER BY timestamp DESC LIMIT ${saat ? 500 : 50}`)
    .all(...(saat ? [Date.now() - saat * 3_600_000] : []));
  res.json(events);
});

/**
 * Panel durum şeridi ve Hızlı Kurulum: neyin çalıştığı tek bakışta (ağa çıkmaz, ucuz).
 * Bu turdaki sorunların çoğu (Spotify Studio'da bağlı, anket katmanı kapalı) burada görünür olsun diye.
 */
router.get('/durum-ozeti', async (_req: Request, res: Response) => {
  const durumlar = platformManager.getAllStatuses() as Record<string, { connected?: boolean }>;
  const { muzikHost } = await import('../../modules/muzik/index.js');
  const { wsHub } = await import('../../ws/server.js');
  const { seciliSaglayici, saglayiciAyari } = await import('../../modules/ai/saglayicilar.js');
  const m = muzikHost.durum();
  const saglayici = seciliSaglayici();
  const aiHazir = saglayici
    ? Boolean(saglayiciAyari(saglayici).anahtar || saglayiciAyari(saglayici).tanim.anahtarsiz)
    : Boolean(settingsCache.get('gemini_api_key', '') || process.env.GEMINI_API_KEY);
  res.json({
    platformlar: Object.keys(durumlar).filter((k) => durumlar[k]?.connected),
    muzik: m.spotify.connected ? 'spotify' : m.harici.spotify ? 'studio-spotify' : m.ytmd.connected ? 'ytmd' : null,
    obsKaynak: wsHub.obsKaynakSayisi(),
    katmanlar: wsHub.katmanDurumu(),
    ai: { saglayici: saglayici || 'gemini', hazir: aiHazir }
  });
});

export default router;
