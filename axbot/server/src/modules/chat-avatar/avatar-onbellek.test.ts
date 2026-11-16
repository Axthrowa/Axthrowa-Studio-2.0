import { describe, expect, it, vi } from 'vitest';
import { AvatarOnbellek, avatarIstegiGecerli } from './avatar-onbellek.js';

const URL = 'https://files.kick.com/images/user/1/profile.webp';

describe('avatar isteği', () => {
  it('yalnız sohbette avatar taşımayan platformlar ve güvenli adlar', () => {
    expect(avatarIstegiGecerli('kick', 'ali_veli-1')).toBe(true);
    expect(avatarIstegiGecerli('twitch', 'AliVeli')).toBe(true);
    expect(avatarIstegiGecerli('youtube', 'ali')).toBe(false);
    expect(avatarIstegiGecerli('kick', '../../x')).toBe(false);
    expect(avatarIstegiGecerli('kick', 'a?b=1')).toBe(false);
    expect(avatarIstegiGecerli('kick', '')).toBe(false);
    expect(avatarIstegiGecerli('kick', 'a'.repeat(41))).toBe(false);
  });
});

describe('avatar önbelleği', () => {
  it('aynı kullanıcı için tek istek atar, büyük harf ayrı sayılmaz', async () => {
    const bul = vi.fn(async () => URL);
    const o = new AvatarOnbellek(bul);
    const [a, b] = await Promise.all([o.getir('kick', 'Ali'), o.getir('kick', 'ali')]);
    await o.getir('kick', 'ali');
    expect([a, b]).toEqual([URL, URL]);
    expect(bul).toHaveBeenCalledTimes(1);
  });

  it('platformlar birbirine karışmaz', async () => {
    const bul = vi.fn(async (p: string) => `https://cdn.ornek/${p}.png`);
    const o = new AvatarOnbellek(bul);
    expect(await o.getir('kick', 'ali')).toContain('kick');
    expect(await o.getir('twitch', 'ali')).toContain('twitch');
  });

  it('https olmayan adresi reddeder', async () => {
    const o = new AvatarOnbellek(async () => 'javascript:alert(1)');
    expect(await o.getir('kick', 'ali')).toBeNull();
    const h = new AvatarOnbellek(async () => 'http://site/a.png');
    expect(await h.getir('kick', 'ali')).toBeNull();
  });

  it('bulunamayan ve hata veren kullanıcıyı bir süre yeniden sormaz, süre dolunca sorar', async () => {
    let t = 0;
    const bul = vi.fn(async () => {
      throw new Error('403');
    });
    const o = new AvatarOnbellek(bul, () => t);
    expect(await o.getir('kick', 'ali')).toBeNull();
    t += 60_000;
    expect(await o.getir('kick', 'ali')).toBeNull();
    expect(bul).toHaveBeenCalledTimes(1);
    t += 60 * 60_000;
    await o.getir('kick', 'ali');
    expect(bul).toHaveBeenCalledTimes(2);
  });

  it('bulunan avatar süre dolunca yenilenir (kullanıcı resmini değiştirebilir)', async () => {
    let t = 0;
    const bul = vi.fn(async () => URL);
    const o = new AvatarOnbellek(bul, () => t);
    await o.getir('kick', 'ali');
    t += 5 * 60 * 60_000;
    await o.getir('kick', 'ali');
    expect(bul).toHaveBeenCalledTimes(1);
    t += 2 * 60 * 60_000;
    await o.getir('kick', 'ali');
    expect(bul).toHaveBeenCalledTimes(2);
  });

  it('kalabalık sohbette aynı anda en çok 3 istek atar', async () => {
    let anlik = 0;
    let enCok = 0;
    const o = new AvatarOnbellek(async () => {
      anlik++;
      enCok = Math.max(enCok, anlik);
      await new Promise((r) => setTimeout(r, 2));
      anlik--;
      return URL;
    });
    const sonuc = await Promise.all(Array.from({ length: 12 }, (_, i) => o.getir('kick', `u${i}`)));
    expect(enCok).toBeLessThanOrEqual(3);
    expect(sonuc.every((s) => s === URL)).toBe(true);
  });

  it('önbellek sınırsız büyümez', async () => {
    const bul = vi.fn(async () => URL);
    const o = new AvatarOnbellek(bul, Date.now, 2);
    await o.getir('kick', 'a');
    await o.getir('kick', 'b');
    await o.getir('kick', 'c');
    await o.getir('kick', 'c');
    expect(bul).toHaveBeenCalledTimes(3);
    await o.getir('kick', 'a');
    expect(bul).toHaveBeenCalledTimes(4);
  });
});
