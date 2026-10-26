import { describe, expect, it, vi } from 'vitest';

// Kanal tablosu: twitch etkin. Diğer modüllerin açılış sorguları boş döner.
vi.mock('../db/index.js', () => ({
  db: {
    prepare: (sql: string) => ({
      get: (ad?: string) => (sql.includes('FROM channels WHERE platform = ? AND is_active = 1') ? (ad === 'twitch' ? { 1: 1 } : undefined) : undefined),
      all: () => [],
      run: () => ({ changes: 0 })
    }),
    exec: () => {}
  }
}));

import { beklemeMs, denenmeli } from './bekci.js';
import { PlatformManager } from './manager.js';

describe('yeniden bağlanma bekçisi', () => {
  it('ilk kopuşta hemen denenir, başarısızlıkta bekleme iki katına çıkar (en fazla 10 dk)', () => {
    expect(denenmeli(undefined, 0)).toBe(true);
    expect(beklemeMs(0)).toBe(60_000);
    expect(beklemeMs(1)).toBe(120_000);
    expect(beklemeMs(3)).toBe(480_000);
    expect(beklemeMs(9)).toBe(600_000);
  });

  it('bekleme dolmadan yeniden denenmez', () => {
    const d = { hata: 2, sonDeneme: 1_000_000 };
    expect(denenmeli(d, 1_000_000 + 239_999)).toBe(false);
    expect(denenmeli(d, 1_000_000 + 240_000)).toBe(true);
  });

  it('etkin ama kopuk platformu yeniden bağlar; başarısızlıkta bir dakika bekler', async () => {
    const m = new PlatformManager();
    let bagli = false;
    const connect = vi.fn(async () => false);
    m.register({ name: 'twitch', isConnected: () => bagli, connect, disconnect: async () => {} } as any);
    // tiktok kanal tablosunda etkin değil: dokunulmaz
    const tiktokConnect = vi.fn(async () => true);
    m.register({ name: 'tiktok', isConnected: () => false, connect: tiktokConnect, disconnect: async () => {} } as any);

    await m.bekciTuru(0);
    expect(connect).toHaveBeenCalledTimes(1);
    await m.bekciTuru(30_000); // bekleme dolmadı
    expect(connect).toHaveBeenCalledTimes(1);
    connect.mockResolvedValueOnce(true);
    await m.bekciTuru(60_000);
    expect(connect).toHaveBeenCalledTimes(2);
    bagli = true;
    await m.bekciTuru(120_000); // bağlı: dokunulmaz
    expect(connect).toHaveBeenCalledTimes(2);
    expect(tiktokConnect).not.toHaveBeenCalled();
  });
});
