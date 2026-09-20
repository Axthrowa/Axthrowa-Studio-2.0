import { defineConfig } from 'vitest/config'

// Testler JSX'i otomatik çalışma zamanıyla çevirsin (uygulamadaki gibi);
// aksi halde her bileşen dosyasında `import React` gerekir.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node' },
})
