import { describe, expect, it } from 'vitest';
import { studioTemasiCoz } from './studioTemasi';

describe('Studio teması iletisi', () => {
  it('geçerli değerleri alır, bilinmeyen ve bozuk olanları atar', () => {
    const t = studioTemasiCoz({
      tur: 'studio-tema',
      tema: 'studio',
      degiskenler: { '--axt-zemin': '#06161a', '--axt-vurgu': 'rgb(45 212 191)', '--axt-yuzey': 'red;}body{x', '--baska': '#fff', '--axt-yaricap-kart': '0.75rem', '--axt-yazi-baslik': '1.25rem', '--axt-yaricap-dugme': '.75rem' }
    });
    expect(t).toEqual({ tema: 'studio', degiskenler: { '--axt-zemin': '#06161a', '--axt-vurgu': 'rgb(45 212 191)', '--axt-yaricap-kart': '0.75rem', '--axt-yazi-baslik': '1.25rem', '--axt-yaricap-dugme': '.75rem' } });
  });

  it('başka iletileri ve bozuk tema adını reddeder', () => {
    expect(studioTemasiCoz({ tur: 'sesli-ptt' })).toBeNull();
    expect(studioTemasiCoz({ tur: 'studio-tema', tema: 'x"]{}' })).toBeNull();
    expect(studioTemasiCoz(null)).toBeNull();
  });

  it('düğme belirteçlerini alır, bozuk ölçüyü atar (UI-1)', () => {
    const t = studioTemasiCoz({ tur: 'studio-tema', tema: 'studio', degiskenler: { '--axt-dugme-y': '24px', '--axt-dugme-yaricap': '2px', '--axt-dugme-buyuk-y': 'calc(1px)', '--axt-vurgu-metin': 'rgb(6 38 44)', '--axt-tehlike': 'red;x' } });
    expect(t?.degiskenler).toEqual({ '--axt-dugme-y': '24px', '--axt-dugme-yaricap': '2px', '--axt-vurgu-metin': 'rgb(6 38 44)' });
  });
});
