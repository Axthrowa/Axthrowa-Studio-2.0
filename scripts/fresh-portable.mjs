/**
 * Temiz portable derleme:
 * 1) Eski Portable-Build + SQLite data klasörlerini sil
 * 2) cargo clean
 * 3) npm run build:portable
 *
 * Kullanım: npm run build:fresh-portable
 * WDAC 4551 için Cursor/terminal’i Yönetici olarak çalıştırın.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const APP_ID = "com.axthrowa.yayin-yonetim-araci";

function rm(p, label) {
  if (!fs.existsSync(p)) {
    console.log(`[fresh] atlandı (yok): ${label}`);
    return;
  }
  try {
    fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`[fresh] silindi: ${label}`);
  } catch (e) {
    console.warn(`[fresh] silinemedi (${label}): ${e.message}`);
  }
}

function run(cmd, args, cwd) {
  console.log(`[fresh] > ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (r.error) {
    console.error(`[fresh] çalıştırılamadı: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`[fresh] başarısız (exit ${r.status}): ${cmd}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[fresh] === Temiz portable derleme ===");
console.log(`[fresh] kök: ${root}`);

// 1) Önceki portable çıktı + data
rm(path.join(root, "Portable-Build"), "Portable-Build/");
rm(path.join(root, "Dist-AxthrowA", "Portable"), "Dist-AxthrowA/Portable/");

// Kurulu mod AppData DB (eski seed’i engellemesin)
const appData =
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
rm(path.join(appData, APP_ID), `%APPDATA%/${APP_ID}`);

// Proje içi eski data / dist kalıntıları (isteğe bağlı temizlik)
rm(path.join(root, "src-tauri", "app-data"), "src-tauri/app-data/");
rm(path.join(root, "dist"), "dist/ (frontend — yeniden üretilecek)");

// 2) Cargo önbelleği / bozuk artifact’ler
const cargo =
  process.platform === "win32"
    ? spawnSync("where", ["cargo"], { encoding: "utf8", shell: true })
    : spawnSync("which", ["cargo"], { encoding: "utf8" });
if ((cargo.status ?? 1) !== 0) {
  console.error(
    "[fresh] `cargo` bulunamadı. Rust toolchain PATH’te olmalı (Yönetici terminal)."
  );
  process.exit(1);
}
run("cargo", ["clean"], path.join(root, "src-tauri"));

// 3) Normal portable zincir
console.log("[fresh] build:portable başlıyor…");
run("npm", ["run", "build:portable"], root);

console.log("");
console.log("[fresh] Tamam. Çıktı: Portable-Build/");
console.log(
  "[fresh] İlk açılışta boş data/ → widget/alert seed otomatik çalışır."
);
