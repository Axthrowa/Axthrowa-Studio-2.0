/**
 * `type: bot` ile gönderilen mesajın yankısı botun kendi mesajı sayılır; izleyicinin aynı metni sayılmaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('axios', () => ({ default: { post: (...a: unknown[]) => post(...a), get: vi.fn(), delete: vi.fn() } }));
vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, run: () => undefined, all: () => [] }) } }));

import { eventBus } from '../core/event-bus.js';
import { kickPlatform } from './kick.js';
const k = kickPlatform as any;

const gelen = (ad: string, id: string, senderId = 99) => {
  const emit = vi.spyOn(eventBus, 'emitChat').mockImplementation(() => {});
  k.handleChatMessage({ id, content: 'selam', sender: { id: senderId, username: ad, identity: {} } }, 'kanal');
  const self = emit.mock.calls[0][0].user.isSelf;
  emit.mockRestore();
  return self;
};

describe('Kick bot türü yankısı', () => {
  beforeEach(() => {
    post.mockReset();
    k.botToken = 'bot';
    k.broadcasterUserId = 5;
    k.chatroomId = 6;
    k.botUserId = 1;
    k.botUsername = 'yayinci';
  });
  afterEach(() => {
    k.botTuruGonderilen.clear();
    k.yayinciTuruGonderilen.clear();
  });

  it('ilk yankı botundur, aynı metni yazan izleyici değildir', async () => {
    post.mockImplementation(async (_u: string, govde: { type: string }) => {
      if (govde.type === 'user') throw { response: { status: 403 } };
      return { status: 200 };
    });
    const r = await k.sendKickMessage('kanal', 'selam');
    expect(r.success).toBe(true);
    expect(gelen('kick_uygulama_botu', 'a')).toBe(true);
    expect(gelen('izleyici', 'b')).toBe(false);
  });

  it('kullanıcı türüyle gönderimde izleyici bot sayılmaz, yayıncı yankısı sayılır', async () => {
    post.mockResolvedValue({ status: 200 });
    await k.sendKickMessage('kanal', 'selam');
    expect(gelen('yayinci', 'c', 5)).toBe(true);
    await k.sendKickMessage('kanal', 'selam');
    expect(gelen('izleyici', 'd')).toBe(false);
  });
});
