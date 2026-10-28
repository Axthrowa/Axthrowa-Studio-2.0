import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

const surum = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version as string;

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Panelde gösterilen uygulama sürümü (package.json ile aynı)
  define: { __YYA_SURUM__: JSON.stringify(surum) },
  // Production / Tauri HTTP sunucu (8843): mutlak asset kökü.
  // `base: './'` + `/widgets/cup` → yanlışlıkla /widgets/assets/* ister (boş ekran).
  base: "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // Resonance kendi paketi (kendi React kopyası ve vitest'i var): kök koşucu onun
  // testlerini çalıştırırsa iki React kopyası çakışıp kanca (hook) testleri
  // "useContext null" ile düşüyor. `npm --prefix resonance test` ile ayrı koşar.
  test: { exclude: ["**/node_modules/**", "resonance/**", "**/dist/**", "src-tauri/**", "**/src_backup*/**"] },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    // Derleme/çıktı klasörleri izlenmez: cargo kilitli .pdb dosyalarını tutarken izleyici EBUSY ile çöker
    watch: { ignored: ["**/src-tauri/**", "**/motor/**", "**/cikti/**", "**/resonance/node_modules/**"] },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
