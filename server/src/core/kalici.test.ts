import { describe, expect, it } from 'vitest';
import { kaliciBekleyenleriYaz, kaliciOku, kaliciYaz, kaliciYazGecikmeli } from './kalici.js';

describe('kalici', () => {
  it('yazar, okur; bekleyen gecikmeli yazımı hemen yazar', () => {
    expect(kaliciOku('k-test', 7)).toBe(7);
    kaliciYaz('k-test', { a: 1 });
    expect(kaliciOku('k-test', null)).toEqual({ a: 1 });
    kaliciYazGecikmeli('k-test', () => [1, 2], 60_000);
    kaliciBekleyenleriYaz();
    expect(kaliciOku('k-test', null)).toEqual([1, 2]);
  });
});
