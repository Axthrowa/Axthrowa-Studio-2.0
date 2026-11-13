import { describe, expect, it } from 'vitest';
import { begenileriYukle, istekSiniri, kullaniciEngelli, odenenleriYukle, ucretDurumu, type IstekYapan } from './istek-kurallari.js';

const k = (o: Partial<IstekYapan> = {}): IstekYapan => ({ username: 'ali', displayName: 'Ali', isMod: false, isSub: false, isVip: false, isBroadcaster: false, ...o });

describe('şarkı isteği kuralları (B6)', () => {
  it('seviyeye göre sınır; boş ayar izleyici sınırına düşer, 0 sınırsız', () => {
    const a = { izleyici: '1', abone: '3', vip: '' };
    expect(istekSiniri(k(), a)).toBe(1);
    expect(istekSiniri(k({ isSub: true }), a)).toBe(3);
    expect(istekSiniri(k({ isVip: true }), a)).toBe(1);
    expect(istekSiniri(k({ isSub: true }), { ...a, abone: '0' })).toBe(0);
    expect(istekSiniri(k({ isMod: true }), a)).toBe(0);
    expect(istekSiniri(k(), { izleyici: '', abone: '', vip: '' })).toBe(2);
  });
  it('kullanıcı engel listesi; mod engellenmez', () => {
    expect(kullaniciEngelli(k(), '@ALI\nveli')).toBe(true);
    expect(kullaniciEngelli(k({ username: 'ayse', displayName: 'Ayse' }), 'ali, veli')).toBe(false);
    expect(kullaniciEngelli(k({ isMod: true }), 'ali')).toBe(false);
  });
  it('ücret: yetmeyen bakiyede neden yazılır, yayıncı ödemez', () => {
    expect(ucretDurumu(k(), 50, 20)).toEqual({ neden: 'şarkı isteği 50 puan, sende 20 var' });
    expect(ucretDurumu(k(), 50, 80)).toEqual({ ucret: 50 });
    expect(ucretDurumu(k({ isBroadcaster: true }), 50, 0)).toEqual({ ucret: 0 });
    expect(ucretDurumu(k(), 0, 0)).toEqual({ ucret: 0 });
  });
});

describe('K4 kalıcı yükleme', () => {
  it('ödemelerden yalnız sırada bekleyen ve geçerli olanlar geri gelir', () => {
    const m = odenenleriYukle(
      [['a', { kullanici: 'ali', ucret: 50 }], ['b', { kullanici: 'veli', ucret: 20 }], ['c', { kullanici: 'x', ucret: -3 }], 'bozuk'],
      (id) => id !== 'b'
    );
    expect([...m]).toEqual([['a', { kullanici: 'ali', ucret: 50 }]]);
    expect(odenenleriYukle(null, () => true).size).toBe(0);
  });

  it('beğeniler kişi kümesi olarak geri gelir', () => {
    const m = begenileriYukle([['Şarkı', ['ali', 'veli']], [5, []], 'bozuk']);
    expect(m.get('Şarkı')).toEqual(new Set(['ali', 'veli']));
    expect(m.size).toBe(1);
  });
});
