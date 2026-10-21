/**
 * StreamAxT Core Server & Multi-Platform Bot Engine
 * Developed by AxthrowA
 * (c) 2026 AxthrowA. All rights reserved.
 */

// Günlük: zaman damgası + seviye + sır maskeleme (B5) — İLK içe aktarma kalmalı
import './core/logger-init.js';
import { seyrekUyar } from './core/logger.js';
import { ZATEN_CALISIYOR_KODU } from './core/gozcu-karar.js';
import { hizliDnsKur } from './core/dns-hizli.js';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import apiRoutes from './api/routes.js';
import { spotifyDonusu } from './api/rotalar/muzik.js';
import { wsHub } from './ws/server.js';
import { platformManager } from './platforms/manager.js';
import { messagePipeline } from './core/pipeline.js';
import { commandManager } from './modules/commands/command-manager.js';
import { timerManager } from './modules/timers/timers.js';
import { setStreamStartTime } from './core/variable-parser.js';
import { extras } from './modules/extras/extras.js';
import { economy } from './modules/economy/economy.js';
import { subathon } from './modules/subathon/subathon.js';
import { hypeTreni } from './modules/hype/hype-train.js';
import { seviyeler } from './modules/levels/levels.js';
import { sohbetUyarilari } from './modules/chat-alerts/chat-alerts.js';
import { discordDuyuru } from './modules/integrations/discord-announce.js';
import { canliYoklayici } from './modules/stream/live-poller.js';
import { yayinDegistiriciAyarla } from './core/variables/registry.js';
import { puanDususu } from './modules/engagement/point-drops.js';
import { eventBus } from './core/event-bus.js';
import { yerelKokenMi, yazmaYontemiMi, baglanmaAdresi, baglanmaUyarisi } from './core/security/local-guard.js';
import { izinliHostMu, kokenKabulEdilir } from './core/security/origin-guard.js';
import { arayuzAdresleri, ekIzinliHostlar } from './core/security/host-list.js';
import { HizSiniri, kuralBul } from './core/security/rate-limit.js';
import { sirlariHazirla } from './core/security/vault-migrate.js';
import { sunucuPortu } from './core/security/oauth-state.js';

dotenv.config();
// Dış istekler (Kick, 7TV, hava durumu…) IPv4 öncelikli çözülsün — bkz. core/dns-hizli.ts
hizliDnsKur();

// S6: şifreli sırları toplu çöz (tek PowerShell çağrısı), düz kalanları şifrele.
// Platformlar bağlanmadan ÖNCE çalışır.
try {
  sirlariHazirla();
} catch (e) {
  console.warn('[Kasa] Hazırlık başarısız, sırlar olduğu gibi kullanılacak:', e);
}

const app = express();
const server = http.createServer(app);

// DNS yeniden bağlama (rebinding) koruması: Host başlığı izin listesinde
// değilse HİÇBİR şey sunulmaz. Saldırgan kendi alan adını 127.0.0.1'e
// çözdürse bile Host'u kendi alan adı olur ve burada reddedilir.
app.use((req, res, next) => {
  if (izinliHostMu(req.headers.host, arayuzAdresleri(), ekIzinliHostlar())) return next();
  console.warn(`[Guvenlik] Izin listesinde olmayan Host reddedildi: ${req.headers.host}`);
  res.status(403).json({ success: false, error: 'Geçersiz Host başlığı.' });
});

// CORS & Middleware
//
// Eskiden `cors({ origin: '*' })` vardi: kullanicinin ziyaret ettigi HERHANGI
// bir web sayfasi fetch('http://localhost:3001/api/platforms') ile Kick OAuth
// tokenini okuyabiliyordu. Artik yalniz yerel kokenler yanit okuyabilir.
app.use(
  cors({
    origin(origin, cb) {
      cb(null, yerelKokenMi(origin));
    },
    credentials: false
  })
);
// Medya yuklemesi base64 ile geldigi icin govde siniri buyutuldu
// (5 MB dosya base64'te ~6.7 MB olur).
// Medya gömülü uyarı yedeği 12 MB'ı aşabilir: YALNIZ o uç için büyük sınır.
// Genel sınır küçük kalır — her uca 150 MB gövde açmak gereksiz risk.
const buyukGovde = express.json({ limit: '150mb' });
const normalGovde = express.json({ limit: '12mb' });
// Medya yüklemesi: 30 MB video base64'te ~40 MB
const medyaGovde = express.json({ limit: '45mb' });
app.use((req, res, next) =>
  req.path === '/api/alerts/backup/import'
    ? buyukGovde(req, res, next)
    : req.path === '/api/media' && req.method === 'POST'
      ? medyaGovde(req, res, next)
      : normalGovde(req, res, next)
);
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// CSRF korumasi: basit istekler on kontrole tabi olmadigi icin CORS yaniti
// gizlese bile istek sunucuda CALISIR. Yan etkisi olan yontemlerde kokeni
// ayrica dogrula — yabanci bir sayfa bot adina mesaj gonderemesin.
app.use('/api', (req, res, next) => {
  // Yazma istekleri: yerel köken VEYA sunucunun kendi kökeni (LAN kipinde
  // başka bilgisayardaki OBS sayfası). Host yukarıda doğrulandığı için
  // "aynı köken" DNS rebinding ile taklit edilemez.
  if (!yazmaYontemiMi(req.method) || kokenKabulEdilir(req.headers.origin, req.headers.host)) return next();
  console.warn(`[Guvenlik] Yabanci kokenden yazma istegi reddedildi: ${req.headers.origin} ${req.method} ${req.originalUrl}`);
  res.status(403).json({
    success: false,
    error: 'Bu istek yalniz StreamAxT panelinden yapilabilir.'
  });
});

// Hız sınırı (S7): kaçak bir döngü ya da bozuk eklenti sunucuyu/diski
// kilitlemesin; pahalı uçlar (medya, AI, Discord testi) ayrıca sınırlı.
const hizSiniri = new HizSiniri();
setInterval(() => hizSiniri.temizle(), 60_000).unref();
app.use('/api', (req, res, next) => {
  const kural = kuralBul(req.method, req.path);
  if (!kural) return next();
  const r = hizSiniri.izinVer(`${req.ip}|${kural.ad}`, kural);
  if (r.ok) return next();
  const sn = Math.ceil(r.bekleMs / 1000);
  res.setHeader('Retry-After', String(sn));
  res.status(429).json({ success: false, error: `Çok fazla istek (${kural.ad}) — ${sn} sn sonra tekrar deneyin.` });
});

// API Routes
app.use('/api', apiRoutes);

// API 404 Handler - Always return JSON, never HTML
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API uç noktası bulunamadı: ${req.method} ${req.originalUrl}. Lütfen StreamAxT'yi yeniden başlatın.`
  });
});

// Hata işleyicisi. Express'in varsayılanı HTML yığın izi döndürüyordu:
// panel JSON bekleyip çöküyor, yanıt da diskteki dosya yollarını
// (C:\Users\...\routes.js) açık ediyordu. Artık JSON, yığın izi yalnız
// sunucu günlüğünde.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  // Bozuk JSON gövdesi (body-parser) kullanıcı hatasıdır
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'İstek gövdesi geçerli JSON değil.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'İstek çok büyük.' });
  }
  console.error(`[API] ${req.method} ${req.originalUrl} hata:`, err?.stack || err);
  res.status(Number(err?.status) || 500).json({
    success: false,
    error: 'Sunucu hatası — ayrıntı StreamAxT günlüğünde.'
  });
});

// Health check
app.get('/health', (req, res) => {
  // `uygulama` imzası: ikinci kopya portu dolu bulunca karşıdakinin StreamAxT olup olmadığını anlar
  // `gozcuPid`: dışarıdan durduran (Yayın Yönetim Aracı) yalnız portu dinleyen uygulamayı
  // öldürürse gözcü çökme sanıp yeniden başlatır — ağacı gözcüden kapatabilsin diye.
  res.json({
    status: 'ok',
    uygulama: 'streamaxt',
    gozcuPid: process.env.STREAMAXT_COCUK === '1' ? process.ppid : null,
    time: new Date().toISOString()
  });
});

// Setup WebSockets
wsHub.init(server);

// Resonance (müzik çalar + OBS "şu an çalan") — /resonance/ altında.
// Paket: <kök>/resonance ; geliştirme: ../resonance/dist
const resonanceDist = [
  path.resolve(process.cwd(), 'resonance'),
  path.resolve(process.cwd(), 'resonance/dist'),
  path.resolve(process.cwd(), '../resonance/dist')
].find((p) => fs.existsSync(path.join(p, 'index.html')));
// Spotify dönüşü: Dashboard'a hangisi kayıtlıysa (kod yoksa uygulamaya düşer)
app.get(['/callback', '/resonance/callback'], (req, res, next) => {
  if (req.query.code || req.query.error) return void spotifyDonusu(req, res);
  next();
});
if (resonanceDist) {
  app.use('/resonance', express.static(resonanceDist, { index: false, maxAge: '1h' }));
  app.get(['/resonance', '/resonance/*'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(resonanceDist, 'index.html'));
  });
}

// Serve static frontend in production/portable mode
const clientDistCandidates = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'dist-client'),
  path.resolve(process.cwd(), 'public')
];

const clientDist = clientDistCandidates.find(p => fs.existsSync(p));
if (clientDist) {
  app.use(express.static(clientDist, {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, filePath) => {
      if (/\.html?$/i.test(filePath)) {
        // index.html paket adlarını (hash) taşır. Eskiden 1 gün önbellekte
        // kalıyordu: güncellemeden sonra eski kopya SİLİNMİŞ paketleri istiyor,
        // panel/OBS sayfası boş açılıyordu. Her açılışta yeniden doğrulanır
        // (değişmediyse ETag ile 304 — maliyeti yok).
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes('assets')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = sunucuPortu();

// Varsayilan olarak YALNIZ bu makine. Eskiden host verilmedigi icin Node tum
// ag arayuzlerini dinliyordu; ayni agdaki her cihaz botu yonetebiliyordu.
const HOST = baglanmaAdresi();

/**
 * Port doluysa: karşıda zaten bir StreamAxT çalışıyorsa bu kopya temizce
 * kapanır (kod 2 — gözcü yeniden başlatmaz). Değilse port bir önceki
 * kopyanın kapanmasından kalmış olabilir: 5 kez 2 sn arayla yeniden denenir.
 * Eskiden süreç işlenmeyen 'error' olayıyla çöküyordu.
 */
let portDenemesi = 0;
async function portDoluysa(): Promise<void> {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(3000) });
    const j: any = await r.json().catch(() => null);
    if (j?.uygulama === 'streamaxt' || j?.status === 'ok') {
      console.error(`[StreamAxT] ${PORT} portunda zaten bir StreamAxT çalışıyor; bu kopya kapatılıyor.`);
      process.exit(ZATEN_CALISIYOR_KODU);
    }
  } catch {
    /* karşıda yanıt veren StreamAxT yok */
  }
  if (++portDenemesi <= 5) {
    console.warn(`[StreamAxT] ${PORT} portu meşgul, 2 sn sonra yeniden denenecek (${portDenemesi}/5)…`);
    setTimeout(() => server.listen(PORT, HOST), 2000);
    return;
  }
  console.error(`\n[UYARI] ${PORT} numaralı port başka bir uygulama tarafından kullanılıyor; StreamAxT başlatılamadı.\n`);
  process.exit(1);
}

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') void portDoluysa();
  else console.error('[Sunucu Hatasi]:', err);
});

// Botu tek bir yakalanmamış hata ya da reddedilen söz yüzünden KAPATMA:
// günlüğe yaz ve devam et (gözcü yine de çökmeye karşı yeniden başlatır).
process.on('unhandledRejection', (sebep: any) => {
  seyrekUyar(`surec:red:${String(sebep?.message || sebep).slice(0, 60)}`, '[StreamAxT] Yakalanmamış söz reddi', sebep, 60_000);
});
process.on('uncaughtException', (hata: any) => {
  if (hata?.code === 'EADDRINUSE') return; // yukarıda işleniyor
  console.error('[StreamAxT] Yakalanmamış hata (bot çalışmaya devam ediyor):', hata?.stack || hata);
});

let dinlemeBasladi = false;
server.listen(PORT, HOST, async () => {
  if (dinlemeBasladi) return;
  dinlemeBasladi = true;
  setStreamStartTime(Date.now());
  const uyari = baglanmaUyarisi(HOST);
  console.log(`\n======================================================`);
  console.log(`🚀 StreamAxT Core Bot Engine - Developed by AxthrowA`);
  console.log(`🔗 Web Dashboard: http://localhost:${PORT}`);
  console.log(`📡 WebSocket Hub: ws://localhost:${PORT}/ws`);
  console.log(`🔒 Baglanti adresi: ${HOST}`);
  if (uyari) console.warn(uyari);
  console.log(`======================================================\n`);

  // Initialize Message Processing Pipeline & Commands
  messagePipeline.init();
  commandManager.reload();
  extras.initExtras();

  // Start Announcement Timers
  timerManager.startAll();

  // İzleme süresi / düzenli puan tiki (Rankings > Watchtime bunu kullanır).
  economy.startWatchTimeLoop(5);

  // Subathon sayacı sunucuda tutulur; olaylar (abone / hediye abone / bağış /
  // KICKs) otomatik olarak süreye eklenir.
  subathon.yayinciBagla((tip, veri) => wsHub.broadcastTo(['all'], { type: tip, data: veri }));
  subathon.baslangic();

  // Hype Treni de sunucuda (B3): tüm OBS kaynakları aynı treni görür.
  hypeTreni.baglaOlaylar();

  // Sohbet tarafi olay mesajlari (BotRix'te 'Metin uyarilari'). Gorsel
  // overlay'den bagimsiz: olay olunca sohbete metin yazar.
  sohbetUyarilari.baglaOlaylar();

  // Yayin acilinca Discord duyurusu. Onceden bu dinleyici HIC baglanmamisti.
  discordDuyuru.baglaOlaylar();

  // Yayin durumu: Kick/Twitch/YouTube dakikada bir yoklanir; TikTok/Trovo
  // kendi olaylariyla bildirir. !uptime, erisim kipli komutlar ve Discord
  // duyurusu buradan beslenir. Panel `stream_status` ile canli gosterir.
  eventBus.on('stream_status', (ozet: any) => wsHub.broadcastTo(['all'], { type: 'stream_status', data: ozet }));
  canliYoklayici.baslat();

  // $(settitle) / $(setcategory): değişken motoru adaptörleri bilmez, burada bağlanır
  yayinDegistiriciAyarla(async (tur, deger, platform) => {
    const p = platformManager.getPlatform(platform);
    if (tur === 'baslik') {
      if (!p?.baslikDegistir) return { ok: false, hata: `${platform} başlık değiştirmeyi desteklemiyor` };
      return p.baslikDegistir(deger);
    }
    if (!p?.kategoriDegistir) return { ok: false, hata: `${platform} kategori değiştirmeyi desteklemiyor` };
    return p.kategoriDegistir(deger);
  });

  // Puan dususu bitince sonucu sohbete duyur.
  puanDususu.bitisiDinle(({ katilan, kisiBasi }) => {
    if (!katilan) {
      eventBus.emitBotMessage({ platform: 'all', message: '🎁 Puan düşüşü bitti, kimse katılmadı.' });
      return;
    }
    eventBus.emitBotMessage({
      platform: 'all',
      message: `🎁 Puan düşüşü bitti! ${katilan} kişi ${kisiBasi} puan kazandı.`
    });
  });

  // Destek olaylari da XP verir (BotRix'te seviye sistemi abonelik ve
  // bagisla da besleniyor).
  eventBus.on('sub', (p: any) => {
    const a = seviyeler.ayarOku();
    if (!a.aktif || (p as any)?.isTest === true) return; // test uyarısı sahte kullanıcıya XP vermesin
    seviyeler.xpEkle(p?.username, p?.isGift ? a.hediyeAboneXp : a.aboneXp);
  });
  eventBus.on('tip', (p: any) => {
    const a = seviyeler.ayarOku();
    if (!a.aktif || a.bagisXp <= 0 || (p as any)?.isTest === true) return;
    const adet = Math.floor(Math.max(0, Number(p?.amount) || 0) / Math.max(1, a.bagisBirimi));
    if (adet > 0) seviyeler.xpEkle(p?.username, adet * a.bagisXp);
  });

  // Connect active streaming platforms
  try {
    await platformManager.connectAll();
  } catch (err) {
    console.error('Error connecting platforms:', err);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down StreamAxT gracefully...');
  timerManager.stopAll();
  process.exit(0);
});
