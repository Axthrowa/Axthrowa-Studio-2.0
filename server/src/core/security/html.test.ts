/**
 * AxBoT — HTML/betik kaçışlama testleri (OAuth geri dönüş XSS'i)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { betikJsonu, htmlKacisla } from './html.js';

describe('htmlKacisla', () => {
  it('etiket ve tırnakları kaçışlar', () => {
    expect(htmlKacisla('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlKacisla(`"'&\``)).toBe('&quot;&#39;&amp;&#96;');
  });
  it('boş/tanımsız güvenli', () => {
    expect(htmlKacisla(undefined)).toBe('');
  });
});

describe('betikJsonu', () => {
  it('</script> ile bloktan kaçılamaz', () => {
    const s = betikJsonu({ code: "</script><script>alert(1)</script>" });
    expect(s.includes('</script>')).toBe(false);
    expect(JSON.parse(s).code).toBe('</script><script>alert(1)</script>');
  });
  it('tek tırnakla dizeden kaçılamaz (JSON çift tırnak kullanır)', () => {
    const s = betikJsonu({ code: "');alert(1);//" });
    // Gömülü değer geçerli JSON olarak geri okunur, kod olarak değil
    expect(JSON.parse(s).code).toBe("');alert(1);//");
  });
});
