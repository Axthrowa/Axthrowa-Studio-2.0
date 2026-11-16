import { describe, expect, it } from 'vitest';
import { moderasyonHesabiOku } from './kick';

describe('Kick moderasyon hesabı seçimi', () => {
  it('yalnız açıkça "bot" seçiliyse bot; bozuk ya da boş ayarda kanal', () => {
    expect(moderasyonHesabiOku(JSON.stringify({ moderasyon_hesabi: 'bot' }))).toBe('bot');
    expect(moderasyonHesabiOku(JSON.stringify({ moderasyon_hesabi: 'kanal' }))).toBe('kanal');
    expect(moderasyonHesabiOku('{bozuk')).toBe('kanal');
    expect(moderasyonHesabiOku(undefined)).toBe('kanal');
  });
});
