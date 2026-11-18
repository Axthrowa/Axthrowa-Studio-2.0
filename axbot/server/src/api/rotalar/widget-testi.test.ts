import { describe, expect, it, vi } from 'vitest';

const yayin = vi.fn();
const uyari = vi.fn();
vi.mock('../../ws/server.js', () => ({ wsHub: { broadcastTo: (...a: unknown[]) => yayin(...a), triggerTestAlert: (...a: unknown[]) => uyari(...a) } }));
import { testSecenegi, widgetTesti } from './widgetlar.js';

describe('WID-8 test olayı seçenekleri', () => {
  it('yalnız bilinen platform, kırpılmış ad ve mesaj geçer', () => {
    expect(testSecenegi({ platform: 'twitch', kullanici: '  Ad  ', mesaj: 'x'.repeat(900) })).toEqual({ platform: 'twitch', kullanici: 'Ad', mesaj: 'x'.repeat(500) });
    expect(testSecenegi({ platform: 'myspace', kullanici: 5, mesaj: '   ' })).toEqual({ platform: undefined, kullanici: undefined, mesaj: undefined });
    expect(testSecenegi(undefined)).toEqual({ platform: undefined, kullanici: undefined, mesaj: undefined });
  });
  it('uyarı testine seçenekler iletilir', () => {
    widgetTesti('alert-box', { platform: 'youtube', kullanici: 'Uzun' });
    expect(uyari).toHaveBeenLastCalledWith('follow', undefined, { platform: 'youtube', kullanici: 'Uzun', mesaj: undefined });
  });
  it('sohbet testi seçilen platform ve adla gelir', () => {
    widgetTesti('chat-overlay', { platform: 'tiktok', kullanici: 'Deneme' });
    const ileti = yayin.mock.calls.map((c) => c[1]).find((m: any) => m?.type === 'chat') as any;
    expect(ileti.data).toMatchObject({ platform: 'tiktok', user: { displayName: 'Deneme', username: 'deneme' } });
  });
  it('atla testi kartı önce oylu, sonra atlanmış gösterir', () => {
    vi.useFakeTimers();
    yayin.mockClear();
    widgetTesti('atla', {});
    vi.advanceTimersByTime(1600);
    const kartlar = yayin.mock.calls.map((c) => c[1]).filter((m: any) => m?.type === 'atla') as any[];
    expect(kartlar.map((k) => k.data.skipped)).toEqual([false, true]);
    vi.useRealTimers();
  });
});
