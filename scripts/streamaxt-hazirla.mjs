#!/usr/bin/env node
/**
 * AxBoT'u (Desktop\StreamAxT; eski yer Desktop\Projeler) AxthrowA Studio'nun "Bot" sekmesi için hazırlar.
 *
 * - Arayüzü TURKUAZ temayla derler: kaynak AxBoT'a DOKUNULMAZ; istemci kaynağı
 *   geçici bir klasöre kopyalanır, mor/indigo/pembe tonları turkuaza çevrilir, orada derlenir.
 * - Sunucuyu (release/app) `<hedef>` klasörüne koyar. node_modules 160+ MB olduğu için
 *   varsayılan olarak kopyalanmaz, bağlantı (junction) olur; `--kopyala` ile gerçek kopya.
 * - Veri (streamaxt.sqlite + bilbakalim soruları) yalnız hedefte yoksa tohumlanır.
 *
 * Kullanım:
 *   node scripts/streamaxt-hazirla.mjs [--kaynak <Projeler>] [--hedef <klasor>] [--kopyala] [--db-tohumla]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

// Varsayılan: GitHub'dan çekilen Desktop\StreamAxT; yoksa eski yer Desktop\Projeler
const varsayilanKaynak = [path.join(os.homedir(), "Desktop", "StreamAxT"), path.join(os.homedir(), "Desktop", "Projeler")].find((p) =>
  fs.existsSync(path.join(p, "server", "package.json")),
) ?? path.join(os.homedir(), "Desktop", "StreamAxT");
const kaynak = path.resolve(arg("kaynak", varsayilanKaynak));
const hedef = path.resolve(arg("hedef", path.join(root, "cikti", "portable", "streamaxt")));

// ---- Renk eşlemesi -----------------------------------------------------------
// Tailwind v4 paletini `@theme` ile geçersiz kılarız: `bg-purple-600`, `text-purple-300/40`,
// `shadow-purple-600/30` vb. tüm sınıflar kaynak değişmeden turkuaza döner.
const TURKUAZ = {
  50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee",
  500: "#0aa0b8", 600: "#088499", 700: "#0a6a7a", 800: "#0d535f", 900: "#103f49", 950: "#062a31",
};
const TEAL = {
  50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf",
  500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e",
};
const ZUMRUT = {
  50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399",
  500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22",
};
const palette = (name, p) => Object.entries(p).map(([k, v]) => `  --color-${name}-${k}: ${v};`).join("\n");
const THEME = `
@theme {
${palette("purple", TURKUAZ)}
${palette("violet", TURKUAZ)}
${palette("indigo", TEAL)}
${palette("fuchsia", TEAL)}
${palette("pink", ZUMRUT)}
}
`;

// Sabit yazılmış mor tonları (hex / rgba). Twitch moru (#9146ff) dışarıda: platform logoları orijinal renkte kalmalı.
const HEX = {
  "#8b5cf6": "#22d3ee", "#a855f7": "#22d3ee", "#7c3aed": "#0aa0b8",
  "#6366f1": "#2dd4bf", "#a78bfa": "#67e8f9", "#d946ef": "#2dd4bf", "#c084fc": "#67e8f9",
  "#ec4899": "#34d399", "#f472b6": "#6ee7b7",
};
const RGBA = [
  [/rgba\(\s*124\s*,\s*58\s*,\s*237/g, "rgba(10,160,184"],
  [/rgba\(\s*139\s*,\s*92\s*,\s*246/g, "rgba(62,237,254"],
  [/rgba\(\s*167\s*,\s*139\s*,\s*250/g, "rgba(103,232,249"],
  [/rgba\(\s*168\s*,\s*85\s*,\s*247/g, "rgba(34,211,238"],
  [/rgba\(\s*99\s*,\s*102\s*,\s*241/g, "rgba(45,212,191"],
];

function recolor(text) {
  let s = text;
  for (const [from, to] of Object.entries(HEX)) s = s.replace(new RegExp(from, "gi"), to);
  for (const [re, to] of RGBA) s = s.replace(re, to);
  return s;
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

function link(target, at) {
  // Var olan bağlantıyı yalnız BAĞLANTI olarak kaldır (hedefin içeriğine dokunma).
  try {
    if (fs.lstatSync(at).isSymbolicLink()) fs.rmdirSync(at);
    else fs.rmSync(at, { recursive: true, force: true });
  } catch {
    /* yok */
  }
  fs.symlinkSync(target, at, "junction");
}

// ---- 1) İstemciyi turkuaz derle ---------------------------------------------
const clientSrc = path.join(kaynak, "client");
const appSrc = path.join(kaynak, "release", "app");
const serverDist = path.join(kaynak, "server", "dist");
for (const p of [clientSrc, path.join(appSrc, "package.json"), path.join(kaynak, "server", "tsconfig.json")]) {
  if (!fs.existsSync(p)) {
    console.error(`[streamaxt] bulunamadı: ${p}\n  --kaynak ile AxBoT (Projeler) klasörünü verin.`);
    process.exit(1);
  }
}

const work = path.join(os.tmpdir(), "streamaxt-client-turkuaz");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
for (const f of ["index.html", "package.json", "vite.config.ts", "tsconfig.json"]) {
  if (fs.existsSync(path.join(clientSrc, f))) fs.copyFileSync(path.join(clientSrc, f), path.join(work, f));
}
fs.cpSync(path.join(clientSrc, "src"), path.join(work, "src"), { recursive: true });
if (fs.existsSync(path.join(clientSrc, "public"))) {
  fs.cpSync(path.join(clientSrc, "public"), path.join(work, "public"), { recursive: true });
}

let changed = 0;
walk(path.join(work, "src"), (p) => {
  if (!/\.(tsx?|css|html)$/.test(p)) return;
  const before = fs.readFileSync(p, "utf8");
  const after = recolor(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    changed++;
  }
});
// Gömülü kullanım: adresteki `#sekme` ile açılış sekmesi seçilebilsin ve
// `?embed=1` ile AxBoT'un kendi kenar çubuğu gizlensin (panelin kendi
// menüsüyle iki çubuk yan yana durmasın). Kaynak dosya değil, kopya düzenlenir.
const appTsx = path.join(work, "src", "App.tsx");
let app = fs.readFileSync(appTsx, "utf8");
const tabState = "const [activeTab, setActiveTab] = useState('dashboard');";
if (!app.includes(tabState)) {
  console.error("[streamaxt] App.tsx sekme durumu bulunamadı — gömme yaması atlandı.");
} else {
  app = app.replace(
    tabState,
    [
      `const embedded = new URLSearchParams(window.location.search).get('embed') === '1';`,
      `  const [activeTab, setActiveTab] = useState(() => window.location.hash.replace('#', '') || 'dashboard');`,
      `  useEffect(() => {`,
      `    const onHash = () => setActiveTab(window.location.hash.replace('#', '') || 'dashboard');`,
      `    window.addEventListener('hashchange', onHash);`,
      `    return () => window.removeEventListener('hashchange', onHash);`,
      `  }, []);`,
    ].join("\n"),
  );
  // Kenar çubuğu ve üst başlık gömülüyken gizlenir; ana içerik tam genişlik alır.
  app = app.replace(
    '<aside className="w-64 border-r',
    `<aside style={embedded ? { display: 'none' } : undefined} className="w-64 border-r`,
  );
  app = app.replace(
    '<header className="h-16 border-b',
    `<header style={embedded ? { display: 'none' } : undefined} className="h-16 border-b`,
  );
  app = app.replace('<div className="flex-1 ml-64 flex flex-col min-h-screen">', "<div className={(embedded ? 'flex-1 min-w-0' : 'flex-1 min-w-0 ml-64') + ' flex flex-col min-h-screen'}>");
  fs.writeFileSync(appTsx, app);
  console.log("[streamaxt] gömme yaması uygulandı (#sekme + ?embed=1).");
}

const css = path.join(work, "src", "index.css");
fs.writeFileSync(css, fs.readFileSync(css, "utf8").replace('@import "tailwindcss";', `@import "tailwindcss";\n${THEME}`));

// Bağımlılıklar: çalışma alanı kökündeki (ya da istemcinin kendi) node_modules.
const nm = [path.join(clientSrc, "node_modules", "vite"), path.join(kaynak, "node_modules", "vite")].find((p) =>
  fs.existsSync(p),
);
if (!nm) {
  console.error("[streamaxt] vite bulunamadı; Projeler klasöründe `npm install` çalıştırın.");
  process.exit(1);
}
link(path.dirname(nm), path.join(work, "node_modules"));

const publicOut = path.join(hedef, "public");
fs.mkdirSync(hedef, { recursive: true });
const viteBin = path.join(work, "node_modules", "vite", "bin", "vite.js");
execFileSync(process.execPath, [viteBin, "build", "--outDir", publicOut, "--emptyOutDir"], {
  cwd: work,
  stdio: "inherit",
});
console.log(`[streamaxt] arayüz turkuaz derlendi (${changed} dosyada sabit renk değişti) → ${publicOut}`);

// ---- 2) Sunucu ---------------------------------------------------------------
// Önce derlenir: eskiden hazır server/dist kopyalanıyordu, derlenmemiş sunucu düzeltmeleri
// (1.4.8–1.4.10) sessizce eski kodla dağıtıldı.
const tscBin = [path.join(kaynak, "server", "node_modules", "typescript", "bin", "tsc"), path.join(kaynak, "node_modules", "typescript", "bin", "tsc")].find((p) =>
  fs.existsSync(p)
);
if (!tscBin) {
  console.error("[streamaxt] typescript bulunamadı; AxBoT klasöründe `npm install` çalıştırın.");
  process.exit(1);
}
execFileSync(process.execPath, [tscBin, "-p", path.join(kaynak, "server")], { stdio: "inherit" });
console.log("[streamaxt] sunucu derlendi");
fs.rmSync(path.join(hedef, "dist"), { recursive: true, force: true });
fs.cpSync(serverDist, path.join(hedef, "dist"), { recursive: true });
// Testler dağıtıma girmez (örnek değerler ve gereksiz boyut)
for (const f of fs.readdirSync(path.join(hedef, "dist"), { recursive: true })) {
  if (/\.test\.(js|js\.map|d\.ts)$/.test(String(f))) fs.rmSync(path.join(hedef, "dist", String(f)));
}
// Çalışma paketi release/app'ten; sürüm AxBoT'un gerçek sürümü (YYA "Hakkında" bunu gösterir)
{
  const paket = JSON.parse(fs.readFileSync(path.join(appSrc, "package.json"), "utf8"));
  paket.version = JSON.parse(fs.readFileSync(path.join(kaynak, "package.json"), "utf8")).version || paket.version;
  fs.writeFileSync(path.join(hedef, "package.json"), JSON.stringify(paket, null, 2) + "\n");
}
// Sunucudaki varsayılan widget/alert renkleri de (dist kopyasında) turkuaza çevrilir.
let serverChanged = 0;
walk(path.join(hedef, "dist"), (p) => {
  if (!p.endsWith(".js")) return;
  const before = fs.readFileSync(p, "utf8");
  const after = recolor(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    serverChanged++;
  }
});
console.log(`[streamaxt] sunucu varsayılan renkleri: ${serverChanged} dosya`);

const nmDest = path.join(hedef, "node_modules");
if (flag("kopyala")) {
  fs.rmSync(nmDest, { recursive: true, force: true });
  fs.cpSync(path.join(appSrc, "node_modules"), nmDest, { recursive: true });
} else {
  link(path.join(appSrc, "node_modules"), nmDest);
}

// ---- 3) Veri (yalnız yoksa) --------------------------------------------------
const dataDest = path.join(hedef, "data");
fs.mkdirSync(dataDest, { recursive: true });
const bilb = path.join(kaynak, "server", "data", "bilbakalim");
if (fs.existsSync(bilb) && !fs.existsSync(path.join(dataDest, "bilbakalim"))) {
  fs.cpSync(bilb, path.join(dataDest, "bilbakalim"), { recursive: true });
}
const dbDest = path.join(dataDest, "streamaxt.sqlite");
if (flag("db-tohumla") && !fs.existsSync(dbDest)) {
  for (const f of ["streamaxt.sqlite", "streamaxt.sqlite-wal", "streamaxt.sqlite-shm"]) {
    const s = path.join(kaynak, "server", "data", f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dataDest, f));
  }
  console.log("[streamaxt] mevcut AxBoT veritabanı tohumlandı (platform/komut ayarları taşındı).");
}

// Veritabanındaki kayıtlı widget renkleri (yalnız bizim kopya; sunucu kapalıyken çalıştırın).
if (flag("db-recolor") || flag("db-tohumla")) {
  const { DatabaseSync } = await import("node:sqlite");
  if (fs.existsSync(dbDest)) {
    const db = new DatabaseSync(dbDest);
    let n = 0;
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    for (const { name } of tables) {
      const cols = db.prepare(`PRAGMA table_info("${name}")`).all().filter((c) => /TEXT|CHAR|CLOB|JSON|^$/i.test(c.type || ""));
      for (const { name: col } of cols) {
        try {
          const rows = db.prepare(`SELECT rowid AS id, "${col}" AS v FROM "${name}" WHERE "${col}" LIKE '%#%' OR "${col}" LIKE '%rgba(%'`).all();
          const upd = db.prepare(`UPDATE "${name}" SET "${col}" = ? WHERE rowid = ?`);
          for (const r of rows) {
            if (typeof r.v !== "string") continue;
            const after = recolor(r.v);
            if (after !== r.v) {
              upd.run(after, r.id);
              n++;
            }
          }
        } catch {
          /* rowid'siz tablo vb. — atla */
        }
      }
    }
    db.close();
    console.log(`[streamaxt] veritabanında ${n} kayıtlı renk turkuaza çevrildi.`);
  }
}

console.log(`[streamaxt] hazır: ${hedef}`);

// Resonance kaynağı Studio deposunda. Paket, orada derlenmiş dist'i alır;
// botun kendi src ağacı elle eşitlenmez.
const resDist = path.join(root, "resonance", "dist");
const resPaket = path.join(root, "cikti", "portable", "resonance", "dist");
if (fs.existsSync(path.join(resDist, "index.html"))) {
  fs.cpSync(resDist, resPaket, { recursive: true });
  console.log(`[streamaxt] Resonance derlemesi pakete kopyalandı → ${resPaket}`);
} else {
  console.warn("[streamaxt] resonance/dist yok. Önce: npm run build:resonance");
}
// Bu bilgisayarın Client ID'leri pakete girer (sır girmez): yeni kurulumda yeniden yazmak gerekmesin
execFileSync(process.execPath, [path.join(root, "scripts", "kimlikleri-ekle.mjs"), path.join(hedef, "varsayilan-kimlikler.json")], { stdio: "inherit" });
