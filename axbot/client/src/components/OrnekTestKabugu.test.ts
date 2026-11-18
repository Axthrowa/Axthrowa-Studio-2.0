import { describe, expect, it } from 'vitest';
import { sayfaKatmani } from './OrnekTestKabugu.js';

describe('sayfaKatmani', () => {
  it('sayfa adını katman anahtarına çevirir', () => {
    expect(sayfaKatmani('/widgets/word-cloud')).toBe('wordCloud');
    expect(sayfaKatmani('/widgets/rankings/')).toBe('rankings');
    expect(sayfaKatmani('/panel')).toBe('');
  });
});
