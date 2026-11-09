import { describe, it, expect, vi } from 'vitest';
import { eventBus } from './event-bus.js';
import { db } from '../db/index.js';

describe('emitChat dinleyici yalıtımı', () => {
  it('fırlatan dinleyici diğerlerini ve olay kaydını durdurmaz', () => {
    const bozuk = () => { throw new Error('bozuk'); };
    const saglam = vi.fn();
    const tek = vi.fn();
    eventBus.on('chat', bozuk);
    eventBus.on('chat', saglam);
    eventBus.once('chat', tek);
    const uyari = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = `yalitim-${Date.now()}`;
    const mesaj = {
      id, platform: 'kick' as const, channel: 'k', message: 'merhaba', timestamp: Date.now(),
      user: { id: 'u', username: 'u', displayName: 'U', badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false }
    };
    try {
      expect(() => eventBus.emitChat(mesaj)).not.toThrow();
      eventBus.emitChat({ ...mesaj, id: `${id}-2` });
    } finally {
      eventBus.off('chat', bozuk);
      eventBus.off('chat', saglam);
      uyari.mockRestore();
    }
    expect(saglam).toHaveBeenCalledTimes(2);
    expect(tek).toHaveBeenCalledTimes(1); // once() dinleyicisi yine kendini kaldırır
    expect(db.prepare('SELECT id FROM stream_events WHERE id = ?').get(id)).toEqual({ id });
  });
});
