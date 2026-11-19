import { describe, expect, it } from 'vitest';
import { geriSayim, kalanSure, saateKalan, sureMs, sureYazisi } from './geri-sayim.js';

describe('geri sayım', () => {
  it('süre yazımlarını çözer', () => {
    expect(sureMs('10m')).toBe(600_000);
    expect(sureMs('90s')).toBe(90_000);
    expect(sureMs('1h30m')).toBe(5_400_000);
    expect(sureMs('1sa 5dk')).toBe(3_900_000);
    expect(sureMs('15')).toBe(900_000);
    expect(sureMs('2,5')).toBe(150_000);
    expect(sureMs('yarın')).toBeNull();
    expect(sureMs('')).toBeNull();
    expect(sureMs('0')).toBeNull();
  });

  it('saat hedefini bugüne ya da yarına koyar', () => {
    const simdi = new Date(2026, 10, 18, 19, 0, 0);
    expect(saateKalan('20:30', simdi)).toBe(90 * 60_000);
    expect(saateKalan('18:00', simdi)).toBe(23 * 3600_000);
    expect(saateKalan('25:00', simdi)).toBeNull();
    expect(saateKalan('10m', simdi)).toBeNull();
  });

  it('süreyi okunur yazar', () => {
    expect(sureYazisi(65_000)).toBe('1:05');
    expect(sureYazisi(3_725_000)).toBe('1:02:05');
    expect(sureYazisi(400)).toBe('0:01');
    expect(sureYazisi(-5)).toBe('0:00');
  });

  it('komutla başlar, uzar, duraklar ve kapanır', () => {
    const t0 = new Date(2026, 10, 18, 19, 0, 0);
    expect(geriSayim.komut(['10m', 'Yayın', 'başlıyor'], t0)).toContain('10:00');
    let d = geriSayim.durum();
    expect(d.baslik).toBe('Yayın başlıyor');
    expect(kalanSure(d, t0.getTime())).toBe(600_000);

    const t1 = new Date(t0.getTime() + 60_000);
    expect(geriSayim.komut(['+2m'], t1)).toContain('11:00');
    expect(geriSayim.komut(['duraklat'], t1)).toContain('duraklatıldı');
    d = geriSayim.durum();
    expect(d.bitis).toBeNull();
    expect(kalanSure(d, t1.getTime() + 999_999)).toBe(660_000);

    const t2 = new Date(t1.getTime() + 300_000);
    geriSayim.komut(['devam'], t2);
    expect(kalanSure(geriSayim.durum(), t2.getTime())).toBe(660_000);

    expect(geriSayim.komut(['dur'], t2)).toContain('kapatıldı');
    expect(kalanSure(geriSayim.durum(), t2.getTime())).toBe(0);
    expect(geriSayim.komut(['+1m'], t2)).toContain('Önce');
    expect(geriSayim.komut(['abc'], t2)).toContain('anlaşılmadı');
  });
});
