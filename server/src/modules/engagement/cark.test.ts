/**
 * AxBoT — şans çarkı seçimi testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { agirlikliSira } from './cark.js';

describe('agirlikliSira', () => {
  const d = [{ label: 'a', weight: 1 }, { label: 'b', weight: 3 }, { label: 'c', weight: 0 }];
  it('ağırlığa göre seçer, sıfır ağırlık hiç çıkmaz', () => {
    expect(agirlikliSira(d, () => 0)).toBe(0);
    expect(agirlikliSira(d, () => 0.24)).toBe(0);
    expect(agirlikliSira(d, () => 0.26)).toBe(1);
    expect(agirlikliSira(d, () => 0.9999)).toBe(1);
  });
  it('dilim sayısı dışına taşmaz; ayar yoksa 8 dilim', () => {
    expect(agirlikliSira([{ label: 'x' }, { label: 'y' }], () => 0.9999)).toBe(1);
    expect(agirlikliSira([], () => 0.99)).toBe(7);
    expect(agirlikliSira([{ label: 'x', weight: 0 }, { label: 'y', weight: 0 }], () => 0.99)).toBe(1);
  });
});
