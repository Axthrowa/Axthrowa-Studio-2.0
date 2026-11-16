/**
 * Kalıcı soket kullanan her katman ya yeniden bağlanınca durumunu yeniden okur
 * ya da neden gerekmediğini yazar. Unutulan katman, bağlantı kopup gelince
 * eski durumu (devrilmiş kral, bitmiş anket…) yayında göstermeye devam ediyordu.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KLASOR = join(__dirname, '..', 'widgets');

describe('katmanlar yeniden bağlanmayı ele alır', () => {
  const dosyalar = readdirSync(KLASOR).filter((d) => d.endsWith('.tsx'));
  const soketli = dosyalar.filter((d) => readFileSync(join(KLASOR, d), 'utf8').includes('new KaliciSoket'));

  it('en az bir soketli katman bulunur', () => expect(soketli.length).toBeGreaterThan(5));

  it.each(soketli)('%s', (d) => {
    const kod = readFileSync(join(KLASOR, d), 'utf8');
    expect(kod.includes('onyenidenbaglandi') || kod.includes('// yeniden-baglanma: gerekmez')).toBe(true);
  });
});
