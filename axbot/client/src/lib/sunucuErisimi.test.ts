import { describe, expect, it } from 'vitest';
import { KAPALI_ESIGI, erisimDurumu } from './sunucuErisimi';

describe('sunucu erişimi (UI-5)', () => {
  it('tek başarısızlık bot kapalı sayılmaz', () => {
    expect(erisimDurumu(0)).toBe('bagli');
    expect(erisimDurumu(KAPALI_ESIGI - 1)).toBe('bagli');
    expect(erisimDurumu(KAPALI_ESIGI)).toBe('kapali');
  });
});
