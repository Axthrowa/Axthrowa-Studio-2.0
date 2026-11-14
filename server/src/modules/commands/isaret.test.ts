import { describe, expect, it } from 'vitest';
import { isaretYaniti } from './isaret.js';

describe('isaretYaniti (U6)', () => {
  it('başarılı olanları birleştirir', () => {
    expect(isaretYaniti({ ok: true, tekrar: true }, { ok: true })).toBe("📍 İşaretlendi: tekrar kaydedildi, Twitch'e işaret kondu.");
    expect(isaretYaniti({ ok: true }, null)).toBe("📍 İşaretlendi: Studio'ya yazıldı.");
    expect(isaretYaniti({ ok: false, hata: 'OBS kapalı' }, { ok: true })).toBe("📍 İşaretlendi: Twitch'e işaret kondu.");
  });
  it('hiçbiri olmazsa nedenleri yazar', () => {
    expect(isaretYaniti(null, null)).toBe('İşaret konamadı: AxthrowA Studio açık değil');
    expect(isaretYaniti({ ok: false, hata: 'OBS kapalı' }, { ok: false, hata: 'yetki' })).toBe('İşaret konamadı: Studio: OBS kapalı · Twitch: yetki');
  });
});
