import { describe, expect, it } from 'vitest';
import { engelListesi, engelliMi, siraDegerleri, youtubeSuresi } from './istek-filtresi.js';

describe('engel listesi', () => {
  it('Türkçe harf ve büyük/küçük fark etmez', () => {
    expect(engelliMi('TEOMAN - Paramparça (Official)', 'paramparca')).toBe(true);
    expect(engelliMi('Hey Jude', 'paramparca\nteoman')).toBe(false);
  });

  it('boş ve tek harfli satır her şeyi engellemez', () => {
    expect(engelListesi('\n a \n\r\n  ')).toEqual([]);
    expect(engelliMi('herhangi bir şarkı', '\na\n')).toBe(false);
  });
});

describe('youtubeSuresi', () => {
  it('sayfadan süreyi okur, yoksa 0', () => {
    expect(youtubeSuresi('x"lengthSeconds":"225",y')).toBe(225);
    expect(youtubeSuresi('<html>')).toBe(0);
  });
});

describe('siraDegerleri', () => {
  const m = [
    { id: 'a', created_at: 10 },
    { id: 'b', created_at: 20 },
    { id: 'c', created_at: 30 },
  ];
  const sirali = (l: Array<{ id: string; created_at: number }>) => [...l].sort((x, y) => x.created_at - y.created_at).map((k) => k.id);

  it('yeni sırayı aynı zaman değerleriyle kurar', () => {
    expect(siraDegerleri(m, ['c', 'a', 'b'])).toEqual([
      { id: 'c', created_at: 10 },
      { id: 'a', created_at: 20 },
      { id: 'b', created_at: 30 },
    ]);
  });

  it('bilinmeyen kimliği atar, verilmeyeni sona koyar', () => {
    expect(sirali(siraDegerleri(m, ['x', 'c', 'c']))).toEqual(['c', 'a', 'b']);
  });

  it('aynı zamanlı kayıtlarda da sıra kesin olur', () => {
    const esit = m.map((k) => ({ ...k, created_at: 5 }));
    expect(siraDegerleri(esit, ['b', 'c', 'a']).map((k) => k.created_at)).toEqual([5, 6, 7]);
    expect(sirali(siraDegerleri(esit, ['b', 'c', 'a']))).toEqual(['b', 'c', 'a']);
  });
});

import { aramaAdaylari } from './istek-filtresi.js';

describe('aramaAdaylari', () => {
  it('sonuçları sırayla ve tekrarsız, başlıklarıyla verir', () => {
    const v = (id: string, t: string) => `"videoRenderer":{"videoId":"${id}","thumbnail":{},"title":{"runs":[{"text":"${t}"}]}}`;
    expect(aramaAdaylari(v('aaaaaaaaaaa', 'Bir \\"iki\\"') + v('bbbbbbbbbbb', 'Üç') + v('aaaaaaaaaaa', 'Yine'))).toEqual([
      { videoId: 'aaaaaaaaaaa', title: 'Bir "iki"' },
      { videoId: 'bbbbbbbbbbb', title: 'Üç' }
    ]);
  });
  it('biçim değişirse kimliklere düşer', () => {
    expect(aramaAdaylari('/watch?v=ccccccccccc x /watch?v=ccccccccccc')).toEqual([{ videoId: 'ccccccccccc', title: '' }]);
  });
});
