import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

const soketler: SahteSoket[] = [];
class SahteSoket extends EventEmitter {
  send() {}
  close() {}
  constructor() {
    super();
    soketler.push(this);
  }
}
vi.mock('ws', () => ({ default: SahteSoket }));
vi.mock('../db/index.js', () => ({
  db: { prepare: () => ({ get: () => ({ channel_name: 'kanal', token: 'x', account_id: 'bot' }), all: () => [], run: () => ({}) }) }
}));

describe('Twitch yeniden bağlanma', () => {
  it('eski soketin geç gelen kapanışı yeni bağlantıyı kopmuş göstermez', async () => {
    const { TwitchPlatform } = await import('./twitch.js');
    const t = new TwitchPlatform();
    const ilk = t.connect();
    soketler[0].emit('open');
    await ilk;
    await t.disconnect();
    const ikinci = t.connect();
    soketler[1].emit('open');
    await ikinci;
    soketler[0].emit('close');
    expect(t.isConnected()).toBe(true);
    soketler[1].emit('close');
    expect(t.isConnected()).toBe(false);
  });
});
