// UI-11 görsel gerileme: Studio'nun 12 ekranını başsız Chrome'da çeker, tests/gorsel/*.png ile karşılaştırır.
// Kendi başsız sunucusunu (temiz geçici veri kökü) ve Vite'ını ayrı portlarda açar; gerçek kullanıcı verisine dokunmaz.
//   node scripts/gorsel-gerileme.mjs             karşılaştır (eşik aşılırsa çıkış kodu 1, fark resimleri test-results/gorsel/)
//   node scripts/gorsel-gerileme.mjs --guncelle  bilinçli arayüz değişikliğinden sonra referansları yeniden yazar
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { PNG } = createRequire(import.meta.url)('pngjs');
const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guncelle = process.argv.includes('--guncelle');
const REF = path.join(kok, 'tests/gorsel');
const CIKTI = path.join(kok, 'test-results/gorsel');
// Kanal farkı bu kadarın altındaysa kenar yumuşatma sayılır; farklı piksel oranı ESIK'i aşarsa ekran kırmızı
const KANAL_PAYI = 40;
const ESIK = Number(process.env.GORSEL_ESIK || 0.01);
const API = 18943, UI = 1521;
const GENISLIK = 1440, YUKSEKLIK = 900;

// [ad, menü grubu sırası, data-nav-id, (isteğe bağlı) açılacak sekme]. Bot ekranları dışarıda: içerik botun o an
// çalışıp çalışmadığına bağlı.
const EKRANLAR = [
  ['profil', 0, 'profile'],
  ['yayin-bilgisi', 0, 'yayinBilgisi'],
  ['canli-kontrol', 1, 'control'],
  ['yayin-sonrasi', 1, 'control', 'Yayın sonrası'],
  ['sohbet', 1, 'chat'],
  ['baslangic', 2, 'starting'],
  ['yayin', 2, 'yayin'],
  ['muzik', 2, 'music'],
  ['sesler', 2, 'sounds'],
  ['ayarlar', 6, 'settings'],
  ['kisayollar', 6, 'hotkeys'],
  ['cihazlar', 6, 'cihazlar'],
];

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

// 1) Temiz başsız sunucu (medya oturumu okunmaz: o an çalan şarkı ekrana girmesin) ve ona bağlı Vite
const veri = mkdtempSync(path.join(tmpdir(), 'gorsel-'));
surecler.push(spawn(`cargo run --quiet --example headless_server --manifest-path src-tauri/Cargo.toml -- ${API}`, {
  cwd: kok, stdio: 'inherit', shell: true, env: { ...process.env, STUDIO_HEADLESS_KOK: veri, STUDIO_HEADLESS_SMTC: '0' },
}));
// AxBoT portu kullanılmayan bir port: gerçek bot açık olsa da ekrana girmez
surecler.push(spawn(process.execPath, ['scripts/ui-headless.mjs', String(API), String(UI), '39999'], { cwd: kok, stdio: 'ignore' }));
await hazirBekle(`http://127.0.0.1:${API}/api/health`, 900);
await hazirBekle(`http://localhost:${UI}/panel`, 120);
console.log('sunucular hazır');

// 2) Chrome (CDP)
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'gorsel-chrome-'))}`,
  '--no-first-run', '--remote-allow-origins=*', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', 'about:blank',
], { stdio: 'ignore' });
surecler.push(chrome);
let hedef;
for (let i = 0; i < 50 && !hedef; i++) {
  await bekle(200);
  try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!hedef) throw new Error('Chrome açılmadı');
console.log('chrome hazır');
const ws = new WebSocket(hedef.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let sira = 0; const bekleyen = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++sira; bekleyen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (ifade) => (await cdp('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true })).result?.result?.value;

await cdp('Emulation.setDeviceMetricsOverride', { width: GENISLIK, height: YUKSEKLIK, deviceScaleFactor: 1, mobile: false });
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
// Saat sabit bir günden başlar ve gerçek hızda ilerler (saat/tarih yazıları her çalıştırmada aynı)
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const B = Date.UTC(2026, 0, 15, 9, 0, 0), t0 = performance.now(), D = Date;
  class S extends D { constructor(...a) { a.length ? super(...a) : super(B + performance.now() - t0); } static now() { return B + performance.now() - t0; } }
  window.Date = S;
})()` });
const SABITLE = `(() => { const s = document.createElement('style'); s.textContent =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' +
  // Gömülü sayfalar (bot, Resonance) dış sunucuya bağlı: yerleri kalır, içerikleri çekilmez
  'iframe,video{visibility:hidden!important}'; document.head.appendChild(s); document.activeElement?.blur?.(); })()`;

await cdp('Page.navigate', { url: `http://localhost:${UI}/panel` });
await bekle(3000);
// Karşılama ekranı geçilir; ilk açılıştaki "Otomatik kaydedildi" bildirimi kaybolana kadar beklenir
await js(`localStorage.setItem('axthrowa.karsilama.goruldu', '1'); location.reload()`);
await bekle(8000);

mkdirSync(CIKTI, { recursive: true });
mkdirSync(REF, { recursive: true });
const sonuc = [];
for (const [ad, grup, nav, sekme] of EKRANLAR) {
  const ok = await js(`(async () => {
    const g = () => document.querySelectorAll('.studio-nav-rail nav > div')[${grup}];
    const b = () => g()?.querySelector('button[data-nav-id="${nav}"]');
    if (!b()) g()?.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 400));
    if (!b()) return false; b().click();
    const s = ${JSON.stringify(sekme || '')};
    if (!s) return true;
    await new Promise((r) => setTimeout(r, 800));
    const t = [...document.querySelectorAll('[role="tab"], button')].find((e) => !e.closest('.studio-nav-rail') && e.innerText.trim() === s);
    t?.click(); return !!t;
  })()`);
  if (!ok) { sonuc.push({ ad, hata: `${nav}${sekme ? ' › ' + sekme : ''} bulunamadı` }); continue; }
  await bekle(1800);
  await js(SABITLE);
  await js(`document.fonts.ready.then(() => true)`);
  await bekle(400);
  console.log('çekiliyor', ad);
  const png = Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  const ref = path.join(REF, `${ad}.png`);
  if (guncelle || !existsSync(ref)) { writeFileSync(ref, png); sonuc.push({ ad, yeni: true }); continue; }
  const a = PNG.sync.read(readFileSync(ref)), b = PNG.sync.read(png);
  if (a.width !== b.width || a.height !== b.height) { writeFileSync(path.join(CIKTI, `${ad}.png`), png); sonuc.push({ ad, hata: 'boyut farklı' }); continue; }
  const fark = new PNG({ width: a.width, height: a.height });
  let farkli = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    const ayri = d > KANAL_PAYI;
    if (ayri) farkli++;
    // Fark resmi: aynı yer soluk gri, farklı piksel kırmızı
    const gri = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 12;
    fark.data.set(ayri ? [255, 0, 0, 255] : [gri, gri, gri, 255], i);
  }
  const oran = farkli / (a.width * a.height);
  if (oran > ESIK) {
    writeFileSync(path.join(CIKTI, `${ad}.png`), png);
    writeFileSync(path.join(CIKTI, `${ad}-fark.png`), PNG.sync.write(fark));
  }
  sonuc.push({ ad, oran });
}
await cdp('Browser.close').catch(() => {});

let kirmizi = 0;
for (const s of sonuc) {
  if (s.hata) { kirmizi++; console.log(`✗ ${s.ad}: ${s.hata}`); }
  else if (s.yeni) console.log(`• ${s.ad}: referans yazıldı`);
  else { const k = s.oran > ESIK; kirmizi += k; console.log(`${k ? '✗' : '✓'} ${s.ad}: %${(s.oran * 100).toFixed(2)} farklı`); }
}
console.log(kirmizi ? `${kirmizi} ekran eşiği (%${ESIK * 100}) aştı — fark resimleri: test-results/gorsel/` : 'Görsel gerileme: tüm ekranlar eşik içinde');
kapat();
process.exit(kirmizi ? 1 : 0);
