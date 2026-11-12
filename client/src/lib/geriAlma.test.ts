import { describe, expect, it } from 'vitest';
import { GERI_ALMA_SINIRI, geriAlHedefi, kayitEkle, yaziAlaniMi } from './geriAlma';

describe('geri alma yığını (A4)', () => {
  it('kaydedilmemiş değişiklik önce atılır, sonra son kayıt geri alınır', () => {
    let yigin: number[] = [];
    yigin = kayitEkle(yigin, 1); // 1 → 2 kaydedildi
    yigin = kayitEkle(yigin, 2); // 2 → 3 kaydedildi
    expect(geriAlHedefi(yigin, 3, true)).toEqual({ hedef: 3, yigin: [1, 2] });
    const ilk = geriAlHedefi(yigin, 3, false)!;
    expect(ilk).toEqual({ hedef: 2, yigin: [1] });
    expect(geriAlHedefi(ilk.yigin, 2, false)).toEqual({ hedef: 1, yigin: [] });
    expect(geriAlHedefi([], 1, false)).toBeNull();
  });

  it('yığın sınırı aşılınca en eski kayıt düşer', () => {
    let yigin: number[] = [];
    for (let i = 0; i < GERI_ALMA_SINIRI + 5; i++) yigin = kayitEkle(yigin, i);
    expect(yigin).toHaveLength(GERI_ALMA_SINIRI);
    expect(yigin[0]).toBe(5);
  });

  it('metin kutusunda Ctrl+Z tarayıcıya kalır, anahtar ve seçimde bize gelir', () => {
    expect(yaziAlaniMi({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(yaziAlaniMi({ tagName: 'TEXTAREA' })).toBe(true);
    expect(yaziAlaniMi({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(yaziAlaniMi({ tagName: 'SELECT' })).toBe(false);
    expect(yaziAlaniMi({ tagName: 'BUTTON' })).toBe(false);
    expect(yaziAlaniMi(null)).toBe(false);
  });
});
