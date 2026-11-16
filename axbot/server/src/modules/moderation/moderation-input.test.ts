/**
 * AxBoT — elle moderasyon ve kalkan ayarı doğrulama testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { EN_UZUN_ZAMAN_ASIMI_SN, elleModerasyonCoz, kalkanAyariniCoz } from './moderation-input.js';

describe('elleModerasyonCoz', () => {
  it('geçerli ban isteği', () => {
    expect(elleModerasyonCoz({ platform: 'Kick', username: '@Spamci', sebep: 'reklam' }, 'ban')).toEqual({
      ok: true,
      platform: 'kick',
      ad: 'Spamci',
      sebep: 'reklam',
      saniye: 0
    });
  });

  it('bilinmeyen platform ve bozuk ad reddedilir', () => {
    expect(elleModerasyonCoz({ platform: 'myspace', username: 'a' }, 'ban').ok).toBe(false);
    for (const username of ['', '   ', 'ali veli', 'ali\tveli', 'x'.repeat(61), null]) {
      expect(elleModerasyonCoz({ platform: 'twitch', username }, 'ban').ok).toBe(false);
    }
  });

  it('zaman aşımı süresi varsayılan 10 dk, 14 günle sınırlı, 1 sn altı reddedilir', () => {
    const v = elleModerasyonCoz({ platform: 'twitch', username: 'a' }, 'timeout');
    expect(v.ok && v.saniye).toBe(600);
    const uzun = elleModerasyonCoz({ platform: 'twitch', username: 'a', saniye: 99_999_999 }, 'timeout');
    expect(uzun.ok && uzun.saniye).toBe(EN_UZUN_ZAMAN_ASIMI_SN);
    expect(elleModerasyonCoz({ platform: 'twitch', username: 'a', saniye: 0 }, 'timeout').ok).toBe(false);
    expect(elleModerasyonCoz({ platform: 'twitch', username: 'a', saniye: 'abc' }, 'timeout').ok).toBe(false);
  });

  it('sebep tek satıra indirilir ve kısaltılır; boşsa varsayılan', () => {
    const r = elleModerasyonCoz({ platform: 'kick', username: 'a', sebep: 'bir\niki\r\nüç' + 'x'.repeat(300) }, 'ban');
    expect(r.ok && r.sebep.includes('\n')).toBe(false);
    expect(r.ok && r.sebep.length).toBe(200);
    const bos = elleModerasyonCoz({ platform: 'kick', username: 'a' }, 'ban');
    expect(bos.ok && bos.sebep).toBe('Moderatör kararı');
  });
});

describe('kalkanAyariniCoz', () => {
  it('yalnız bilinen alanlar, türüyle; isActive geçmez', () => {
    expect(
      kalkanAyariniCoz({ blockLinks: false, subOnly: 'evet', isActive: true, karaListeEylemi: 'ban', __proto__: { x: 1 } })
    ).toEqual({ blockLinks: false, karaListeEylemi: 'ban' });
  });
  it('hesap yaşı 0–365 arasına sıkıştırılır', () => {
    expect(kalkanAyariniCoz({ minAccountAgeDays: 9999 }).minAccountAgeDays).toBe(365);
    expect(kalkanAyariniCoz({ minAccountAgeDays: -3 }).minAccountAgeDays).toBe(0);
    expect(kalkanAyariniCoz({ minAccountAgeDays: 'abc' }).minAccountAgeDays).toBeUndefined();
  });
  it('bilinmeyen kara liste eylemi atılır', () => {
    expect(kalkanAyariniCoz({ karaListeEylemi: 'patlat' })).toEqual({});
  });
  it('platformda silme seçeneği yalnız mantıksal değer olarak kabul edilir', () => {
    expect(kalkanAyariniCoz({ platformdaSil: true })).toEqual({ platformdaSil: true });
    expect(kalkanAyariniCoz({ platformdaSil: 'true' })).toEqual({});
  });
});
