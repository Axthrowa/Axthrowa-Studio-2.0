import { describe, expect, it } from 'vitest';
import { BasKonusKapisi, KUYRUK_MS, pttIletisi, seviye, SONUC_PAYI_MS } from './kapi.js';

describe('bas-konuş kapısı', () => {
  it('uyandırma ve ikisi kiplerinde ses hep akar', () => {
    const k = new BasKonusKapisi();
    expect(k.sesGecsin('uyandirma', 0)).toBe(true);
    expect(k.sesGecsin('ikisi', 0)).toBe(true);
  });

  it('bas-konuş kipinde yalnız basılıyken ve kısa kuyrukta akar', () => {
    const k = new BasKonusKapisi();
    expect(k.sesGecsin('bas_konus', 1000)).toBe(false);
    k.bas(1000);
    expect(k.sesGecsin('bas_konus', 1500)).toBe(true);
    k.birak(2000);
    expect(k.sesGecsin('bas_konus', 2000 + KUYRUK_MS - 1)).toBe(true);
    expect(k.sesGecsin('bas_konus', 2000 + KUYRUK_MS + 1)).toBe(false);
  });

  it('bırakmadan sonra gelen sonuç bas-konuş sayılır, çok sonra gelen sayılmaz', () => {
    const k = new BasKonusKapisi();
    expect(k.basKonusMu(0)).toBe(false);
    k.bas(100);
    expect(k.basKonusMu(200)).toBe(true);
    k.birak(300);
    expect(k.basKonusMu(300 + SONUC_PAYI_MS - 1)).toBe(true);
    expect(k.basKonusMu(300 + SONUC_PAYI_MS + 1)).toBe(false);
  });

  it('üst pencere iletisi yalnız beklenen biçimde kabul edilir', () => {
    expect(pttIletisi({ tur: 'sesli-ptt', basili: true })).toBe(true);
    expect(pttIletisi({ tur: 'sesli-ptt', basili: false })).toBe(false);
    expect(pttIletisi({ tur: 'sesli-ptt', basili: 'evet' })).toBeNull();
    expect(pttIletisi('sesli-ptt')).toBeNull();
    expect(pttIletisi(null)).toBeNull();
  });

  it('seviye ölçeği', () => {
    expect(seviye(new Float32Array(0))).toBe(0);
    expect(seviye(new Float32Array(100))).toBe(0);
    expect(seviye(new Float32Array(100).fill(1))).toBe(1);
    const yarim = seviye(new Float32Array(100).fill(0.03));
    expect(yarim).toBeGreaterThan(0.3);
    expect(yarim).toBeLessThan(0.6);
  });
});
