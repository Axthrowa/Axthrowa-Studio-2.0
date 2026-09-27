// Rust crate lisans denetimi (çevrimdışı): `cargo metadata` çıktısındaki her üçüncü taraf crate izin listesindeki bir
// lisansla gelmeli. npm ağaçları vitest ile denetlenir (src/lib/licenses.test.ts).
//   node scripts/lisans-denetimi.mjs          → sorun yoksa 0, varsa 1 ile çıkar
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IZINLI = new Set([
  'MIT', 'Apache-2.0', 'Apache-2.0 WITH LLVM-exception', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', '0BSD',
  'Unlicense', 'CC0-1.0', 'Unicode-3.0', 'Unicode-DFS-2016', 'BSL-1.0', 'MPL-2.0', 'CDLA-Permissive-2.0',
]);

function uygun(ifade) {
  // Eski crate'lerdeki "MIT/Apache-2.0" yazımı OR demektir
  const parca = ifade.replace(/\//g, ' OR ').replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/);
  let i = 0;
  const birim = () => {
    const t = parca[i++];
    if (t === '(') { const v = veya(); i++; return v; }
    if (parca[i] === 'WITH') { const istisna = parca[i + 1]; i += 2; return IZINLI.has(`${t} WITH ${istisna}`) || IZINLI.has(t); }
    return IZINLI.has(t ?? '');
  };
  const ve = () => { let v = birim(); while (parca[i] === 'AND') { i++; v = birim() && v; } return v; };
  const veya = () => { let v = ve(); while (parca[i] === 'OR') { i++; v = ve() || v; } return v; };
  return veya() && i === parca.length;
}

const meta = JSON.parse(
  execFileSync('cargo', ['metadata', '--format-version', '1', '--offline', '--manifest-path', path.join(kok, 'src-tauri', 'Cargo.toml')], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
);
const kendi = new Set(meta.workspace_members);
const sorunlu = [];
const say = {};
for (const p of meta.packages) {
  if (kendi.has(p.id)) continue;
  const l = p.license || '';
  say[l || '(yok)'] = (say[l || '(yok)'] || 0) + 1;
  if (!uygun(l)) sorunlu.push(`${p.name}@${p.version} → ${l || `lisans yok (license-file: ${p.license_file || '-'})`}`);
}
console.log(`crate: ${meta.packages.length - kendi.size}`);
if (sorunlu.length) {
  console.log('İzin listesi dışı:');
  for (const s of sorunlu) console.log('  ' + s);
  process.exit(1);
}
console.log('tamam — izin listesi dışı lisans yok');
