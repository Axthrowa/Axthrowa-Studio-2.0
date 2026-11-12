import { describe, expect, it } from 'vitest';
import { studioTemasiCoz } from './studioTemasi';

describe('Studio teması iletisi', () => {
  it('geçerli değerleri alır, bilinmeyen ve bozuk olanları atar', () => {
    const t = studioTemasiCoz({
      tur: 'yya-tema',
      tema: 'studio',
      degiskenler: { '--axt-zemin': '#06161a', '--axt-vurgu': 'rgb(45 212 191)', '--axt-yuzey': 'red;}body{x', '--baska': '#fff', '--axt-yaricap-kart': '0.75rem' }
    });
    expect(t).toEqual({ tema: 'studio', degiskenler: { '--axt-zemin': '#06161a', '--axt-vurgu': 'rgb(45 212 191)', '--axt-yaricap-kart': '0.75rem' } });
  });

  it('başka iletileri ve bozuk tema adını reddeder', () => {
    expect(studioTemasiCoz({ tur: 'sesli-ptt' })).toBeNull();
    expect(studioTemasiCoz({ tur: 'yya-tema', tema: 'x"]{}' })).toBeNull();
    expect(studioTemasiCoz(null)).toBeNull();
  });
});
