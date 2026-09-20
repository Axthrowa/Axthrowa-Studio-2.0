/**
 * Tauri build çıktısından Portable-Build klasörü üretir.
 * Yanına boş portable.txt koyar → uygulama data/ klasörünü exe yanında kullanır.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "Portable-Build");

const candidates = [
  path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "yayin-yonetim-araci.exe"
  ),
  path.join(
    root,
    "src-tauri",
    "target",
    "x86_64-pc-windows-msvc",
    "release",
    "yayin-yonetim-araci.exe"
  ),
  path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "nsis"
  ),
];

function findExe() {
  for (const c of candidates) {
    if (c.endsWith(".exe") && fs.existsSync(c)) return c;
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
      const found = fs
        .readdirSync(c)
        .find((f) => f.toLowerCase().endsWith(".exe"));
      if (found) return path.join(c, found);
    }
  }
  // bundle/msi/nsis altını tara
  const bundle = path.join(root, "src-tauri", "target", "release", "bundle");
  if (fs.existsSync(bundle)) {
    const stack = [bundle];
    while (stack.length) {
      const d = stack.pop();
      for (const name of fs.readdirSync(d)) {
        const p = path.join(d, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) stack.push(p);
        else if (name.toLowerCase().endsWith(".exe") && !name.includes("uninstall")) {
          return p;
        }
      }
    }
  }
  return null;
}

const exe = findExe();
if (!exe) {
  console.error(
    "[portable] .exe bulunamadı. Önce: npm run tauri:build"
  );
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const destExe = path.join(outDir, path.basename(exe));
fs.copyFileSync(exe, destExe);
fs.writeFileSync(path.join(outDir, "portable.txt"), "");

// dist kaynakları (HTTP sunucu) — resources veya proje dist
const distSrc = [
  path.join(root, "dist"),
  path.join(path.dirname(exe), "resources", "dist"),
  path.join(root, "src-tauri", "target", "release", "resources", "dist"),
].find((p) => fs.existsSync(path.join(p, "index.html")));

if (distSrc) {
  copyDir(distSrc, path.join(outDir, "dist"));
}

const resDist = [
  path.join(root, "resonance", "dist"),
  path.join(path.dirname(exe), "resources", "resonance", "dist"),
].find((p) => fs.existsSync(path.join(p, "index.html")));
if (resDist) {
  copyDir(resDist, path.join(outDir, "resonance", "dist"));
}

fs.mkdirSync(path.join(outDir, "data"), { recursive: true });

console.log(`[portable] → ${outDir}`);
console.log(`  exe: ${path.basename(destExe)}`);
console.log(`  marker: portable.txt`);
console.log(`  data/: (boş, ilk çalıştırmada dolar)`);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}
