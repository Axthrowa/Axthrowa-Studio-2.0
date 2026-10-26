import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({}) }), exec: () => {} } }));

import { eventBus } from '../core/event-bus.js';
import { TrovoPlatform } from './trovo.js';

describe('Trovo bağlanma geçmişi', () => {
  it('bağlanmadan önce gönderilmiş mesajları yeniden işlemez', () => {
    const t = new TrovoPlatform() as any;
    const gelen = vi.spyOn(eventBus, 'emitChat').mockImplementation(() => {});
    t.baglandiAn = 1_000_000_000_000;
    const sohbet = (sn: number) => ({ type: 0, content: '!puan', user_name: 'ali', message_id: String(sn), send_time: sn });
    t.tekSohbet(sohbet(1_000_000_000 - 60)); // bir dakika önce: geçmiş
    expect(gelen).not.toHaveBeenCalled();
    t.tekSohbet(sohbet(1_000_000_000 + 1)); // bağlandıktan sonra
    expect(gelen).toHaveBeenCalledTimes(1);
  });
});
