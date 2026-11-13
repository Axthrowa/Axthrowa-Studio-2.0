/**
 * B8: Kick'in gerçek zamanlı `RewardRedeemedEvent` olayı otomasyonun "ödül" tetiğini besleyen olaya çevrilir.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), delete: vi.fn(), request: vi.fn() } }));
vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, run: () => undefined, all: () => [] }) } }));

import { eventBus } from '../core/event-bus.js';
import { kickPlatform } from './kick.js';

describe('B8 Kick ödül kullanımı', () => {
  it('RewardRedeemedEvent → loyalty_redeemed (kaynak kick), KICKs sayılmaz', () => {
    const emit = vi.spyOn(eventBus, 'emit');
    const kicks = vi.spyOn(eventBus, 'emitKicks');
    (kickPlatform as any).handleGlobalEvent('RewardRedeemedEvent', JSON.stringify({ reward_title: 'Sahne değiştir', username: 'izleyici1', user_input: 'oyun', amount: 5 }), 'kanal');
    const c = emit.mock.calls.find((x) => x[0] === 'loyalty_redeemed');
    expect(c?.[1]).toMatchObject({ kaynak: 'kick', user: 'izleyici1', rewardTitle: 'Sahne değiştir', payload: 'oyun' });
    expect(kicks).not.toHaveBeenCalled();
    emit.mockRestore();
    kicks.mockRestore();
  });
});
