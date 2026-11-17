import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  // Depo kökündeki Studio postcss/Tailwind 3 ayarını arama; Tailwind 4 Vite eklentisi yeterli
  css: { postcss: {} },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/health': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('canvas-confetti')) {
              return 'confetti';
            }
            // Konuşma tanıma (~5.8 MB WASM): yalnız dinleyici açılınca yüklensin; OBS katmanları taşımasın
            if (id.includes('vosk-browser')) {
              return 'vosk';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
