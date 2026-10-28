import { describe, it, expect } from 'vitest';
import { yigin } from './TheCupWidget.js';

describe('kupa yığını', () => {
  it('simgeler tabana homojen dağılır: kule/boşluk yok', () => {
    const ogeler = Array.from({ length: 60 }, (_, i) => ({ id: `o${i}`, tur: 'tip' }));
    const yer = yigin(ogeler, 240, { itemSize: 24 });
    // Taban üçe bölünür; her bölümde öğe sayısı birbirine yakın olmalı
    const bolum = [0, 0, 0];
    for (const y of yer) bolum[Math.min(2, Math.floor((y.x + y.boyut / 2) / 80))]++;
    expect(Math.min(...bolum)).toBeGreaterThan(Math.max(...bolum) * 0.6);
    // En yüksek ve en alçak sütun tepesi arasındaki fark bir-iki öğeyi geçmemeli
    const tepeler = [0, 1, 2].map((b) => Math.max(...yer.filter((y) => Math.floor((y.x + y.boyut / 2) / 80) === b).map((y) => y.y)));
    expect(Math.max(...tepeler) - Math.min(...tepeler)).toBeLessThan(24 * 2);
  });
});
