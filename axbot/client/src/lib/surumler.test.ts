import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUNCEL_SURUM, SURUMLER } from './surumler.js';

describe('sürüm adları', () => {
  it('güncel sürüm package.json ile aynı ve her sürümün adı var', () => {
    const paket = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(GUNCEL_SURUM.surum).toBe(paket.version);
    for (const s of SURUMLER) expect(s.ad.length).toBeGreaterThan(0);
  });
});
