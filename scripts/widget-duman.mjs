// WID-7 widget duman testi ve kare bütçesi: botun her OBS widget sayfası başsız Chrome'da önizleme kipinde
// (?preview=1) açılır, varsa test olayı yollanır, sonra:
//   • hata: yakalanmamış istisna ya da sayfa boş kalırsa kırmızı
//   • kare: vsync kapalı Chrome'da ardışık kareler arası süre (kare işi) ölçülür; p95 > 16,7 ms kırmızı
//   • görüntü: tests/widget-gorsel/<ad>.png ile karşılaştırılır (hareketler durdurulup)
// Kendi botunu (geçici veri klasörü, ayrı port) ve Vite'ını açar; gerçek bota ve kullanıcı verisine dokunmaz.
//   node scripts/widget-duman.mjs             karşılaştır (kırmızı varsa çıkış kodu 1, çıktı test-results/widget/)
//   node scripts/widget-duman.mjs --guncelle  bilinçli görünüm değişikliğinden sonra referansları yeniden yazar
//   node scripts/widget-duman.mjs chatbox     yalnız adı geçen widget'lar
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bot = path.join(kok, 'axbot');
const { PNG } = createRequire(import.meta.url)('pngjs');
const guncelle = process.argv.includes('--guncelle');
const secilen = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const REF = path.join(kok, 'tests/widget-gorsel');
const CIKTI = path.join(kok, 'test-results/widget');
const KANAL_PAYI = 40;
const ESIK = Number(process.env.WIDGET_GORSEL_ESIK || 0.02);
const KARE_BUTCESI = Number(process.env.KARE_BUTCESI_MS || 16.7);
const API = 18961, UI = 15291;
const GENISLIK = 1280, YUKSEKLIK = 720;

// [sayfa, test olayı (POST /api/widgets/test/<ad>), görüntü eşiği]. Eşik null: içerik zamanla/rastgele
// yer değiştiriyor (uçan emote, parçacık, sunucunun rastgele seçtiği test adı/görseli, dönen çark);
// yalnız hata ve kare bütçesi denetlenir.
const WIDGETLAR = [
  ['alertbox', 'alert-box', null],
  ['chatbox', 'chat-overlay'],
  ['donation-goal', 'donation-goal'],
  ['follower-goal', 'follower-goal'],
  ['subscriber-goal', 'subscriber-goal'],
  ['kicks-goal', 'kicks-goal'],
  ['giveaways', 'giveaways'],
  ['rankings', null],
  ['wheel', 'wheel', null],
  ['audio-player', null],
  ['emote-combo', 'emote-combo', null],
  ['subathon', 'subathon'],
  ['hype-train', 'hype-train'],
  ['event-labels', 'event-labels'],
  ['resonance', null],
  ['polls', 'polls'],
  ['shoutout', 'shoutout'],
  ['atla', null, null],
  ['atla-oyunu', null, null],
  ['the-cup', 'the-cup'],
  ['word-cloud', null],
  ['scoreboard', 'scoreboard'],
  ['credits', 'credits'],
  ['pinned', 'pinned-messages'],
  ['socials', null],
  ['sponsor', null],
  ['loyalty-redeem', 'loyalty-redemptions'],
  ['lyrics', null],
  ['muzik-video', 'muzik-video', null],
  ['jumpscare', 'jumpscare', null],
  ['king', 'king'],
  ['pano', null],
  ['viewer-counter', 'viewer-counter'],
  ['activity-feed', 'activity-feed'],
  ['kappagen', 'on-screen-emotes', null],
  ['trivia', null],
  ['overlay', null, null],
  // Yeni sayfalar: görünümleri oturunca referans resmi eklenir (--guncelle)
  ['sayac', null, null],
  ['izleyici-sirasi', null, null],
  ['geri-sayim', null, null]
];
// Sınanmayan sayfalar: özel widget kimlik ister (kendi birim testleri var); diğerleri listedekilerin eş adresi
const ATLANAN = new Set(['ozel', 'goals', 'now-playing', 'emotes', 'on-screen-emotes']);

// Yeni widget sayfası listeye girmeden test yeşil kalmasın
const app = readFileSync(path.join(bot, 'client/src/App.tsx'), 'utf8');
const sayfalar = new Set([...app.matchAll(/'\/widgets\/([a-z0-9-]+)'/g)].map((m) => m[1]));
const bilinen = new Set(WIDGETLAR.map((w) => w[0]));
const eksik = [...sayfalar].filter((s) => !bilinen.has(s) && !ATLANAN.has(s));
const liste = WIDGETLAR.filter(([ad]) => sayfalar.has(ad) && (!secilen.length || secilen.includes(ad)));

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const surecler = [];
const kapat = () => { for (const p of surecler) try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(p.pid), '/t', '/f']) : p.kill(); } catch {} };
process.on('exit', kapat);

async function hazirBekle(url, sn) {
  for (let i = 0; i < sn * 2; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch {}
    await bekle(500);
  }
  throw new Error(`${url} ${sn} sn içinde açılmadı`);
}

// 1) Geçici veri klasöründe bot sunucusu, ona yönlenen Vite
const veri = mkdtempSync(path.join(tmpdir(), 'widget-duman-'));
surecler.push(spawn(process.execPath, [path.join(bot, 'node_modules/tsx/dist/cli.mjs'), path.join(bot, 'server/src/index.ts')], {
  cwd: veri, stdio: 'ignore', env: { ...process.env, PORT: String(API), NODE_ENV: 'development' }
}));
const { createServer } = await import(pathToFileURL(path.join(bot, 'node_modules/vite/dist/node/index.js')).href);
const vite = await createServer({
  configFile: path.join(bot, 'client/vite.config.ts'),
  root: path.join(bot, 'client'),
  logLevel: 'error',
  server: {
    port: UI, strictPort: true,
    proxy: { '/api': { target: `http://localhost:${API}`, changeOrigin: true }, '/health': `http://localhost:${API}`, '/ws': { target: `ws://localhost:${API}`, ws: true } }
  }
});
await vite.listen();
await hazirBekle(`http://localhost:${API}/health`, 120);
console.log('sunucular hazır');

// 2) Chrome: vsync ve kare sınırı kapalı, böylece kareler arası süre kare işinin kendisidir
const port = 9600 + Math.floor(Math.random() * 150);
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'widget-chrome-'))}`,
  '--no-first-run', '--remote-allow-origins=*', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=no-user-gesture-required', 'about:blank'
], { stdio: 'ignore' });
surecler.push(chrome);
let hedef;
for (let i = 0; i < 50 && !hedef; i++) {
  await bekle(200);
  try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!hedef) throw new Error('Chrome açılmadı');
const ws = new WebSocket(hedef.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let sira = 0; const bekleyen = new Map();
let istisnalar = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    istisnalar.push(String(d.exception?.description || d.text).split('\n')[0].slice(0, 200));
  }
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++sira; bekleyen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (ifade) => (await cdp('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true })).result?.result?.value;

await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: GENISLIK, height: YUKSEKLIK, deviceScaleFactor: 1, mobile: false });
// Sabit saat ve tohumlu rastgele: önizleme verisi her çalıştırmada aynı
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const B = Date.UTC(2026, 0, 15, 21, 0, 0), t0 = performance.now(), D = Date;
  class S extends D { constructor(...a) { a.length ? super(...a) : super(B + performance.now() - t0); } static now() { return B + performance.now() - t0; } }
  window.Date = S;
  let t = 20260115; Math.random = () => ((t = (t * 1664525 + 1013904223) >>> 0) / 4294967296);
})()` });
// Görüntü öncesi: CSS ve Web Animations durdurulur (sonlu olan bitirilir, sonsuz olan başta tutulur)
const DONDUR = `(() => { const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}video,iframe{visibility:hidden!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { const t = a.effect?.getComputedTiming?.(); if (t && Number.isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; } } catch {} }
  return true; })()`;
// Kare işi: kare başı (rAF) → o karenin çizimi bitince ilk görev (MessageChannel). rAF zincirinin en sonuna
// eklenen ölçüm, widget'ın kendi rAF işlerini, stil, yerleşim ve boyamayı kapsar. Başsız Chrome kareyi
// 30 fps'e sabitlediği için kareler arası süre kullanılamaz.
const KARE_OLC = `new Promise((tamam) => { const z = []; const bas = performance.now(); const kanal = new MessageChannel(); let t0 = 0;
  kanal.port1.onmessage = () => { z.push(performance.now() - t0); if (performance.now() - bas < 3000) requestAnimationFrame(f); else {
    z.sort((a, b) => a - b); tamam({ p95: z.length ? z[Math.floor(z.length * 0.95)] : 0, kare: z.length, dom: document.getElementsByTagName('*').length }); } };
  // rAF zaman damgası karenin başıdır: widget'ın bizden önce çalışan rAF işleri de ölçüme girer
  const f = (t) => { t0 = t; kanal.port2.postMessage(0); };
  requestAnimationFrame(f); })`;

mkdirSync(CIKTI, { recursive: true });
mkdirSync(REF, { recursive: true });
const sonuc = [];
for (const [ad, test, esik = ESIK] of liste) {
  istisnalar = [];
  await cdp('Page.navigate', { url: `http://localhost:${UI}/widgets/${ad}?preview=1` });
  // Soğuk Vite ilk sayfada modülleri derler: sabit süre yerine içerik gelene kadar (en çok 15 sn) bekle
  let bos = true;
  for (let i = 0; i < 30 && bos; i++) {
    await bekle(500);
    bos = await js(`document.querySelectorAll('#root *').length === 0`);
  }
  await bekle(1000);
  if (test) await js(`fetch('/api/widgets/test/${test}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(() => true)`);
  await bekle(test ? 800 : 200);
  const kare = await js(KARE_OLC);
  await js(DONDUR);
  await js(`document.fonts.ready.then(() => true)`);
  await bekle(300);
  const png = Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  const s = { ad, p95: kare?.p95 ?? 0, dom: kare?.dom ?? 0, hatalar: [...new Set(istisnalar)] };
  if (bos) s.hatalar.push('sayfa boş kaldı');
  if (s.p95 > KARE_BUTCESI) s.hatalar.push(`p95 kare ${s.p95.toFixed(1)} ms > ${KARE_BUTCESI} ms`);
  const ref = path.join(REF, `${ad}.png`);
  if (esik !== null) {
    if (guncelle || !existsSync(ref)) { writeFileSync(ref, png); s.yeni = true; }
    else {
      const a = PNG.sync.read(readFileSync(ref)), b = PNG.sync.read(png);
      let farkli = 0;
      const fark = new PNG({ width: b.width, height: b.height });
      if (a.width === b.width && a.height === b.height) {
        for (let i = 0; i < a.data.length; i += 4) {
          const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]), Math.abs(a.data[i + 3] - b.data[i + 3]));
          const ayri = d > KANAL_PAYI;
          if (ayri) farkli++;
          const gri = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 12;
          fark.data.set(ayri ? [255, 0, 0, 255] : [gri, gri, gri, 255], i);
        }
        s.oran = farkli / (a.width * a.height);
      } else s.oran = 1;
      if (s.oran > esik) {
        s.hatalar.push(`görüntü %${(s.oran * 100).toFixed(2)} farklı (eşik %${esik * 100})`);
        writeFileSync(path.join(CIKTI, `${ad}.png`), png);
        writeFileSync(path.join(CIKTI, `${ad}-fark.png`), PNG.sync.write(fark));
      }
    }
  }
  console.log(`${s.hatalar.length ? '✗' : '✓'} ${ad.padEnd(16)} p95 ${s.p95.toFixed(1).padStart(5)} ms · DOM ${String(s.dom).padStart(5)}${s.oran !== undefined ? ` · görüntü %${(s.oran * 100).toFixed(2)}` : s.yeni ? ' · referans yazıldı' : ''}${s.hatalar.length ? ' — ' + s.hatalar.join('; ') : ''}`);
  sonuc.push(s);
}
await cdp('Browser.close').catch(() => {});
await vite.close();

const kirmizi = sonuc.filter((s) => s.hatalar.length).length + (eksik.length ? 1 : 0);
if (eksik.length) console.log(`✗ listede olmayan widget sayfası: ${eksik.join(', ')} (scripts/widget-duman.mjs WIDGETLAR'a ekleyin)`);
const p95ler = sonuc.map((s) => s.p95).sort((a, b) => a - b);
writeFileSync(path.join(CIKTI, 'sonuc.json'), JSON.stringify({ kareButcesi: KARE_BUTCESI, sonuc }, null, 2));
console.log(`${sonuc.length} widget; en yüksek p95 ${(p95ler.at(-1) ?? 0).toFixed(1)} ms. ${kirmizi ? `${kirmizi} kırmızı` : 'Hepsi yeşil'}`);
kapat();
process.exit(kirmizi ? 1 : 0);
