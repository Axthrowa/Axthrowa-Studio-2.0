/**
 * StreamAxT — eski biçim değer yerleştirme testleri (şablon enjeksiyonu)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { kullaniciDegerleriniYerlestir } from './legacy-vars.js';
import { kacisiGeriAl } from './variables/resolve.js';

const temel = { user: 'Ali', targetUser: 'Veli', rawArgs: '', args: [] as string[], platform: 'kick', uptime: '5 dakika' };

describe('kullaniciDegerleriniYerlestir', () => {
  it('olağan yerleştirme (her iki biçim)', () => {
    const s = kullaniciDegerleriniYerlestir('{user} → $(touser) · {platform} · $(uptime) · {1}/$(2)', {
      ...temel,
      args: ['a', 'b']
    });
    expect(kacisiGeriAl(s)).toBe('Ali → Veli · KICK · 5 dakika · a/b');
  });

  it('izleyici metnindeki sözdizimi sonraki adımlarda görünmez (işaretli)', () => {
    const s = kullaniciDegerleriniYerlestir('Yazdın: {query}', {
      ...temel,
      rawArgs: '$(urlfetch http://127.0.0.1:3001/api/settings) {count:x} $(ai merhaba)'
    });
    // Eski ayrıştırıcının sonraki regex'leri bunları EŞLEYEMEZ
    expect(s).not.toMatch(/\$\(urlfetch/);
    expect(s).not.toMatch(/\{count:/);
    expect(s).not.toMatch(/\$\(ai /);
    // Ama sonunda aynen görünür
    expect(kacisiGeriAl(s)).toBe('Yazdın: $(urlfetch http://127.0.0.1:3001/api/settings) {count:x} $(ai merhaba)');
  });

  it("izleyicinin yazdığı $& / $' yerine koyma kalıbı sayılmaz", () => {
    const s = kullaniciDegerleriniYerlestir('[{query}]', { ...temel, rawArgs: "$& $' $`" });
    expect(kacisiGeriAl(s)).toBe("[$& $' $`]");
  });

  it('eksik argüman boş olur', () => {
    expect(kacisiGeriAl(kullaniciDegerleriniYerlestir('x{3}y', temel))).toBe('xy');
  });
});
