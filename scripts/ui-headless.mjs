// Geliştirme: panel arayüzünü başsız sunucuya (examples/headless_server.rs) bağlı Vite ile açar.
//   cargo run --example headless_server -- 18843
//   node scripts/ui-headless.mjs [api-portu] [ui-portu] [streamaxt-portu]
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = process.argv[2] || '18843';
const uiPort = Number(process.argv[3] || 1421);
process.env.VITE_API_BASE = `http://127.0.0.1:${apiPort}`;
// Yalıtılmış bir StreamAxT örneğiyle denemek için (gerçek bot 3001'de kalır)
if (process.argv[4]) process.env.VITE_STREAMAXT_PORT = process.argv[4];
// PostCSS/Tailwind yapılandırması çalışma dizininden aranıyor; depo kökünden çalış
process.chdir(kok);

const { createServer } = await import(path.join(kok, 'node_modules', 'vite', 'dist', 'node', 'index.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const server = await createServer({ root: kok, configFile: path.join(kok, 'vite.config.ts'), server: { port: uiPort, strictPort: true } });
await server.listen();
server.printUrls();
