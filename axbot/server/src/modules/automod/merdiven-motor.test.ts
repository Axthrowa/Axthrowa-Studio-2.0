import { beforeEach, describe, expect, it, vi } from 'vitest';

const ayar = {
  id: 1, repeat_enabled: 1, repeat_count: 2, repeat_window: 60, repeat_action: 'warn', repeat_timeout: 60, repeat_message: 'Tekrar yazma', repeat_bypass: '[]',
  caps_enabled: 0, emotes_enabled: 0, links_enabled: 0, symbols_enabled: 0, blacklist_words: '[]', links_whitelist: '[]'
};
const gelismis = JSON.stringify({ merdiven_acik: true, merdiven_pencere_dk: 30 });

vi.mock('../../db/index.js', () => ({
  db: {
    prepare: (sql: string) => ({
      get: () => (sql.includes('automod_settings') ? ayar : sql.includes('automod_advanced') ? { value: gelismis } : undefined),
      all: () => [],
      run: () => ({})
    }),
    exec: () => {}
  }
}));
vi.mock('../commands/command-manager.js', () => ({ commandManager: { isPermitted: () => false } }));
const timeoutUser = vi.fn(async (_ad: string, _sn: number) => ({ ok: true }));
vi.mock('../../platforms/manager.js', () => ({ platformManager: { getPlatform: () => ({ timeoutUser, banUser: vi.fn(async () => ({ ok: true })) }) } }));

describe('ceza merdiveni motorda', () => {
  beforeEach(() => timeoutUser.mockClear());

  it('aynı mesajı üç kez yazan ikinci basamağa (1 dk) çıkar', async () => {
    const { autoMod } = await import('./automod.js');
    const msg = (id: string) => ({
      id, platform: 'kick' as const, channel: 'k', message: 'aynı mesaj', timestamp: Date.now(),
      user: { id: 'u1', username: 'testci', displayName: 'Testci', badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false }
    });
    const sonuclar = [];
    for (const id of ['1', '2', '3']) {
      const ihlal = autoMod.checkMessage(msg(id));
      sonuclar.push(ihlal?.rule ?? null);
      if (ihlal) await autoMod.ihlaliUygula(msg(id), ihlal);
    }
    expect(sonuclar).toEqual([null, 'repeat', 'repeat']);
    // 1. ihlal uyarı (susturma yok), 2. ihlal 60 sn
    expect(timeoutUser).toHaveBeenCalledTimes(1);
    expect(timeoutUser.mock.calls[0][1]).toBe(60);
  });
});
