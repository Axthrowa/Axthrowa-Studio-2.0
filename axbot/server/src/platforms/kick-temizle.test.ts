/**
 * Kick sohbet temizleme: `/clear` işlenirse yeter; işlenmezse iletiler resmi uçla tek tek silinir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const del = vi.fn();
vi.mock('axios', () => ({ default: { post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a), get: vi.fn() } }));
vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, run: () => undefined, all: () => [] }), exec: () => undefined } }));

import { kickPlatform } from './kick.js';
const k = kickPlatform as any;

describe('Kick sohbetiTemizle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    post.mockReset();
    del.mockReset();
    k.botToken = 'bot';
    k.kanalToken = 'kanal';
    k.kanalBitis = 0;
    k.broadcasterUserId = 5;
  });
  afterEach(() => vi.useRealTimers());

  it('komut işlenince tek tek silmez ve kanal girişini kullanır', async () => {
    post.mockImplementation(async () => {
      setTimeout(() => k.temizlemeBekleyen?.(), 100);
      return { status: 200 };
    });
    const p = kickPlatform.sohbetiTemizle(() => ['a']);
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toEqual({ ok: true, yontem: 'komut' });
    expect(post.mock.calls[0][1].content).toBe('/clear');
    expect(post.mock.calls[0][2].headers.Authorization).toBe('Bearer kanal');
    expect(del).not.toHaveBeenCalled();
  });

  it('olay gelmezse iletileri tek tek siler', async () => {
    post.mockResolvedValue({ status: 200 });
    del.mockResolvedValue({ status: 204 });
    const p = kickPlatform.sohbetiTemizle(() => ['a', 'b']);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p).toEqual({ ok: true, yontem: 'tek-tek', silinenIdler: ['a', 'b'] });
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('yenilenemeyen kanal girişi bırakılır, bot hesabı kullanılır', async () => {
    k.kanalBitis = 1; // süresi çoktan dolmuş; yenileme jetonu da yok
    post.mockImplementation(async () => {
      setTimeout(() => k.temizlemeBekleyen?.(), 100);
      return { status: 200 };
    });
    const p = kickPlatform.sohbetiTemizle(() => []);
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(post.mock.calls[0][2].headers.Authorization).toBe('Bearer bot');
  });

  it('jeton yoksa denemez', async () => {
    k.botToken = '';
    k.kanalToken = '';
    expect((await kickPlatform.sohbetiTemizle(() => [])).ok).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
