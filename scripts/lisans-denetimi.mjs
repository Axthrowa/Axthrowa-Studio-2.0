// Rust crate lisans denetimi (çevrimdışı): panelin (`src-tauri`) ve yayın motorunun (`motor`) `cargo metadata`
// çıktısındaki her üçüncü taraf crate, GPL-2.0-or-later ürünle uyumlu bir lisansla gelmeli (ADR-005). npm ağaçları
// vitest ile denetlenir (src/lib/licenses.test.ts).
//   node scripts/lisans-denetimi.mjs          → sorun yoksa 0, varsa 1 ile çıkar
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * GPL-2.0-or-later ile birleştirilebilen lisanslar. Apache-2.0 GPL-3.0 ile uyumludur; ürün "or later" olduğu için
 * birleşik eser GPL-3.0 altında dağıtılabilir. GPL-2.0-only ve AGPL bilinçli olarak yok (ADR-005 §3).
 */
export const IZINLI = new Set([
  'MIT', 'MIT-0', 'Apache-2.0', 'Apache-2.0 WITH LLVM-exception', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', '0BSD',
  'Unlicense', 'CC0-1.0', 'Unicode-3.0', 'Unicode-DFS-2016', 'BSL-1.0', 'MPL-2.0', 'CDLA-Permissive-2.0',
  'LGPL-2.1-or-later', 'LGPL-3.0-or-later', 'LGPL-3.0-only', 'GPL-2.0-or-later', 'GPL-3.0-or-later', 'GPL-3.0-only',
  // Independent JPEG Group lisansı (FSF: GPL uyumlu özgür lisans); belgelerde atıf ister → THIRD_PARTY_NOTICES
  'IJG',
]);

export function uygun(ifade) {
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

export function paketler(manifest) {
  const meta = JSON.parse(
    execFileSync('cargo', ['metadata', '--format-version', '1', '--offline', '--manifest-path', manifest], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  );
  const kendi = new Set(meta.workspace_members);
  return meta.packages.filter((p) => !kendi.has(p.id));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sorunlu = [];
  for (const [ad, m] of [['panel', path.join(kok, 'src-tauri', 'Cargo.toml')], ['motor', path.join(kok, 'motor', 'Cargo.toml')]]) {
    const liste = paketler(m);
    console.log(`${ad}: ${liste.length} crate`);
    for (const p of liste) {
      const l = p.license || '';
      if (!uygun(l)) sorunlu.push(`${ad}: ${p.name}@${p.version} → ${l || `lisans yok (license-file: ${p.license_file || '-'})`}`);
    }
  }
  if (sorunlu.length) {
    console.log('GPL-2.0-or-later ile uyumlu olmayan ya da bilinmeyen lisans:');
    for (const s of sorunlu) console.log('  ' + s);
    process.exit(1);
  }
  console.log('tamam — tüm crate lisansları GPL-2.0-or-later ürünle uyumlu');
}
