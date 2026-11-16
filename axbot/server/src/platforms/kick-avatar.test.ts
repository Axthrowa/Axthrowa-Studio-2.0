/**
 * Kick avatarı: kimlik biliniyorsa resmi API, değilse kanal verisi; jeton kanal adresine gitmez.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('axios', () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, run: () => undefined, all: () => [] }), exec: () => undefined } }));

import { kickPlatform } from './kick.js';
const k = kickPlatform as any;

describe('Kick avatarBul', () => {
  beforeEach(() => {
    get.mockReset();
    k.botToken = 'bot';
    k.kanalToken = '';
    k.kullaniciKimlikleri.clear();
  });

  it('sohbetten öğrenilen kimlikle resmi API sorulur', async () => {
    k.kullaniciKimlikleri.set('ali', 42);
    get.mockResolvedValue({ data: { data: [{ profile_picture: 'https://files.kick.com/a.webp' }] } });
    expect(await kickPlatform.avatarBul('Ali')).toBe('https://files.kick.com/a.webp');
    expect(get.mock.calls[0][0]).toBe('https://api.kick.com/public/v1/users');
    expect(get.mock.calls[0][1].params).toEqual({ id: 42 });
  });

  it('resmi API başarısızsa kanal verisine düşer; jeton oraya gönderilmez, _ tireye çevrilir', async () => {
    k.kullaniciKimlikleri.set('ali_veli', 42);
    get.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ data: { user: { profile_pic: 'https://files.kick.com/b.webp' } } });
    expect(await kickPlatform.avatarBul('ali_veli')).toBe('https://files.kick.com/b.webp');
    expect(get.mock.calls[1][0]).toBe('https://kick.com/api/v2/channels/ali-veli');
    expect(get.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('kimlik yoksa resmi API sorulmaz', async () => {
    get.mockResolvedValue({ data: {} });
    expect(await kickPlatform.avatarBul('yeni')).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toContain('/channels/yeni');
  });
});
