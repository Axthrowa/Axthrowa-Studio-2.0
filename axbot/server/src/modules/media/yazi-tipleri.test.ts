import { describe, expect, it } from 'vitest';
import { yaziAdi, yaziBicimi, yaziTipleri } from './yazi-tipleri.js';

const ttf = Buffer.concat([Buffer.from([0, 1, 0, 0]), Buffer.alloc(60)]);

describe('yazı tipleri (WID-5)', () => {
  it('biçim içerikten; HTML ya da PNG reddedilir', () => {
    expect(yaziBicimi(ttf)).toBe('ttf');
    expect(yaziBicimi(Buffer.from('wOF2________'))).toBe('woff2');
    expect(yaziBicimi(Buffer.from('OTTO________'))).toBe('otf');
    expect(yaziBicimi(Buffer.from('<html><script>'))).toBeNull();
  });

  it('ad CSS tırnağını kıramaz', () => {
    expect(yaziAdi('Benim"}body{x:y Font.ttf')).toBe('Benim body x y Font');
    expect(yaziAdi('  .ttf ')).toBe('');
  });

  it('ekle → listede, CSS kuralı, aynı ad üzerine yazar, sil', () => {
    const r = yaziTipleri.ekle('Deneme Yazı.ttf', ttf.toString('base64'));
    expect(r.ok).toBe(true);
    const id = r.ok ? r.oge.id : '';
    expect(yaziTipleri.css()).toContain(`font-family:"Deneme Yazı";src:url("/api/fonts/${id}/dosya`);
    const r2 = yaziTipleri.ekle('Deneme Yazı', ttf.toString('base64'));
    expect(r2.ok && r2.oge.id).toBe(id);
    expect(yaziTipleri.listele()).toHaveLength(1);
    expect(yaziTipleri.dosya(id)?.mime).toBe('font/ttf');
    expect(yaziTipleri.ekle('x', Buffer.from('<svg onload=1>xxxxxxxx').toString('base64')).ok).toBe(false);
    expect(yaziTipleri.sil(id)).toBe(true);
    expect(yaziTipleri.listele()).toHaveLength(0);
  });
});
