import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({}) }), exec: () => {} } }));
vi.mock('../../ws/server.js', () => ({ wsHub: {} }));
vi.mock('../../modules/economy/economy.js', () => ({ default: {} }));
vi.mock('../../modules/tts/tts.js', () => ({ ttsEngine: {} }));

import { tutarOku } from './bagislar.js';

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
