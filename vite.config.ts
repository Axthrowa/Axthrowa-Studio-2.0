import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
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
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
