/**
 * StreamAxT Core Server & Multi-Platform Bot Engine
 * Developed by AxthrowA
 * (c) 2026 AxthrowA. All rights reserved.
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import apiRoutes from './api/routes.js';
import { wsHub } from './ws/server.js';
import { platformManager } from './platforms/manager.js';
import { messagePipeline } from './core/pipeline.js';
import { commandManager } from './modules/commands/command-manager.js';
import { timerManager } from './modules/timers/timers.js';
import { setStreamStartTime } from './core/variable-parser.js';
import { extras } from './modules/extras/extras.js';
import { economy } from './modules/economy/economy.js';
import { subathon } from './modules/subathon/subathon.js';
import { seviyeler } from './modules/levels/levels.js';
import { sohbetUyarilari } from './modules/chat-alerts/chat-alerts.js';
import { eventBus } from './core/event-bus.js';
import { yerelKokenMi, istekKabulEdilir, baglanmaAdresi, baglanmaUyarisi } from './core/security/local-guard.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

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
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// CSRF korumasi: basit istekler on kontrole tabi olmadigi icin CORS yaniti
// gizlese bile istek sunucuda CALISIR. Yan etkisi olan yontemlerde kokeni
// ayrica dogrula — yabanci bir sayfa bot adina mesaj gonderemesin.
app.use('/api', (req, res, next) => {
  if (istekKabulEdilir(req.method, req.headers.origin)) return next();
  console.warn(`[Guvenlik] Yabanci kokenden yazma istegi reddedildi: ${req.headers.origin} ${req.method} ${req.originalUrl}`);
  res.status(403).json({
    success: false,
    error: 'Bu istek yalniz StreamAxT panelinden yapilabilir.'
  });
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Setup WebSockets
wsHub.init(server);

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
      if (filePath.includes('assets')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[UYARI] 3001 numarali port su anda mesgul!`);
    console.error(`Onceki StreamAxT penceresi veya bir baska uygulama 3001 portunu kullaniyor.\n`);
    process.exit(1);
  } else {
    console.error('[Sunucu Hatasi]:', err);
  }
});

// Varsayilan olarak YALNIZ bu makine. Eskiden host verilmedigi icin Node tum
// ag arayuzlerini dinliyordu; ayni agdaki her cihaz botu yonetebiliyordu.
const HOST = baglanmaAdresi();

server.listen(PORT, HOST, async () => {
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

  // Sohbet tarafi olay mesajlari (BotRix'te 'Metin uyarilari'). Gorsel
  // overlay'den bagimsiz: olay olunca sohbete metin yazar.
  sohbetUyarilari.baglaOlaylar();

  // Destek olaylari da XP verir (BotRix'te seviye sistemi abonelik ve
  // bagisla da besleniyor).
  eventBus.on('sub', (p: any) => {
    const a = seviyeler.ayarOku();
    if (!a.aktif) return;
    seviyeler.xpEkle(p?.username, p?.isGift ? a.hediyeAboneXp : a.aboneXp);
  });
  eventBus.on('tip', (p: any) => {
    const a = seviyeler.ayarOku();
    if (!a.aktif || a.bagisXp <= 0) return;
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
