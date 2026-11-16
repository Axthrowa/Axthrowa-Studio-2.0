import { describe, expect, it, vi } from 'vitest';

const kayit = new Map<string, string>([['widget_settings_the-cup', JSON.stringify({ maxItems: 5 })]]);
vi.mock('../../db/index.js', () => ({
  db: {
    prepare: () => ({
      get: (k: string) => (kayit.has(k) ? { value: kayit.get(k) } : undefined),
      run: (k: string, v: string) => (kayit.set(k, v), {})
    })
  }
}));

describe('dolu kupa', () => {
  it('dolunca yeni öğe eklenmez; mevcut öğeler (ve yerleri) değişmez', async () => {
    const { kupa } = await import('./kupa.js');
    kupa.sifirla();
    expect(kupa.dus('gift_sub', { count: 3 })).toBe(3);
    expect(kupa.dus('gift_sub', { count: 3 })).toBe(2);
    const once = [...kupa.liste()];
    expect(kupa.dus('tip', { amount: 5 })).toBe(0);
    expect(kupa.liste()).toEqual(once);
  });
});
