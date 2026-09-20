/**
 * Kilitli .exe sorununu çözer:
 * 1) çalışan yayin-yonetim-araci*.exe süreçlerini kapatır
 * 2) en güncel release .exe + dist/ → Portable-Build-NEW
 * 3) uygulamayı yeniden başlatır
 *
 * Kullanım:
 *   npm run restart
 *   npm run restart -- --build   (önce vite build)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const portable = path.join(root, "Portable-Build-NEW");
const destExe = path.join(portable, "yayin-yonetim-araci.exe");
const destDist = path.join(portable, "dist");
const wantBuild = process.argv.includes("--build");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  console.log(`[restart] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
    ...opts,
  });
  return r.status ?? 1;
}

function killApp() {
  if (process.platform !== "win32") {
    log("Windows dışı: taskkill atlandı");
    return;
  }
  const images = [
    "yayin-yonetim-araci.exe",
    "yayin-yonetim-araci-FAZ2.exe",
    "yayin-yonetim-araci.new.exe",
  ];
  for (const im of images) {
    const r = spawnSync("taskkill", ["/F", "/IM", im, "/T"], {
      encoding: "utf8",
      shell: true,
    });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    if (/SUCCESS|başarıyla|successfully/i.test(out)) {
      log(`kapatıldı: ${im}`);
    }
  }
}

function fileMtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function candidateExes() {
  const list = [];
  const push = (p, label) => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      list.push({ path: p, label, mtime: fileMtime(p) });
    }
  };

  // Öncelik: yeni isimler + cargo hedefi
  push(path.join(portable, "yayin-yonetim-araci-FAZ2.exe"), "Portable FAZ2");
  push(path.join(portable, "yayin-yonetim-araci.new.exe"), "Portable .new");
  push(path.join(root, "src-tauri", "target", "release", "yayin-yonetim-araci.exe"), "local target/release");

  const cargoTarget = process.env.CARGO_TARGET_DIR;
  if (cargoTarget) {
    push(path.join(cargoTarget, "release", "yayin-yonetim-araci.exe"), "CARGO_TARGET_DIR");
  }

  // Cursor sandbox cache (bu ortamda cargo sık buraya yazar)
  const sandboxRoot = path.join(
    process.env.LOCALAPPDATA || "",
    "Temp",
    "cursor-sandbox-cache"
  );
  if (fs.existsSync(sandboxRoot)) {
    try {
      for (const dir of fs.readdirSync(sandboxRoot)) {
        push(
          path.join(sandboxRoot, dir, "cargo-target", "release", "yayin-yonetim-araci.exe"),
          `sandbox:${dir.slice(0, 8)}`
        );
      }
    } catch {
      /* */
    }
  }

  // Mevcut ana exe en son yedek (üzerine yazmadan önce kaynak olarak kullanılmaz
  // eğer daha yeni bir aday yoksa — yine de listeye ekleme ki eskiyi kendini kopyalamasın)
  return list.sort((a, b) => b.mtime - a.mtime);
}

async function waitUnlocked(file, tries = 25) {
  for (let i = 0; i < tries; i++) {
    try {
      const fd = fs.openSync(file, "r+");
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e && (e.code === "ENOENT" || e.code === "EPERM" || e.code === "EBUSY")) {
        await sleep(200);
        continue;
      }
      // yazılamıyorsa bile bir sonraki copy denesin
      await sleep(200);
    }
  }
  return false;
}

function syncSleep(ms) {
  try {
    spawnSync(process.execPath, ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin */
    }
  }
}

function copyFileRetry(src, dest, tries = 20) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (e) {
      last = e;
      spawnSync("taskkill", ["/F", "/IM", "yayin-yonetim-araci.exe", "/T"], {
        shell: true,
        windowsHide: true,
      });
      syncSleep(250);
    }
  }
  throw last || new Error(`kopyalanamadı: ${dest}`);
}

function syncDist() {
  const srcDist = path.join(root, "dist");
  if (!fs.existsSync(path.join(srcDist, "index.html"))) {
    log("uyarı: kök dist/ yok — npm run build çalıştırın veya --build kullanın");
    return false;
  }
  fs.mkdirSync(portable, { recursive: true });
  fs.rmSync(destDist, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  fs.cpSync(srcDist, destDist, { recursive: true });
  log(`dist senkron: ${destDist}`);
  return true;
}

async function main() {
  log(`kök: ${root}`);
  fs.mkdirSync(portable, { recursive: true });

  if (wantBuild) {
    log("vite build…");
    if (run("npm", ["run", "build"]) !== 0) process.exit(1);
  }

  log("eski süreçler kapatılıyor…");
  killApp();
  await sleep(600);
  await waitUnlocked(destExe);

  const cands = candidateExes();
  if (!cands.length) {
    console.error(
      "[restart] yeni .exe bulunamadı. Önce `cargo build --release` veya FAZ2 exe üretin."
    );
    process.exit(1);
  }

  const best = cands[0];
  // Ana exe’yi kaynak olarak seçme (kendini kilitlemesin)
  const src =
    path.resolve(best.path) === path.resolve(destExe) && cands[1]
      ? cands[1]
      : best;

  log(`kaynak exe: ${src.label} → ${src.path}`);
  log(`mtime: ${new Date(src.mtime).toLocaleString()}`);

  try {
    copyFileRetry(src.path, destExe);
    log(`yazıldı: ${destExe}`);
  } catch (e) {
    console.error(`[restart] exe kopyası başarısız: ${e.message || e}`);
    process.exit(1);
  }

  // Yan ürünleri de güncelle (sonraki restart adayları)
  try {
    copyFileRetry(src.path, path.join(portable, "yayin-yonetim-araci.new.exe"));
  } catch {
    /* */
  }

  syncDist();

  log("uygulama başlatılıyor…");
  const child = spawn(destExe, [], {
    cwd: portable,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  log("hazır — Portable-Build-NEW\\yayin-yonetim-araci.exe");
}

main().catch((e) => {
  console.error("[restart] hata:", e);
  process.exit(1);
});
