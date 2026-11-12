import { describe, expect, it } from 'vitest';
import { metinOzeti } from './enforcement.js';

describe('silinen mesaj özeti', () => {
  it('metni tırnak içinde, tek satır ve 180 karakterle yazar', () => {
    expect(metinOzeti('  selam\nspam  ')).toBe(' — “selam spam”');
    expect(metinOzeti('')).toBe('');
    expect(metinOzeti('a'.repeat(200)).length).toBe(180 + ' — “”'.length);
  });
});
