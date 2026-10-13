/**
 * Bağımlılık lisans bekçisi: kilit dosyasındaki her paket izin listesindeki bir lisansla gelmeli.
 *
 * StreamAxT MIT dağıtılıyor; GPL/AGPL/SSPL gibi bir bağımlılık (ör. tiktok-live-connector ≥ 2.4.1 AGPL-3.0-only)
 * birleşik eserin lisans yükümlülüklerini değiştirir. Bir güncelleme böyle bir paketi getirirse bu test kırılır —
 * karar ürün sahibinindir (bkz. docs/LICENSE_AND_DEPENDENCY_REVIEW.md).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const IZINLI = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-4.0', // yalnız veri paketi (caniuse-lite) — atıf
  'MPL-2.0', // dosya düzeyinde zayıf copyleft; değiştirilmeden kullanılıyor
  'Python-2.0',
  'BlueOak-1.0.0',
]);

/** SPDX ifadesi (AND / OR / parantez) izin listesiyle karşılanabiliyor mu? OR → biri yeter, AND → hepsi gerekir. */
function lisansUygun(ifade: string, izinli: Set<string> = IZINLI): boolean {
  const parca = ifade.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/);
  let i = 0;
  const birim = (): boolean => {
    const t = parca[i++];
    if (t === '(') {
      const v = veya();
      i++; // ')'
      return v;
    }
    return izinli.has(t ?? '');
  };
  const ve = (): boolean => {
    let v = birim();
    while (parca[i] === 'AND') {
      i++;
      v = birim() && v;
    }
    return v;
  };
  const veya = (): boolean => {
    let v = ve();
    while (parca[i] === 'OR') {
      i++;
      v = ve() || v;
    }
    return v;
  };
  const sonuc = veya();
  return sonuc && i === parca.length;
}

type KilitPaketi = { version?: string; license?: unknown; link?: boolean; dev?: boolean };

function kilit(): Record<string, KilitPaketi> {
  // Testler server/ ya da depo kökünden çalıştırılabilir (diğer testlerle aynı kural)
  const yol = [resolve(process.cwd(), '..', 'package-lock.json'), resolve(process.cwd(), 'package-lock.json')].find(
    (y) => existsSync(y) && readFileSync(y, 'utf8').includes('"workspaces"')
  );
  if (!yol) throw new Error('kök package-lock.json bulunamadı');
  return JSON.parse(readFileSync(yol, 'utf8')).packages;
}

describe('lisansUygun', () => {
  it('SPDX ifadelerini doğru değerlendirir', () => {
    expect(lisansUygun('MIT')).toBe(true);
    expect(lisansUygun('(MIT OR CC0-1.0)')).toBe(true);
    expect(lisansUygun('Apache-2.0 OR MIT')).toBe(true);
    expect(lisansUygun('(Apache-2.0 AND BSD-3-Clause)')).toBe(true);
    expect(lisansUygun('AGPL-3.0-only')).toBe(false);
    expect(lisansUygun('MIT AND GPL-3.0-only')).toBe(false);
    expect(lisansUygun('GPL-2.0-only OR MIT')).toBe(true); // çift lisans: MIT seçilir
    expect(lisansUygun('SSPL-1.0')).toBe(false);
    expect(lisansUygun('')).toBe(false);
  });
});

describe('bağımlılık lisansları (package-lock.json)', () => {
  const paketler = Object.entries(kilit()).filter(([yol]) => yol !== '');

  it('her üçüncü taraf paket izin listesinde', () => {
    const sorunlu: string[] = [];
    for (const [yol, p] of paketler) {
      if (p.link) continue; // çalışma alanının kendi paketi
      if (!yol.includes('node_modules/')) continue; // client/, server/ çalışma alanı kökleri
      const lisans = typeof p.license === 'string' ? p.license : '';
      if (!lisansUygun(lisans)) sorunlu.push(`${yol}@${p.version} → ${lisans || 'lisans yok'}${p.dev ? ' (geliştirme)' : ''}`);
    }
    expect(sorunlu).toEqual([]);
  });

  it('tiktok-live-connector AGPL öncesi sürümde (2.4.0) sabit', () => {
    const tt = paketler.find(([yol]) => yol.endsWith('node_modules/tiktok-live-connector'))?.[1];
    expect(tt?.version).toBe('2.4.0');
    expect(tt?.license).toBe('MIT');
  });
});
