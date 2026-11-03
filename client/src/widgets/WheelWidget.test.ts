import { describe, expect, it } from 'vitest';
import { tikZamanlari } from './WheelWidget.js';

describe('tikZamanlari', () => {
  it('süre içinde kalır ve durmaya yaklaştıkça seyrekleşir', () => {
    const z = tikZamanlari(2160, 45, 4500);
    expect(z).toHaveLength(48);
    expect(z[z.length - 1]).toBeLessThan(4500);
    expect(z[1] - z[0]).toBeLessThan(z[z.length - 1] - z[z.length - 2]);
    expect(tikZamanlari(36000, 1, 4500)).toHaveLength(160);
  });
});
