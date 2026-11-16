import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createReadStream, existsSync, readFileSync, statSync } from "fs";

const surum = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version as string;

const host = process.env.TAURI_DEV_HOST;

const TURLER: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/**
 * Dev sunucusunda /resonance/* yolunu derlenmiş Resonance'a (resonance/dist) bağlar; 8843 sunucusu da
 * aynısını yapar (ServeDir + index.html yedeği). Yoksa Vite bu yollara Studio'nun index.html'ini verir
 * ve Müzik sekmesi / önizlemedeki widget çerçevesinde Studio kendini açar.
 */
function resonanceDist(): Plugin {
  const kok = path.resolve(__dirname, "resonance/dist");
  return {
    name: "resonance-dist",
    configureServer(server) {
      server.middlewares.use("/resonance", (req, res, next) => {
        if (!existsSync(path.join(kok, "index.html"))) return next();
        const yol = decodeURIComponent((req.url || "/").split("?")[0]);
        let dosya = path.join(kok, yol);
        // Kök dışına çıkan yol ya da olmayan dosya: SPA yedeği
        if (!dosya.startsWith(kok) || !existsSync(dosya) || statSync(dosya).isDirectory()) dosya = path.join(kok, "index.html");
        res.setHeader("Content-Type", TURLER[path.extname(dosya)] || "application/octet-stream");
        createReadStream(dosya).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), resonanceDist()],
  // Panelde gösterilen uygulama sürümü (package.json ile aynı)
  define: { __STUDIO_SURUM__: JSON.stringify(surum) },
  // Production / Tauri HTTP sunucu (8843): mutlak asset kökü.
  // `base: './'` + `/widgets/cup` → yanlışlıkla /widgets/assets/* ister (boş ekran).
  base: "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // Resonance kendi paketi (kendi React kopyası ve vitest'i var): kök koşucu onun
  // testlerini çalıştırırsa iki React kopyası çakışıp kanca (hook) testleri
  // "useContext null" ile düşüyor. `npm --prefix resonance test` ile ayrı koşar.
  test: { exclude: ["**/node_modules/**", "resonance/**", "streamdeck/**", "axbot/**", "**/dist/**", "src-tauri/**", "**/src_backup*/**"] },
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
