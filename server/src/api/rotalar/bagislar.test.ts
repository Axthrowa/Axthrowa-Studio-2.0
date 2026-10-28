import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({}) }), exec: () => {} } }));
const hub = vi.hoisted(() => ({ buildAlertPayload: vi.fn(), sohbetOlayi: vi.fn(), broadcastTo: vi.fn(), kupayaDusur: vi.fn() }));
const eko = vi.hoisted(() => ({ recordTip: vi.fn() }));
vi.mock('../../ws/server.js', () => ({ wsHub: hub }));
vi.mock('../../modules/economy/economy.js', () => ({ default: eko }));
vi.mock('../../modules/tts/tts.js', () => ({ ttsEngine: { enqueue: vi.fn() } }));

import { processDonation, tutarOku } from './bagislar.js';

describe('bağış tutarı', () => {
  it('Türkçe ve İngilizce biçimleri doğru okur', () => {
    expect(tutarOku('1.250,50')).toBe(1250.5);
    expect(tutarOku('1,250.50')).toBe(1250.5);
    expect(tutarOku('12,5 TL')).toBe(12.5);
    expect(tutarOku(100)).toBe(100);
    expect(tutarOku('abc')).toBe(0);
    expect(tutarOku(undefined)).toBe(0);
  });
});

describe('bağış işleme', () => {
  it('simülasyon puan vermez, kapalı uyarıyı yalnız test açar', () => {
    processDonation('Ali', 100, 'TL', '', 'bynogame', true);
    expect(eko.recordTip).not.toHaveBeenCalled();
    expect(hub.buildAlertPayload.mock.calls[0][2]).toBe(true);

    processDonation('Ali', 100, 'TL', '', 'bynogame');
    expect(eko.recordTip).toHaveBeenCalledWith('Ali', 'kick', 100);
    expect(hub.buildAlertPayload.mock.calls[1][2]).toBe(false);
  });
});
