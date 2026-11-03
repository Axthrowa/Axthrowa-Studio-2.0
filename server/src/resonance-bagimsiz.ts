/**
 * Resonance — bağımsız (AxBoT ve AxthrowA Studio olmadan) çalışan müzik çalar
 * Developed by AxthrowA
 *
 * `node dist/resonance-bagimsiz.js` → http://127.0.0.1:8850/resonance/
 *  • Spotify (PKCE) ve YouTube Music Desktop bağlantısı, ortak "şu an çalan"
 *  • OBS overlay'i: http://127.0.0.1:8850/resonance/overlay
 * Ayarlar `veri/resonance.json` dosyasında; Spotify/YTMD jetonları Windows
 * DPAPI ile şifreli. Yalnız bu bilgisayardan (127.0.0.1) erişilir.
 * Port: RESONANCE_PORT (varsayılan 8850 — AxthrowA Studio 8843'ü kullanır).
 */
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { hizliDnsKur } from './core/dns-hizli.js';
import { coz, sifrele } from './core/security/vault.js';
import { MuzikHost } from './modules/muzik/muzik.js';
import { muzikRotalari } from './modules/muzik/rotalar.js';

hizliDnsKur();

const PORT = Math.min(65535, Math.max(1024, Number(process.env.RESONANCE_PORT) || 8850));
const KOKLER = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const HOSTLAR = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

// ─── Depo: veri/resonance.json (atomik yazım; sırlar DPAPI ile şifreli) ────────
const VERI = path.resolve(process.cwd(), 'veri');
const DOSYA = path.join(VERI, 'resonance.json');
interface Kayit {
  ayarlar: Record<string, string>;
  overlay: Record<string, unknown>;
}
let kayit: Kayit = { ayarlar: {}, overlay: {} };
try {
  const j = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
  kayit = { ayarlar: j?.ayarlar && typeof j.ayarlar === 'object' ? j.ayarlar : {}, overlay: j?.overlay && typeof j.overlay === 'object' ? j.overlay : {} };
} catch {
  /* ilk açılış */
}
function kaydet() {
  fs.mkdirSync(VERI, { recursive: true });
  const gecici = `${DOSYA}.${process.pid}.tmp`;
  fs.writeFileSync(gecici, JSON.stringify(kayit, null, 2));
  fs.renameSync(gecici, DOSYA);
}

const host = new MuzikHost(
  {
    oku: (k) => String(coz(kayit.ayarlar[k] ?? '') ?? ''),
    yaz: (k, v, gizli) => {
      kayit.ayarlar[k] = gizli && v ? String(sifrele(v) ?? v) : v;
      kaydet();
    }
  },
  (m) => senkronYayinla(m)
);

// ─── HTTP ───────────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
// DNS yeniden bağlama koruması: yalnız 127.0.0.1/localhost Host başlığı
app.use((req, res, next) => {
  if (HOSTLAR.has(String(req.headers.host || ''))) return next();
  res.status(403).type('text/plain').send('Geçersiz Host başlığı');
});
// Yabancı sitenin bu sunucuya yazma isteği (CSRF) reddedilir
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const koken = req.headers.origin;
  if (!koken || KOKLER.has(String(koken))) return next();
  res.status(403).type('text/plain').send('Bu istek yalnız Resonance sayfasından yapılabilir');
});
app.use('/api', express.json({ limit: '1mb' }));

const { router, spotifyDonusu } = muzikRotalari({
  host,
  ayarlarOku: () => ({ ...kayit.overlay }),
  ayarlarYaz: (tum) => {
    kayit.overlay = tum;
    kaydet();
  },
  senkronYayinla: (m) => senkronYayinla(m)
});
app.use('/api', router);

app.get(['/callback', '/resonance/callback'], (req, res, next) => {
  if (req.query.code || req.query.error) return void spotifyDonusu(req, res);
  next();
});

const dist = [path.resolve(process.cwd(), 'resonance'), path.resolve(__dirname, '..', 'resonance'), path.resolve(__dirname, '..', '..', 'resonance', 'dist')].find((p) =>
  fs.existsSync(path.join(p, 'index.html'))
);
if (dist) {
  app.use('/resonance', express.static(dist, { index: false, maxAge: '1h' }));
  app.get(['/resonance', '/resonance/*'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}
app.get('/', (_req, res) => res.redirect('/resonance/'));

// ─── WebSocket: /ws/overlay-sync ───────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  verifyClient: (info: { origin?: string; req: http.IncomingMessage }) =>
    HOSTLAR.has(String(info.req.headers.host || '')) && (!info.origin || KOKLER.has(info.origin))
});
wss.on('error', () => {});
server.on('upgrade', (req, socket, head) => {
  if (String(req.url || '').split('?')[0] !== '/ws/overlay-sync') return void socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
function senkronYayinla(m: unknown) {
  const ham = JSON.stringify(m);
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(ham);
}

process.on('unhandledRejection', (e) => console.error('[Resonance] Yakalanmamış söz reddi:', e));
process.on('uncaughtException', (e) => console.error('[Resonance] Yakalanmamış hata (çalışmaya devam):', e));

server.on('error', (e: any) => {
  if (e?.code === 'EADDRINUSE') {
    console.error(`[Resonance] ${PORT} portu kullanımda — Resonance zaten açık olabilir. Başka port için RESONANCE_PORT ayarla.`);
    process.exit(2);
  }
  console.error('[Resonance] Sunucu hatası:', e);
});

server.listen(PORT, '127.0.0.1', () => {
  host.yoklamayiBaslat();
  console.log('======================================================');
  console.log(`🎵 Resonance çalışıyor: http://127.0.0.1:${PORT}/resonance/`);
  console.log(`📺 OBS overlay:         http://127.0.0.1:${PORT}/resonance/overlay`);
  console.log(`🔑 Spotify Redirect URI: http://127.0.0.1:${PORT}/api/player/spotify/callback`);
  if (!dist) console.log('⚠️  Arayüz dosyaları bulunamadı (resonance klasörü eksik).');
  console.log('Pencereyi kapatınca Resonance da kapanır.');
  console.log('======================================================');
});
