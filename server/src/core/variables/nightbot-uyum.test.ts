/**
 * Nightbot / KickBot uyum adları: oradan kopyalanan (ya da kickbotCevir'in ürettiği) komutlar
 * ham "$(user)" yazmasın.
 */
import { describe, expect, it, vi } from 'vitest';

// Bu değişkenler veritabanı kullanmaz; içe aktarılan modüllerin açılış sorguları boş döner
vi.mock('../../db/index.js', () => ({
  db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({ changes: 0 }) }), exec: () => {} }
}));
vi.mock('../../modules/tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));

import { kayitDefteriOlustur } from './registry.js';
import type { DegiskenBaglam } from './types.js';

const kayit = kayitDefteriOlustur();
const baglam = (kullanici: Partial<DegiskenBaglam['user']> = {}): DegiskenBaglam =>
  ({
    user: { username: 'ali', displayName: 'Ali', ...kullanici },
    platform: 'kick',
    channel: 'kanal',
    args: ['kuzu', 'kuzu'],
    rawArgs: 'kuzu kuzu & tarkan',
    commandName: '!sarki',
    yerel: new Map()
  }) as DegiskenBaglam;
const coz = (ad: string, c: DegiskenBaglam) => kayit.get(ad)!.isleyici('', c);

describe('Nightbot uyum değişkenleri', () => {
  it('$(user) komutu yazanın adı', async () => {
    expect(await coz('user', baglam())).toBe('Ali');
  });

  it('$(userlevel) Nightbot değerleri', async () => {
    expect(await coz('userlevel', baglam({ isBroadcaster: true }))).toBe('owner');
    expect(await coz('userlevel', baglam({ isMod: true }))).toBe('moderator');
    expect(await coz('userlevel', baglam({ isSub: true }))).toBe('subscriber');
    expect(await coz('userlevel', baglam())).toBe('everyone');
  });

  it('$(querystring) ve $(command)', async () => {
    expect(await coz('querystring', baglam())).toBe('kuzu%20kuzu%20%26%20tarkan');
    expect(await coz('command', baglam())).toBe('sarki');
  });
});
