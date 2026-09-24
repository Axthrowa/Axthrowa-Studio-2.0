/**
 * StreamAxT — widget ayarı doğrulaması testleri (B2)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { SINIRLAR, WIDGET_KIMLIGI, widgetAyariniTemizle } from './settings-validate.js';

describe('widget kimliği', () => {
  it('bilinen biçimler geçer, garip anahtarlar geçmez', () => {
    expect(WIDGET_KIMLIGI.test('alert-box')).toBe(true);
    expect(WIDGET_KIMLIGI.test('hype-train')).toBe(true);
    expect(WIDGET_KIMLIGI.test('../../x')).toBe(false);
    expect(WIDGET_KIMLIGI.test('')).toBe(false);
    expect(WIDGET_KIMLIGI.test('A'.repeat(60))).toBe(false);
  });
});

describe('widgetAyariniTemizle', () => {
  it('nesne olmayan gövde reddedilir', () => {
    expect(widgetAyariniTemizle([1, 2]).ok).toBe(false);
    expect(widgetAyariniTemizle('x').ok).toBe(false);
    expect(widgetAyariniTemizle(null).ok).toBe(false);
  });

  it('prototip kirletme anahtarları atılır (iç içe dahil)', () => {
    const g = JSON.parse('{"a":1,"__proto__":{"x":1},"ic":{"constructor":{"y":2},"b":2}}');
    const r = widgetAyariniTemizle(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.prototype.hasOwnProperty.call(r.deger, '__proto__')).toBe(false);
    expect((r.deger.ic as any).b).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(r.deger.ic, 'constructor')).toBe(false);
    expect(r.uyarilar.length).toBeGreaterThan(0);
  });

  it('sayı olan alana sayısal metin gelirse sayıya çevrilir', () => {
    const r = widgetAyariniTemizle({ fontSize: '24' }, { fontSize: 16 });
    expect(r.ok && r.deger.fontSize).toBe(24);
  });

  it('sayı olan alana anlamsız metin gelirse ESKİ değer korunur (NaN çizim olmasın)', () => {
    const r = widgetAyariniTemizle({ fontSize: 'abc' }, { fontSize: 16 });
    expect(r.ok && r.deger.fontSize).toBe(16);
    expect(r.ok && r.uyarilar[0]).toContain('fontSize');
  });

  it('mantıksal alan', () => {
    expect((widgetAyariniTemizle({ a: 'true' }, { a: false }) as any).deger.a).toBe(true);
    expect((widgetAyariniTemizle({ a: 0 }, { a: true }) as any).deger.a).toBe(false);
    expect((widgetAyariniTemizle({ a: 'belki' }, { a: true }) as any).deger.a).toBe(true);
  });

  it('YENİ alanlar serbest (widget gelişebilsin)', () => {
    const r = widgetAyariniTemizle({ yeniAlan: 'x', sayi: 5 }, {});
    expect(r.ok && r.deger).toEqual({ yeniAlan: 'x', sayi: 5 });
  });

  it('çok büyük gövde reddedilir', () => {
    const r = widgetAyariniTemizle({ b: 'x'.repeat(SINIRLAR.toplamBayt + 10) });
    expect(r.ok).toBe(false);
  });

  it('aşırı derinlik kesilir', () => {
    let d: any = { son: 1 };
    for (let i = 0; i < 20; i++) d = { d };
    const r = widgetAyariniTemizle({ derin: d });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.ok && r.deger).length).toBeLessThan(JSON.stringify({ derin: d }).length);
  });
});
