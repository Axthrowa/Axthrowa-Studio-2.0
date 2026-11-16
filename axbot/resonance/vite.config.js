import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// AxthrowA Studio ile aynı sunucuda: http://127.0.0.1:8843/resonance/
export default defineConfig({
  base: '/resonance/',
  plugins: [react(), tailwindcss()],
  // Kök projedeki postcss/tailwind v3 config'ini kullanma — Tailwind v4 Vite eklentisi yeterli
  css: {
    postcss: {
      plugins: [],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
