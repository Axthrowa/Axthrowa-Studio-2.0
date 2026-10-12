import { describe, expect, it } from 'vitest';
import {
  ayarlariDuzelt,
  beklemeKalan,
  istekBul,
  komutNormalize,
  kovadanSec,
  sureSiniri,
  VARSAYILAN_AYARLAR,
  yetkiVar,
  type PanoKovasi,
  type PanoOgesi
} from './mantik.js';

const oge = (x: Partial<PanoOgesi>): PanoOgesi => ({
  id: 'o',
  ad: 'Ö',
  komut: 'o',
  medyaId: 'm',
  tur: 'audio',
  gorselId: null,
  ses: 80,
  maksSureSn: 0,
  maliyet: 100,
  beklemeSn: 10,
  kullaniciBeklemeSn: 30,
  yetki: 'herkes',
  kovaId: null,
  agirlik: 1,
  etkin: true,
  sira: 0,
  ...x
});

describe('pano mantığı', () => {
  it('sohbet adı normalize edilir (Türkçe küçük harf, tire)', () => {
    expect(komutNormalize('  Davul SESİ!! ')).toBe('davul-sesi');
    expect(komutNormalize('İğne')).toBe('iğne');
    expect(komutNormalize('a'.repeat(50))).toHaveLength(32);
  });

  it('istek öğe önce, sonra kova; kapalı olan bulunmaz', () => {
    const o = [oge({ id: 'a', komut: 'davul' }), oge({ id: 'b', komut: 'kapali', etkin: false })];
    const k: PanoKovasi[] = [{ id: 'k', ad: 'Rastgele', komut: 'rastgele', maliyet: 50, beklemeSn: 0, etkin: true }];
    expect(istekBul(o, k, 'DAVUL')).toEqual({ tur: 'oge', oge: o[0] });
    expect(istekBul(o, k, 'rastgele')?.tur).toBe('kova');
    expect(istekBul(o, k, 'kapali')).toBeNull();
    expect(istekBul(o, k, '')).toBeNull();
  });

  it('kova ağırlıklı seçer; boş kova null', () => {
    const o = [oge({ id: 'a', kovaId: 'k', agirlik: 1 }), oge({ id: 'b', kovaId: 'k', agirlik: 3 }), oge({ id: 'c', kovaId: 'x' })];
    expect(kovadanSec(o, 'k', () => 0.1)?.id).toBe('a');
    expect(kovadanSec(o, 'k', () => 0.3)?.id).toBe('b');
    expect(kovadanSec(o, 'k', () => 0.999)?.id).toBe('b');
    expect(kovadanSec(o, 'yok')).toBeNull();
  });

  it('yetki: mod/yayıncı her şeyi, abone/VIP abone öğelerini', () => {
    const izleyici = { isMod: false, isSub: false, isBroadcaster: false };
    expect(yetkiVar('herkes', izleyici)).toBe(true);
    expect(yetkiVar('abone', izleyici)).toBe(false);
    expect(yetkiVar('abone', { ...izleyici, isVip: true })).toBe(true);
    expect(yetkiVar('mod', { ...izleyici, isSub: true })).toBe(false);
    expect(yetkiVar('mod', { ...izleyici, isBroadcaster: true })).toBe(true);
  });

  it('bekleme: en uzun kalan neden döner', () => {
    const t = 1_000_000;
    const b = (genelSon?: number, hedefSon?: number, kullaniciSon?: number) =>
      beklemeKalan({ simdi: t, genelSon, hedefSon, kullaniciSon, genelBeklemeSn: 5, hedefBeklemeSn: 10, kullaniciBeklemeSn: 30 });
    expect(b()).toEqual({ kalanSn: 0, neden: null });
    expect(b(t - 2000)).toEqual({ kalanSn: 3, neden: 'genel' });
    expect(b(t - 2000, t - 1000)).toEqual({ kalanSn: 9, neden: 'hedef' });
    expect(b(undefined, undefined, t - 10_000)).toEqual({ kalanSn: 20, neden: 'kullanici' });
  });

  it('süre sınırı öğe ve genel sınırın küçüğü', () => {
    expect(sureSiniri({ maksSureSn: 0 }, { maksSureSn: 15 })).toBe(15);
    expect(sureSiniri({ maksSureSn: 8 }, { maksSureSn: 15 })).toBe(8);
    expect(sureSiniri({ maksSureSn: 60 }, { maksSureSn: 15 })).toBe(15);
  });

  it('ayarlar doğrulanır; bozuk alan varsayılana döner', () => {
    expect(ayarlariDuzelt(undefined)).toEqual(VARSAYILAN_AYARLAR);
    const a = ayarlariDuzelt({ kuyrukSiniri: 500, maksSureSn: 'x', gorunum: { konum: 'uzay', genislikYuzde: 5 } });
    expect([a.kuyrukSiniri, a.maksSureSn, a.gorunum.konum, a.gorunum.genislikYuzde]).toEqual([100, 15, 'orta', 10]);
  });
});
