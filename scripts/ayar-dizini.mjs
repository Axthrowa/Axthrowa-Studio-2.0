// Komut paletinin ayar dizinini üretir: src/lib/ayarDizini.json
// Studio sayfaları çalışan Vite geliştirme sunucusunda başsız Chrome ile gezilir (her sayfa ve her sekmesi açılıp
// etiket/başlık metinleri toplanır); bot (AxBoT) sayfaları ../StreamAxT/client/src/pages kaynağından okunur.
// Kullanım: npx vite --port 5201 açıkken  node scripts/ayar-dizini.mjs http://127.0.0.1:5201/panel
// Not: geliştirme sunucusunda API kökü Vite'ın kendisidir; gezinti gerçek uygulamaya hiçbir şey yazmaz.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:5201/panel';
const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

const profil = mkdtempSync(path.join(tmpdir(), 'ayar-dizini-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--remote-allow-origins=*', 'about:blank',
], { stdio: 'ignore' });
let hedef;
for (let i = 0; i < 50 && !hedef; i++) {
  await bekle(200);
  try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(hedef.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let sira = 0; const bekleyen = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++sira; bekleyen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (ifade) => (await cdp('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true })).result?.result?.value;

await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url });
await bekle(2500);
// Temiz profilde karşılama ekranı açılmasın
await js(`localStorage.setItem(${JSON.stringify(process.env.KARSILAMA_KEY || 'axthrowa.karsilama.goruldu')}, '1'); location.reload()`);
await bekle(4000);

// Sayfadaki etiket ve başlıklar (CSS büyük harfi değil, yazıldığı biçim)
const TOPLA = `(() => {
  const ana = document.querySelector('.panel-shell') || document.body;
  const out = [];
  ana.querySelectorAll('label, legend, h2, h3, h4, summary, p.uppercase, div.uppercase > span').forEach((el) => {
    if (el.closest('.yya-nav-rail') || el.closest('[role="dialog"]')) return;
    // Kopyadan seçim kutusu/düğme gibi denetimler çıkarılır: yalnız etiketin kendi yazısı kalır
    const k = el.cloneNode(true);
    k.querySelectorAll('select, option, input, textarea, button, svg, [aria-hidden="true"], .sr-only').forEach((x) => x.remove());
    // Şablon dizgesinde çift ters bölü: sayfaya \s olarak gider
    const t = (k.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t) out.push(t);
  });
  ana.querySelectorAll('[role="group"][aria-label]').forEach((el) => !el.closest('.yya-nav-rail') && out.push(el.getAttribute('aria-label')));
  return out;
})()`;
const SEKMELER = `[...(document.querySelector('.panel-shell') || document.body).querySelectorAll('[role="tab"]')].filter((e) => !e.closest('.yya-nav-rail')).map((e) => (e.innerText || '').trim()).filter(Boolean)`;

const kayit = [];
const ekle = (s, a, t) => kayit.push(t ? { s, a, t } : { s, a });
const gruplar = await js(`document.querySelectorAll('.yya-nav-rail nav > div').length`);
const gezilen = new Set();
for (let g = 0; g < gruplar; g++) {
  await js(`document.querySelectorAll('.yya-nav-rail nav > div')[${g}].querySelector('button').click()`);
  await bekle(900);
  const altlar = await js(`[...document.querySelectorAll('.yya-nav-rail nav > div')[${g}].querySelectorAll('button[data-nav-id]')].map((b) => b.dataset.navId)`);
  for (let i = 0; i < altlar.length; i++) {
    const nav = altlar[i];
    if (nav === 'bot' || gezilen.has(nav)) continue;
    gezilen.add(nav);
    await js(`[...document.querySelectorAll('.yya-nav-rail nav > div')[${g}].querySelectorAll('button[data-nav-id]')][${i}].click()`);
    await bekle(1800);
    for (const a of (await js(TOPLA)) || []) ekle(nav, a);
    const sekmeler = (await js(SEKMELER)) || [];
    for (const t of sekmeler) {
      await js(`[...document.querySelector('.panel-shell').querySelectorAll('[role="tab"]')].filter((e) => !e.closest('.yya-nav-rail')).find((e) => (e.innerText || '').trim() === ${JSON.stringify(t)})?.click()`);
      await bekle(700);
      ekle(nav, t);
      for (const a of (await js(TOPLA)) || []) ekle(nav, a, t);
    }
    console.log(nav, kayit.filter((k) => k.s === nav).length);
  }
}
await cdp('Page.navigate', { url: 'about:blank' });
await bekle(800);

await cdp("Browser.close").catch(() => {});

// Bot sayfaları: App.tsx'teki `case 'sekme': return <Sayfa` eşlemesi, sayfa kaynağındaki etiket/başlık metinleri
const botKok = path.resolve(kok, '../StreamAxT/client/src');
if (existsSync(botKok)) {
  const app = readFileSync(path.join(botKok, 'App.tsx'), 'utf8');
  const esle = [...app.matchAll(/case '([\w-]+)': return <(\w+)/g)];
  const ACIK = /<(?:label|h2|h3|h4|legend)\b[^>]*>\s*([^<{}]+?)\s*</g;
  const OZ = /\b(?:etiket|label|baslik)="([^"]{2,60})"/g;
  for (const [, sekme, bilesen] of esle) {
    const dosya = path.join(botKok, 'pages', `${bilesen}.tsx`);
    if (!existsSync(dosya)) continue;
    const src = readFileSync(dosya, 'utf8');
    for (const re of [ACIK, OZ]) for (const m of src.matchAll(re)) kayit.push({ s: 'bot', b: sekme, a: m[1].replace(/\s+/g, ' ').trim() });
  }
}

// Widget adları (OverlayStudio.tsx GALERI_TR): aramada "Widget" grubunda çıkar, Tek URL ve widget'lar sayfasını açar
const galeri = path.join(botKok, 'pages', 'OverlayStudio.tsx');
if (existsSync(galeri)) {
  for (const m of readFileSync(galeri, 'utf8').matchAll(/^\s*'?[a-z-]+'?: \{\s*baslik: '([^']+)'/gm)) kayit.push({ s: 'bot', b: 'overlays', a: m[1], g: 'Widget' });
}

// Ayıkla: sayı, saat, tek harf ve tekrarlar dışarıda
const gorulen = new Set();
const temiz = kayit.filter((k) => {
  k.a = k.a.replace(/[:：]\s*$/, '').replace(/\s+/g, ' ').trim();
  if (k.a.length < 3 || k.a.length > 60 || !/\p{L}{3}/u.test(k.a) || /^[\d\s:.,%—-]+$/.test(k.a)) return false;
  const anahtar = `${k.s}|${k.b || ''}|${k.a.toLocaleLowerCase('tr')}`;
  if (gorulen.has(anahtar)) return false;
  gorulen.add(anahtar);
  return true;
});
writeFileSync(path.join(kok, 'src/lib/ayarDizini.json'), JSON.stringify(temiz, null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log('toplam', temiz.length);
